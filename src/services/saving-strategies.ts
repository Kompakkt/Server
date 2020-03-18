import { Collection, ObjectId } from 'mongodb';
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
  IMetaDataTag,
  IMetaDataPerson,
  IMetaDataInstitution,
  IStrippedUserData,
  IUnresolvedEntity,
} from '../interfaces';
import { RootDirectory } from '../environment';

import { Logger } from './logger';
import { Mongo, updateOne } from './mongo';
import { Configuration as Conf } from './configuration';
import { isAnnotation, isDigitalEntity } from './typeguards';

const upDir = `${RootDirectory}/${Conf.Uploads.UploadDirectory}/`;

const updateAnnotationList = async (
  entityOrCompId: string,
  add_to_coll: string,
  annotationId: string,
) => {
  const obj = await Mongo.resolve<IEntity | ICompilation>(
    entityOrCompId,
    add_to_coll,
    0,
  );
  if (!obj) return undefined;
  // Create annotationList if missing
  obj.annotationList = obj.annotationList ? obj.annotationList : [];
  // Filter null
  obj.annotationList = obj.annotationList.filter(_annotation => _annotation);

  const doesAnnotationExist = (obj.annotationList.filter(
    _annotation => _annotation,
  ) as Array<IAnnotation | ObjectId>).find(_annotation =>
    isAnnotation(_annotation)
      ? _annotation._id.toString() === annotationId
      : _annotation.toString() === annotationId,
  );

  // Add annotation to list if it doesn't exist
  if (!doesAnnotationExist) obj.annotationList.push(new ObjectId(annotationId));

  // We resolved the compilation earlier, so now we have to replace
  // the resolved annotations with their ObjectId again
  obj.annotationList = (obj.annotationList as Array<
    IAnnotation | ObjectId
  >).map(_annotation =>
    isAnnotation(_annotation) ? new ObjectId(_annotation._id) : _annotation,
  );

  return obj;
};

const saveCompilation = async (
  compilation: ICompilation,
  userData: IUserData,
) => {
  compilation.annotationList = compilation.annotationList
    ? compilation.annotationList
    : [];
  compilation.relatedOwner = {
    _id: userData._id,
    username: userData.username,
    fullname: userData.fullname,
  };

  // Compilations should have all their entities referenced by _id
  // Remove duplicates. Set of Objects doesnt remove duplicate, so use strings
  const validIds = new Set<string>();
  for (const entity of compilation.entities) {
    if (!entity) continue;
    validIds.add(entity._id.toString());
  }
  compilation.entities = Array.from(validIds).map(
    _id => ({ _id: new ObjectId(_id) } as IUnresolvedEntity),
  );

  await Mongo.insertCurrentUserData(userData, compilation._id, 'compilation');
  return compilation;
};

const saveAnnotation = async (
  annotation: IAnnotation,
  userData: IUserData,
  doesEntityExist: boolean,
) => {
  return new Promise<IAnnotation>(async (resolve, reject) => {
    // If the Annotation already exists, check for owner
    const isAnnotationOwner = doesEntityExist
      ? await Mongo.isUserOwnerOfEntity(userData, annotation._id)
      : true;
    // Check if anything was missing for safety
    if (!annotation || !annotation.target?.source)
      return reject('Invalid annotation');
    const source = annotation.target.source;
    if (!source) return reject('Missing source');
    if (!annotation.body?.content?.relatedPerspective)
      return reject('Missing body.content.relatedPerspective');
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
      return reject('Related entity or compilation undefined');

    const validEntity = ObjectId.isValid(relatedEntityId);
    const validCompilation = ObjectId.isValid(relatedCompId);

    if (!validEntity) return reject('Invalid related entity id');

    // Case: Trying to change Default Annotations
    const isEntityOwner = await Mongo.isUserOwnerOfEntity(
      userData,
      relatedEntityId,
    );
    if (!validCompilation && !isEntityOwner) return reject('Permission denied');

    // Case: Compilation owner trying to re-rank annotations
    const isCompilationOwner = await Mongo.isUserOwnerOfEntity(
      userData,
      relatedCompId,
    );
    if (!isAnnotationOwner) {
      if (isCompilationOwner) {
        const oldAnnotation = await Mongo.resolve<IAnnotation>(
          annotation,
          'annotation',
        );
        // Compilation owner is not supposed to change the annotation body
        if (oldAnnotation && oldAnnotation.body === annotation.body)
          return reject('Permission denied');
      } else {
        return reject('Permission denied');
      }
    }

    // Update data inside of annotation
    annotation.generated = annotation.generated
      ? annotation.generated
      : new Date().toISOString();
    annotation.lastModificationDate = new Date().toISOString();
    annotation.lastModifiedBy._id = userData._id;
    annotation.lastModifiedBy.name = userData.fullname;
    annotation.lastModifiedBy.type = 'person';

    const entityOrCompId = !validCompilation ? relatedEntityId : relatedCompId;
    const reqedCollection = !validCompilation ? 'entity' : 'compilation';
    const resultEntityOrComp = await updateAnnotationList(
      entityOrCompId,
      reqedCollection,
      annotation._id.toString(),
    );

    if (!resultEntityOrComp) return reject('Failed updating annotationList');

    // Finally we update the annotationList in the compilation
    const coll: Collection = Mongo.getEntitiesRepository().collection(
      reqedCollection,
    );
    const listUpdateResult = await updateOne(
      coll,
      { _id: new ObjectId(entityOrCompId) },
      { $set: { annotationList: resultEntityOrComp.annotationList } },
    );

    if (listUpdateResult.result.ok !== 1) {
      const message = `Failed updating annotationList of ${reqedCollection} ${entityOrCompId}`;
      Logger.err(message);
      return reject(message);
    }

    if (isAnnotationOwner)
      await Mongo.insertCurrentUserData(userData, annotation._id, 'annotation');

    resolve(annotation);
  });
};

