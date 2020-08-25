import { ObjectId } from 'mongodb';
import { ensureDirSync, writeFile } from 'fs-extra';
import { join } from 'path';

import {
  IAnnotation,
  ICompilation,
  IEntity,
  IGroup,
  IUserData,
  IMetaDataDigitalEntity,
  IMetaDataPhysicalEntity,
  IMetaDataPerson,
  IMetaDataInstitution,
  IStrippedUserData,
  isEntity,
  isAnnotation,
  isDigitalEntity,
} from '@kompakkt/shared';
import { RootDirectory } from '../environment';

import { Logger } from './logger';
import { Mongo, updateOne } from './mongo';
import { Configuration as Conf } from './configuration';

const upDir = `${RootDirectory}/${Conf.Uploads.UploadDirectory}/`;

const stripUserData = (obj: IUserData): IStrippedUserData => ({
  _id: obj._id,
  username: obj.username,
  fullname: obj.fullname,
});

const updateAnnotationList = async (
  entityOrCompId: string,
  add_to_coll: string,
  annotationId: string | ObjectId,
) => {
  const obj = await Mongo.resolve<IEntity | ICompilation>(
    entityOrCompId,
    add_to_coll,
    0,
  );
  if (!obj) return undefined;
  annotationId = annotationId.toString();
  obj.annotations[annotationId] = { _id: new ObjectId(annotationId) };

  const coll = Mongo.getEntitiesRepository().collection(add_to_coll);
  const query = { _id: new ObjectId(entityOrCompId) };
  const update = { $set: { annotations: obj.annotations } };

  const updateResult = await updateOne(coll, query, update);

  return updateResult.result.ok === 1;
};

const saveCompilation = async (
  compilation: ICompilation,
  userData: IUserData,
) => {
  // Remove invalid annotations
  for (const id in compilation.annotations) {
    const value = compilation.annotations[id];
    if (isAnnotation(value)) continue;
    delete compilation.annotations[id];
  }

  // Add creator
  if (!compilation.creator) compilation.creator = stripUserData(userData);

  // Remove invalid and duplicate entities
  for (const id in compilation.entities) {
    const value = compilation.entities[id];
    if (isEntity(value)) continue;
    delete compilation.entities[id];
  }

  await Mongo.insertCurrentUserData(userData, compilation._id, 'compilation');
  return { ...compilation };
};

const saveAnnotation = async (
  annotation: IAnnotation,
  userData: IUserData,
  doesEntityExist: boolean,
) => {
  // If the Annotation already exists, check for owner
  const isAnnotationOwner = doesEntityExist
    ? await Mongo.isUserOwnerOfEntity(userData, annotation._id)
    : true;
  // Check if anything was missing for safety
  if (!annotation || !annotation.target?.source)
    throw new Error('Invalid annotation');
  const source = annotation.target.source;
  if (!source) throw new Error('Missing source');
  if (!annotation.body?.content?.relatedPerspective)
    throw new Error('Missing body.content.relatedPerspective');
  annotation.body.content.relatedPerspective.preview = await Mongo.saveBase64toImage(
    annotation.body.content.relatedPerspective.preview,
    'annotation',
    annotation._id,
  );

  // Assume invalid data
  const relatedEntityId = source.relatedEntity as string | undefined;
  const relatedCompId = source.relatedCompilation;
  // Check if === undefined because otherwise this quits on empty string
  if (relatedEntityId === undefined || relatedCompId === undefined)
    throw new Error('Related entity or compilation undefined');

  const validEntity = ObjectId.isValid(relatedEntityId);
  const validCompilation = ObjectId.isValid(relatedCompId);

  if (!validEntity) throw new Error('Invalid related entity id');

  // Case: Trying to change Default Annotations
  const isEntityOwner = await Mongo.isUserOwnerOfEntity(
    userData,
    relatedEntityId,
  );
  if (!validCompilation && !isEntityOwner) throw new Error('Permission denied');

  // Case: Compilation owner trying to re-rank annotations
  const isCompilationOwner = await Mongo.isUserOwnerOfEntity(
    userData,
    relatedCompId,
  );

  if (!isAnnotationOwner && isCompilationOwner) {
    const existing = await Mongo.resolve<IAnnotation>(annotation, 'annotation');

    // If not new and not existing then what are we even doing
    if (!existing) throw new Error('Permission denied');

    // Compilation owner is not supposed to change the annotation body
    if (JSON.stringify(existing.body) === JSON.stringify(annotation.body))
      throw new Error('Permission denied');
  }

  // Update data inside of annotation
  annotation.generated = annotation.generated ?? new Date().toISOString();
  annotation.lastModificationDate = new Date().toISOString();
  annotation.lastModifiedBy = {
    _id: userData._id,
    name: userData.fullname,
    type: 'person',
  };

  const entityOrCompId = !validCompilation ? relatedEntityId : relatedCompId;
  const reqedCollection = !validCompilation ? 'entity' : 'compilation';
  const updateSuccess = await updateAnnotationList(
    entityOrCompId,
    reqedCollection,
    annotation._id,
  );

  if (!updateSuccess) {
    const message = `Failed updating annotations of ${reqedCollection} ${entityOrCompId}`;
    Logger.err(message);
    throw new Error(message);
  }

  if (isAnnotationOwner)
    await Mongo.insertCurrentUserData(userData, annotation._id, 'annotation');

  return annotation;
};

