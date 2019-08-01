import { ICompilation, IEntity, IMetaDataDigitalEntity, IMetaDataPerson } from '../interfaces';

import { Mongo } from './mongo';
import { isDigitalEntity, isPerson } from './typeguards';

// TODO: Dynamic Resolving Depth

const INSTITUTION_SELECTOR = 2;

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

// Heavy nested resolving for DigitalEntity
export const resolveDigitalEntity = async (digitalEntity: IMetaDataDigitalEntity) => {
  // TODO: Use Typeguards
  let currentId = digitalEntity._id.toString();
  const resolveTopLevel = async (obj: any, property: string, field: string) => {
    if (obj[property] && obj[property].length && obj[property] instanceof Array) {
      for (let i = 0; i < obj[property].length; i++) {
        const resolved = await Mongo.resolve(obj[property][i], field);
        if (!resolved) continue;
        obj[property][i] = isPerson(resolved)
          ? await resolvePerson(resolved)
          : resolved;
        if (obj[property][i]['roles'] && obj[property][i]['roles'][currentId]) {
          const old = obj[property][i]['roles'][currentId];
          obj[property][i]['roles'] = {};
          obj[property][i]['roles'][currentId] = old;
        }
      }
    }
  };

  let selector = digitalEntity.digobj_rightsownerSelector;
  const props = [
    ['digobj_rightsowner', (selector === INSTITUTION_SELECTOR) ? 'institution' : 'person'],
    ['digobj_person_existing'], ['contact_person_existing'], ['digobj_tags', 'tag']];

  for (const prop of props) {
    await resolveTopLevel(digitalEntity, prop[0], (prop[1]) ? prop[1] : 'person');
  }

  if (digitalEntity.phyObjs) {
    const resolvedPhysicalEntities: any[] = [];
    for (let phyObj of digitalEntity.phyObjs) {
      if (!phyObj) continue;
      currentId = phyObj._id.toString();
      phyObj = await Mongo.resolve(phyObj, 'physicalentity');
      if (!phyObj) continue;
      selector = phyObj.phyobj_rightsownerSelector;
      const phyProps = [
        ['phyobj_rightsowner', (selector === INSTITUTION_SELECTOR) ? 'institution' : 'person'],
        ['phyobj_person_existing'], ['phyobj_institution_existing', 'institution']];
      for (const phyProp of phyProps) {
        await resolveTopLevel(phyObj, phyProp[0], (phyProp[1]) ? phyProp[1] : 'person');
      }
      resolvedPhysicalEntities.push(phyObj);
    }
    digitalEntity.phyObjs = resolvedPhysicalEntities;
  }

  return digitalEntity;
};

export const resolveEntity = async (entity: IEntity) => {
  if (entity.annotationList) {
    for (let i = 0; i < entity.annotationList.length; i++) {
      const annotation = entity.annotationList[i];
      if (!annotation) continue;
      entity.annotationList[i] = await Mongo.resolve(annotation, 'annotation');
    }
    entity.annotationList = entity.annotationList.filter(_ => _);
  }
  if (entity.relatedDigitalEntity && !isDigitalEntity(entity.relatedDigitalEntity)) {
    entity.relatedDigitalEntity = await Mongo.resolve(entity.relatedDigitalEntity, 'digitalentity');
  }
  return entity;
};

export const resolveCompilation = async (compilation: ICompilation) => {
  if (compilation.entities) {
    for (let i = 0; i < compilation.entities.length; i++) {
      const entity = compilation.entities[i];
      if (!entity) continue;
      compilation.entities[i] = await Mongo.resolve(entity, 'entity');
    }
    compilation.entities = compilation.entities.filter(_ => _);
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