const saveEntity = async (entity: IEntity, userData: IUserData) => {
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
  const strippedUserData: IStrippedUserData = {
    username: userData.username,
    fullname: userData.fullname,
    _id: userData._id,
  };
  group.creator = strippedUserData;
  group.members = [strippedUserData];
  group.owners = [strippedUserData];
  return group;
};

const savePerson = async (
  person: IMetaDataPerson,
  userData: IUserData,
  save = false,
) => {
  const resolved = await Mongo.resolve<IMetaDataPerson>(person, 'person');
  person._id = resolved ? resolved._id : new ObjectId().toString();

  // If person exists, combine roles
  if (!person.roles) person.roles = {};

  if (!person.institutions) person.institutions = {};

  if (!person.contact_references) person.contact_references = {};

  if (resolved) {
    person.roles = { ...resolved.roles, ...person.roles };
    person.institutions = {
      ...resolved.institutions,
      ...person.institutions,
    };
    person.contact_references = {
      ...resolved.contact_references,
      ...person.contact_references,
    };
  }

  for (const id in person.institutions) {
    person.institutions[id] = person.institutions[id].filter(_ => _);
    for (let i = 0; i < person.institutions[id].length; i++) {
      person.institutions[id][i] = (await saveInstitution(
        person.institutions[id][i],
        userData,
        true,
      )) as any;
    }
  }

  const _id = person._id;
  if (save) {
    return updateOne(
      Mongo.getEntitiesRepository().collection('person'),
      Mongo.query(_id),
      { $set: { ...person } },
      { upsert: true },
    ).then(res => {
      const _id = res.upsertedId ? res.upsertedId._id : person._id;
      Mongo.insertCurrentUserData(userData, _id, 'person');
      return person;
    });
  } else {
    delete person._id;
    return person;
  }
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
  institution._id = resolved ? resolved._id : new ObjectId().toString();

  if (!institution.roles) institution.roles = {};
  if (!institution.addresses) institution.addresses = {};
  if (!institution.notes) institution.notes = {};

  // If institution exists, combine roles
  if (resolved) {
    institution.roles = { ...resolved.roles, ...institution.roles };
    institution.addresses = {
      ...resolved.addresses,
      ...institution.addresses,
    };
    institution.notes = { ...resolved.notes, ...institution.notes };
  }

  const _id = institution._id;
  if (save) {
    return updateOne(
      Mongo.getEntitiesRepository().collection('institution'),
      Mongo.query(_id),
      { $set: { ...institution } },
      { upsert: true },
    ).then(res => {
      const _id = res.upsertedId ? res.upsertedId._id : institution._id;
      Mongo.insertCurrentUserData(userData, _id, 'institution');
      return institution;
    });
  } else {
    delete institution._id;
    return institution;
  }
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
      const tag: IMetaDataTag =
        typeof newEntity.tags[i] === 'string'
          ? { _id: new ObjectId(), value: newEntity.tags[i] as string }
          : (newEntity.tags[i] as IMetaDataTag);

      tag._id = ObjectId.isValid(tag._id) ? tag._id : new ObjectId();

      newEntity.tags[i] = (await updateOne(
        Mongo.getEntitiesRepository().collection('tag'),
        Mongo.query(tag._id),
        { $set: { ...tag } },
        { upsert: true },
      ).then(res => {
        const _id = res.upsertedId ? res.upsertedId._id : tag._id;
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
      const _id = res.upsertedId ? res.upsertedId._id : savedEntity._id;
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