const saveEntity = async (entity: IEntity, userData: IUserData) => {
  if (!entity.creator) entity.creator = stripUserData(userData);

  /* Preview image URLs might have a corrupted address
   * because of Kompakkt runnning in an iframe
   * This removes the host address from the URL
   * so images will load correctly */
  if (entity.settings?.preview) {
    entity.settings.preview = await Mongo.saveBase64toImage(
      entity.settings.preview,
      'entity',
      entity._id,
    );
  }
  await Mongo.insertCurrentUserData(userData, entity._id, 'entity');
  return entity;
};

const saveGroup = async (group: IGroup, userData: IUserData) => {
  const strippedUserData = stripUserData(userData);
  group.creator = strippedUserData;
  group.members = [strippedUserData];
  group.owners = [strippedUserData];
  return group;
};

const saveInstitution = async (
  institution: IMetaDataInstitution,
  userData: IUserData,
  save = false,
) => {
  const resolved = await Mongo.resolve<IMetaDataInstitution>(
    institution,
    'institution',
  );
  institution._id = resolved?._id ?? new ObjectId().toString();

  // If institution exists, combine roles
  institution.roles = { ...resolved?.roles, ...institution?.roles };
  institution.addresses = {
    ...resolved?.addresses,
    ...institution?.addresses,
  };
  institution.notes = { ...resolved?.notes, ...institution?.notes };

  const _id = institution._id;
  if (!save) return institution;

  return updateOne(
    Mongo.getEntitiesRepository().collection('institution'),
    Mongo.query(_id),
    { $set: { ...institution } },
    { upsert: true },
  ).then(res => {
    const _id = res.upsertedId?._id ?? institution._id;
    Mongo.insertCurrentUserData(userData, _id, 'institution');
    return institution;
  });
};

const savePerson = async (
  person: IMetaDataPerson,
  userData: IUserData,
  save = false,
) => {
  const resolved = await Mongo.resolve<IMetaDataPerson>(person, 'person');
  person._id = resolved?._id ?? new ObjectId().toString();

  // If person exists, combine roles
  person.roles = { ...resolved?.roles, ...person?.roles };
  person.institutions = {
    ...resolved?.institutions,
    ...person?.institutions,
  };
  person.contact_references = {
    ...resolved?.contact_references,
    ...person?.contact_references,
  };

  for (const id in person.institutions) {
    for (let i = 0; i < person.institutions[id].length; i++) {
      if (!person.institutions[id][i]) continue;
      person.institutions[id][i] = (await saveInstitution(
        person.institutions[id][i],
        userData,
        true,
      )) as any;
    }
  }

  const _id = person._id;
  if (!save) return person;

  return updateOne(
    Mongo.getEntitiesRepository().collection('person'),
    Mongo.query(_id),
    { $set: { ...person } },
    { upsert: true },
  ).then(res => {
    const _id = res.upsertedId?._id ?? person._id;
    Mongo.insertCurrentUserData(userData, _id, 'person');
    return person;
  });
};

