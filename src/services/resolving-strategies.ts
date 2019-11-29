import { ObjectId } from 'mongodb';

import {
  ICompilation,
  IEntity,
  IMetaDataDigitalEntity,
  IMetaDataPerson,
  IMetaDataInstitution,
  IMetaDataPhysicalEntity,
  IMetaDataTag,
  IAnnotation,
} from '../interfaces';

import { Mongo } from './mongo';
import { isDigitalEntity } from './typeguards';

export const resolvePerson = async (person: IMetaDataPerson) => {
  if (person.institutions) {
    for (const id in person.institutions) {
      if (!person.institutions[id]) continue;
      if (!ObjectId.isValid(id)) continue;
      for (let i = 0; i < person.institutions[id].length; i++) {
        const resolved = await Mongo.resolve<IMetaDataInstitution>(
          person.institutions[id][i],
          'institution',
        );
        if (!resolved) continue;
        person.institutions[id][i] = resolved;
      }
    }
  }
  return person;
};

const resolveMetaDataEntity = async (
  entity: IMetaDataDigitalEntity | IMetaDataPhysicalEntity,
) => {
  if (!entity || !entity._id) {
    return entity;
  }
  const _id = entity._id.toString();

  for (let i = 0; i < entity.persons.length; i++) {
    const resolved = await Mongo.resolve<IMetaDataPerson>(
      entity.persons[i],
      'person',
    );
    if (!resolved) continue;
    entity.persons[i] = await resolvePerson(resolved);

    if (!entity.persons[i].roles) {
      entity.persons[i].roles = {};
    }
    if (!entity.persons[i].roles[_id]) {
      entity.persons[i].roles[_id] = [];
    }
  }

  for (let i = 0; i < entity.institutions.length; i++) {
    const resolved = await Mongo.resolve<IMetaDataInstitution>(
      entity.institutions[i],
      'institution',
    );
    if (!resolved) continue;
    entity.institutions[i] = resolved;
  }

  if (isDigitalEntity(entity)) {
    for (let i = 0; i < entity.tags.length; i++) {
      const resolved = await Mongo.resolve<IMetaDataTag>(entity.tags[i], 'tag');
      if (!resolved) continue;
      entity.tags[i] = resolved;
    }
  }

  return entity;
};

export const resolveDigitalEntity = async (
  digitalEntity: IMetaDataDigitalEntity,
) => {
  const resolvedDigital = (await resolveMetaDataEntity(
    digitalEntity,
  )) as IMetaDataDigitalEntity;

  if (resolvedDigital.phyObjs) {
    for (let i = 0; i < resolvedDigital.phyObjs.length; i++) {
      const resolved = await Mongo.resolve<IMetaDataPhysicalEntity>(
        resolvedDigital.phyObjs[i],
        'physicalentity',
      );
      if (!resolved) {
        continue;
      }
      resolvedDigital.phyObjs[i] = (await resolveMetaDataEntity(
        resolved,
      )) as IMetaDataPhysicalEntity;
    }
  }

  return resolvedDigital;
};

export const resolveEntity = async (entity: IEntity) => {
  if (entity.annotationList) {
    for (let i = 0; i < entity.annotationList.length; i++) {
      const annotation = entity.annotationList[i];
      if (!annotation) continue;
      const resolved = await Mongo.resolve<IAnnotation>(
        annotation,
        'annotation',
      );
      if (!resolved) continue;
      entity.annotationList[i] = resolved;
    }
    entity.annotationList = entity.annotationList.filter(_ => _);
  }
  if (
    entity.relatedDigitalEntity &&
    !isDigitalEntity(entity.relatedDigitalEntity)
  ) {
    const resolved = await Mongo.resolve<IMetaDataDigitalEntity>(
      entity.relatedDigitalEntity,
      'digitalentity',
    );
    if (resolved) {
      entity.relatedDigitalEntity = resolved;
    }
  }
  return entity;
};

export const resolveCompilation = async (compilation: ICompilation) => {
  if (compilation.entities) {
    for (let i = 0; i < compilation.entities.length; i++) {
      const entity = compilation.entities[i];
      if (!entity) continue;
      const resolved = await Mongo.resolve<IEntity>(entity, 'entity');
      if (!resolved) continue;
      compilation.entities[i] = resolved;
    }
    compilation.entities = compilation.entities.filter(_ => _);
  }
  if (compilation.annotationList) {
    for (let i = 0; i < compilation.annotationList.length; i++) {
      const annotation = compilation.annotationList[i];
      if (!annotation) continue;
      const resolved = await Mongo.resolve<IAnnotation>(
        annotation,
        'annotation',
      );
      if (!resolved) continue;
      compilation.annotationList[i] = resolved;
    }
    compilation.annotationList = compilation.annotationList.filter(_ => _);
  }
  return compilation;
};
