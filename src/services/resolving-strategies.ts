import { ICompilation, IEntity, IMetaDataDigitalEntity, IMetaDataPerson, IMetaDataPhysicalEntity } from '../interfaces';

import { Mongo } from './mongo';
import { isDigitalEntity } from './typeguards';

const resolvePerson = async (person: IMetaDataPerson) => {
  if (person.institution) {
    for (let j = 0; j < person.institution.length; j++) {
      person.institution[j] =
        await Mongo.resolve(person.institution[j], 'institution');
    }
  }
  return person;
};

const resolveMetaDataEntity = async (entity: IMetaDataDigitalEntity | IMetaDataPhysicalEntity) => {
  if (!entity || !entity._id) {
    return entity;
  }
  const _id = entity._id.toString();

  for (let i = 0; i < entity.persons.length; i++) {
    const resolved: IMetaDataPerson = await Mongo.resolve(entity.persons[i], 'person');
    if (!resolved) {
      continue;
    }
    entity.persons[i] = await resolvePerson(resolved);

    if (!entity.persons[i].roles) {
      entity.persons[i].roles = {};
    }
    if (!entity.persons[i].roles[_id]) {
      entity.persons[i].roles[_id] = [];
    }
  }

  for (let i = 0; i < entity.institutions.length; i++) {
    entity.institutions[i] =
      await Mongo.resolve(entity.institutions[i], 'institution');
  }

  if (isDigitalEntity(entity)) {
    for (let i = 0; i < entity.tags.length; i++) {
      entity.tags[i] =
        await Mongo.resolve(entity.tags[i], 'tag');
    }
  }

  return entity;
};

export const resolveDigitalEntity = async (digitalEntity: IMetaDataDigitalEntity) => {
  const resolvedDigital =
    (await resolveMetaDataEntity(digitalEntity)) as IMetaDataDigitalEntity;

  if (resolvedDigital.phyObjs) {
    for (let i = 0; i < resolvedDigital.phyObjs.length; i++) {
      const resolved = await Mongo.resolve(resolvedDigital.phyObjs[i], 'physicalentity');
      if (!resolved) {
        continue;
      }
      resolvedDigital.phyObjs[i] =
        (await resolveMetaDataEntity(resolved)) as IMetaDataPhysicalEntity;
    }
  }

  return resolvedDigital;
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