const saveMetaDataEntity = async (
  entity: IMetaDataDigitalEntity | IMetaDataPhysicalEntity,
  userData: IUserData,
) => {
  const newEntity = { ...entity };

  for (let i = 0; i < newEntity.persons.length; i++) {
    newEntity.persons[i] = ((await savePerson(
      newEntity.persons[i],
      userData,
      true,
    )) as any)._id;
  }

  for (let i = 0; i < newEntity.institutions.length; i++) {
    newEntity.institutions[i] = ((await saveInstitution(
      newEntity.institutions[i],
      userData,
      true,
    )) as any)._id;
  }

  // Save unsaved metadata files and return link
  const https = Conf.Express.enableHTTPS ? 'https' : 'http';
  const pubip = Conf.Express.PublicIP;
  const port = Conf.Express.Port;
  ensureDirSync(join(upDir, '/metadata_files/'));
  for (let i = 0; i < newEntity.metadata_files.length; i++) {
    const file = newEntity.metadata_files[i];
    if (file.file_link.startsWith('http')) continue;
    const filename = `${newEntity._id}_${file.file_name}`;

    await writeFile(
      join(upDir, '/metadata_files/', `${filename}`),
      file.file_link,
    );

    const final = `${https}://${pubip}:${port}/uploads/metadata_files/${filename}`;
    file.file_link = final;

    newEntity.metadata_files[i] = file;
  }

  if (isDigitalEntity(newEntity)) {
    for (let i = 0; i < newEntity.tags.length; i++) {
      const tag = newEntity.tags[i];

      tag._id = ObjectId.isValid(tag._id) ? tag._id : new ObjectId();

      newEntity.tags[i] = (await updateOne(
        Mongo.getEntitiesRepository().collection('tag'),
        Mongo.query(tag._id),
        { $set: { ...tag } },
        { upsert: true },
      ).then(res => {
        const _id = res.upsertedId?._id ?? tag._id;
        Mongo.insertCurrentUserData(userData, _id, 'tag');
        return _id;
      })) as any;
    }
  }

  return newEntity;
};

const saveDigitalEntity = async (
  digitalentity: IMetaDataDigitalEntity,
  userData: IUserData,
) => {
  const newEntity = (await saveMetaDataEntity(
    digitalentity,
    userData,
  )) as IMetaDataDigitalEntity;

  for (let i = 0; i < newEntity.phyObjs.length; i++) {
    newEntity.phyObjs[i]._id = ObjectId.isValid(newEntity.phyObjs[i]._id)
      ? newEntity.phyObjs[i]._id
      : new ObjectId();
    const savedEntity = (await saveMetaDataEntity(
      newEntity.phyObjs[i],
      userData,
    )) as IMetaDataPhysicalEntity;
    newEntity.phyObjs[i] = (await updateOne(
      Mongo.getEntitiesRepository().collection('physicalentity'),
      Mongo.query(savedEntity._id),
      { $set: { ...savedEntity } },
      { upsert: true },
    ).then(res => {
      const _id = res.upsertedId?._id ?? savedEntity._id;
      Mongo.insertCurrentUserData(userData, _id, 'physicalentity');
      return _id;
    })) as any;
  }

  return newEntity;
};

export {
  saveAnnotation,
  saveCompilation,
  saveDigitalEntity,
  saveGroup,
  saveEntity,
  savePerson,
  saveInstitution,
};
