import { ICompilation, IMetaDataDigitalObject, IMetaDataPerson, IModel } from '../interfaces';

import { Mongo } from './mongo';
import { isPerson, isDigitalObject } from './typeguards';

// TODO: Dynamic Resolving Depth

const resolvePerson = async (person: IMetaDataPerson) => {
  if (person.person_institution_data) {
    for (let j = 0; j < person.person_institution_data.length; j++) {
      if (!person.person_institution_data[j]['_id']) continue;
      person.person_institution_data[j] =
        await Mongo.resolve(person.person_institution_data[j]['_id'], 'institution');
    }
  }
  return person;
};

// Heavy nested resolving for DigitalObject
export const resolveDigitalObject = async (digitalObject: IMetaDataDigitalObject) => {
  // TODO: Use Typeguards
  let currentId = digitalObject._id.toString();
  const resolveTopLevel = async (obj, property, field) => {
    if (obj[property] && obj[property].length && obj[property] instanceof Array) {
      for (let i = 0; i < obj[property].length; i++) {
        const resolved = await Mongo.resolve(obj[property][i], field);
        if (!resolved) continue;
        if (isPerson(resolved)) {
          obj[property][i] = await resolvePerson(resolved);
        } else {
          obj[property][i] = resolved;
        }
        if (obj[property][i]['roles'] && obj[property][i]['roles'][currentId]) {
          const old = obj[property][i]['roles'][currentId];
          obj[property][i]['roles'] = {};
          obj[property][i]['roles'][currentId] = old;
        }
      }
    }
  };

  let selector = digitalObject.digobj_rightsownerSelector;
  const props = [
    ['digobj_rightsowner', (selector === 2) ? 'institution' : 'person'],
    ['digobj_person_existing'], ['contact_person_existing'], ['digobj_tags', 'tag']];

  for (const prop of props) {
    await resolveTopLevel(digitalObject, prop[0], (prop[1]) ? prop[1] : 'person');
  }

  if (digitalObject.phyObjs) {
    const resolvedPhysicalObjects: any[] = [];
    for (let phyObj of digitalObject.phyObjs) {
      if (!phyObj) continue;
      currentId = phyObj._id.toString();
      phyObj = await Mongo.resolve(phyObj, 'physicalobject');
      if (!phyObj) continue;
      selector = phyObj.phyobj_rightsownerSelector;
      const phyProps = [
        ['phyobj_rightsowner', (selector === 2) ? 'institution' : 'person'],
        ['phyobj_person_existing'], ['phyobj_institution_existing', 'institution']];
      for (const phyProp of phyProps) {
        await resolveTopLevel(phyObj, phyProp[0], (phyProp[1]) ? phyProp[1] : 'person');
      }
      resolvedPhysicalObjects.push(phyObj);
    }
    digitalObject.phyObjs = resolvedPhysicalObjects;
  }

  return digitalObject;
};

export const resolveModel = async (model: IModel) => {
  if (model.annotationList) {
    for (let i = 0; i < model.annotationList.length; i++) {
      const annotation = model.annotationList[i];
      if (!annotation) continue;
      model.annotationList[i] = await Mongo.resolve(annotation, 'annotation');
    }
    model.annotationList = model.annotationList.filter(_ => _);
  }
  if (model.relatedDigitalObject && !isDigitalObject(model.relatedDigitalObject)) {
    model.relatedDigitalObject = await Mongo.resolve(model.relatedDigitalObject, 'digitalobject');
  }
  return model;
};

export const resolveCompilation = async (compilation: ICompilation) => {
  if (compilation.models) {
    for (let i = 0; i < compilation.models.length; i++) {
      const model = compilation.models[i];
      if (!model) continue;
      compilation.models[i] = await Mongo.resolve(model, 'model');
    }
    compilation.models = compilation.models.filter(_ => _);
  }
  if (compilation.annotationList) {
    for (let i = 0; i < compilation.annotationList.length; i++) {
      const annotation = compilation.annotationList[i];
      if (!annotation) continue;
      compilation.annotationList[i] = await Mongo.resolve(annotation, 'annotation');
    }
    compilation.annotationList = compilation.annotationList.filter(_ => _);
  }
  return compilation;
};
