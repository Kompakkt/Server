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
  isDigitalEntity,
} from '@kompakkt/shared';

import { Mongo } from './mongo';

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
  for (const id in entity.annotations) {
    const resolved = await Mongo.resolve<IAnnotation>(id, 'annotation');
    if (!resolved) {
      delete entity.annotations[id];
      continue;
    }
    entity.annotations[id] = resolved;
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
  for (const id in compilation.entities) {
    const resolved = await Mongo.resolve<IEntity>(id, 'entity');
    if (!resolved) {
      delete compilation.entities[id];
      continue;
    }
    compilation.entities[id] = resolved;
  }

  for (const id in compilation.annotations) {
    const resolved = await Mongo.resolve<IAnnotation>(id, 'annotation');
    if (!resolved) {
      delete compilation.annotations[id];
      continue;
    }
    compilation.annotations[id] = resolved;
  }

  return compilation;
};
