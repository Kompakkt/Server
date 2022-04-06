// prettier-ignore
import { IAnnotation, IAddress, ICompilation, IContact, IEntity, IGroup, IUserData, IDigitalEntity, IPhysicalEntity, IPerson, IInstitution, ITag, isEntity, isAnnotation, isDigitalEntity, isUnresolved } from '../../common';
import { ObjectId } from 'mongodb';
import { ensureDirSync, writeFile } from 'fs-extra';
import { join } from 'path';
import { RootDirectory } from '../../environment';
import { Logger } from '../logger';
import { Configuration as Conf } from '../configuration';
import { query, updatePreviewImage, stripUserData } from './functions';
import { Repo } from './controllers';
import Entities from './entities';
import Users from './users';

const upDir = `${RootDirectory}/${Conf.Uploads.UploadDirectory}/`;

type EntityOrComp = IEntity | ICompilation;

const updateAnnotationList = async (
  entityOrCompId: string,
  coll: 'entity' | 'compilation',
  annotationId: string | ObjectId,
) => {
  if (coll !== 'entity' && coll !== 'compilation') return undefined;
  const obj = await Entities.resolve<EntityOrComp>(entityOrCompId, coll, 0);
  if (!obj) return undefined;
  annotationId = annotationId.toString();
  obj.annotations[annotationId] = { _id: new ObjectId(annotationId) };

  const updateResult = await Repo.get<EntityOrComp>(coll)?.updateOne(query(entityOrCompId), {
    $set: { annotations: obj.annotations },
  });
  return !!updateResult;
};

const saveCompilation = async (compilation: ICompilation, user: IUserData) => {
  // Remove invalid annotations
  for (const id in compilation.annotations) {
    const value = compilation.annotations[id];
    if (isAnnotation(value)) continue;
    delete compilation.annotations[id];
  }

  // Add creator
  if (!compilation.creator) compilation.creator = stripUserData(user);

  // Remove invalid and duplicate entities
  for (const id in compilation.entities) {
    const value = compilation.entities[id];
    if (isEntity(value)) continue;
    delete compilation.entities[id];
  }

  await Users.makeOwnerOf(user, compilation._id, 'compilation');

  return compilation;
};

const saveAnnotation = async (
  annotation: IAnnotation,
  user: IUserData,
  doesEntityExist: boolean,
) => {
  // If the Annotation already exists, check for owner
  const isAnnotationOwner = doesEntityExist ? await Users.isOwner(user, annotation._id) : true;
  // Check if anything was missing for safety
  if (!annotation || !annotation.target?.source) throw new Error('Invalid annotation');
  const source = annotation.target.source;
  if (!source) throw new Error('Missing source');
  if (!annotation.body?.content?.relatedPerspective)
    throw new Error('Missing body.content.relatedPerspective');
  annotation.body.content.relatedPerspective.preview = await updatePreviewImage(
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
  const isEntityOwner = await Users.isOwner(user, relatedEntityId);
  if (!validCompilation && !isEntityOwner) throw new Error('Permission denied');

  // Case: Compilation owner trying to re-rank annotations
  const isCompilationOwner = await Users.isOwner(user, relatedCompId);

  if (!isAnnotationOwner && isCompilationOwner) {
    const existing = await Entities.resolve<IAnnotation>(annotation, 'annotation');

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
    _id: user._id,
    name: user.fullname,
    type: 'person',
  };

  const entityOrCompId = !validCompilation ? relatedEntityId : relatedCompId;
  const reqedCollection = !validCompilation ? 'entity' : 'compilation';
  const updateSuccess = await updateAnnotationList(entityOrCompId, reqedCollection, annotation._id);

  if (!updateSuccess) {
    const message = `Failed updating annotations of ${reqedCollection} ${entityOrCompId}`;
    Logger.err(message);
    throw new Error(message);
  }

  if (isAnnotationOwner) await Users.makeOwnerOf(user, annotation._id, 'annotation');

  return annotation;
};

const saveEntity = async (entity: IEntity, user: IUserData) => {
  if (!entity.creator) entity.creator = stripUserData(user);

  /* Preview image URLs might have a corrupted address
   * because of Kompakkt runnning in an iframe
   * This removes the host address from the URL
   * so images will load correctly */
  if (entity.settings?.preview) {
    entity.settings.preview = await updatePreviewImage(
      entity.settings.preview,
      'entity',
      entity._id,
    );
  }
  await Users.makeOwnerOf(user, entity._id, 'entity');

  return entity;
};

const saveGroup = async (group: IGroup, user: IUserData) => {
  const strippedUserData = stripUserData(user);
  group.creator = strippedUserData;
  group.members = [strippedUserData];
  group.owners = [strippedUserData];
  return group;
};

const saveAddress = async (address: IAddress, user?: IUserData) => {
  const resolved = await Entities.resolve<IAddress>(address, 'address');
  address._id = address?._id ?? resolved?._id ?? new ObjectId().toString();

  const result = await Repo.address.updateOne(
    query(address._id),
    { $set: { ...address } },
    { upsert: true },
  );

  if (!result) throw new Error('Failed saving address');

  const _id = result.upsertedId ?? address._id;
  if (user) Users.makeOwnerOf(user, _id, 'address');
  return { ...address, _id } as IAddress;
};

const saveInstitution = async (institution: IInstitution, user?: IUserData, save = false) => {
  const resolved = await Entities.resolve<IInstitution>(institution, 'institution');
  institution._id = institution?._id ?? resolved?._id ?? new ObjectId().toString();

  // If institution exists, combine roles
  institution.roles = { ...resolved?.roles, ...institution?.roles };
  institution.addresses = { ...resolved?.addresses, ...institution?.addresses };
  institution.notes = { ...resolved?.notes, ...institution?.notes };

  // Always take existing name and university
  institution.name = resolved?.name ?? institution.name;
  institution.university = resolved?.university ?? institution.university;

  for (const [id, address] of Object.entries(institution.addresses)) {
    if (isUnresolved(address)) continue;
    if (!address) continue;
    institution.addresses[id] = await saveAddress(address as IAddress, user);
  }

  if (!save) return institution;

  const result = await Repo.institution.updateOne(
    query(institution._id),
    { $set: { ...institution } },
    { upsert: true },
  );

  if (!result) throw new Error('Failed saving institution');

  const _id = result.upsertedId ?? institution._id;
  if (user) Users.makeOwnerOf(user, _id, 'institution');
  return { ...institution, _id } as IInstitution;
};

const saveContact = async (contact: IContact, user?: IUserData) => {
  const resolved = await Entities.resolve<IContact>(contact, 'contact');
  contact._id = contact?._id ?? resolved?._id ?? new ObjectId().toString();

  const result = await Repo.contact.updateOne(
    query(contact._id),
    { $set: { ...contact } },
    { upsert: true },
  );

  if (!result) throw new Error('Failed saving contact');

  const _id = result.upsertedId ?? contact._id;
  if (user) Users.makeOwnerOf(user, _id, 'contact');
  return { ...contact, _id } as IContact;
};

const savePerson = async (person: IPerson, user?: IUserData, save = false) => {
  const resolved = await Entities.resolve<IPerson>(person, 'person');
  person._id = person?._id ?? resolved?._id ?? new ObjectId().toString();

  // If person exists, combine roles
  person.roles = { ...resolved?.roles, ...person?.roles };
  person.institutions = { ...resolved?.institutions, ...person?.institutions };
  person.contact_references = { ...resolved?.contact_references, ...person?.contact_references };

  // Always take existing name
  person.prename = resolved?.prename ?? person.prename;
  person.name = resolved?.name ?? person.name;

  for (const id in person.institutions) {
    const institutions =
      (person.institutions[id]?.filter(i => i && !isUnresolved(i)) as IInstitution[]) ?? [];
    if (!institutions) continue;
    const savedInstitutions = await Promise.all(
      institutions.map(i => saveInstitution(i, user, true)),
    );
    person.institutions[id] = savedInstitutions.map(i => ({ _id: i._id }));
  }

  for (const [id, contact] of Object.entries(person.contact_references)) {
    if (isUnresolved(contact)) continue;
    if (!contact) continue;
    if ((contact as IContact)?.mail?.length <= 0) continue;
    person.contact_references[id] = await saveContact(contact, user);
  }

  if (!save) return person;

  const result = await Repo.person.updateOne(
    query(person._id),
    { $set: { ...person } },
    { upsert: true },
  );

  if (!result) throw new Error('Failed saving person');

  const _id = result.upsertedId ?? person._id;
  if (user) Users.makeOwnerOf(user, _id, 'person');
  return { ...person, _id } as IPerson;
};

const saveTag = async (entity: ITag, user: IUserData) => {
  const tag = { ...entity } as ITag;
  const resolved = await Entities.resolve<ITag>(tag, 'tag');
  tag._id = tag?._id ?? resolved?._id ?? new ObjectId().toString();

  const result = await Repo.tag.updateOne(query(tag._id), { $set: { ...tag } }, { upsert: true });

  if (!result) throw new Error('Failed saving tag');
  Users.makeOwnerOf(user, tag._id, 'tag');
  return tag;
};

const saveMetaDataEntity = async (entity: IDigitalEntity | IPhysicalEntity, user: IUserData) => {
  const newEntity = { ...entity };

  // Save unsaved metadata files and return link
  ensureDirSync(join(upDir, '/metadata_files/'));
  for (let i = 0; i < newEntity.metadata_files.length; i++) {
    const file = newEntity.metadata_files[i];
    // Skip metadata files that have already been saved on the backend
    if (file.file_link.startsWith('http')) continue;

    const filename = `${newEntity._id}_${file.file_name}`;

    await writeFile(join(upDir, '/metadata_files/', `${filename}`), file.file_link);

    file.file_link = `uploads/metadata_files/${filename}`;

    newEntity.metadata_files[i] = file;
  }

  if (isDigitalEntity(newEntity)) {
    for (let i = 0; i < newEntity.tags.length; i++) {
      const tag = newEntity.tags[i];
      newEntity.tags[i] = (await saveTag(tag, user))._id as any;
    }
  }

  return newEntity as IDigitalEntity | IPhysicalEntity;
};

const saveDigitalEntity = async (digitalentity: IDigitalEntity, user: IUserData) => {
  const newEntity = (await saveMetaDataEntity(digitalentity, user)) as IDigitalEntity;

  for (let i = 0; i < newEntity.persons.length; i++) {
    newEntity.persons[i] = ((await savePerson(newEntity.persons[i], user, true)) as any)._id;
  }

  for (let i = 0; i < newEntity.institutions.length; i++) {
    const institution = newEntity.institutions[i];
    newEntity.institutions[i] = ((await saveInstitution(institution, user, true)) as any)._id;
  }

  for (let i = 0; i < newEntity.phyObjs.length; i++) {
    newEntity.phyObjs[i]._id = ObjectId.isValid(newEntity.phyObjs[i]._id)
      ? newEntity.phyObjs[i]._id
      : new ObjectId();
    const savedEntity = (await saveMetaDataEntity(newEntity.phyObjs[i], user)) as IPhysicalEntity;
    newEntity.phyObjs[i] = (await Repo.physicalentity
      .updateOne(query(savedEntity._id), { $set: { ...savedEntity } }, { upsert: true })
      .then(res => {
        if (!res) throw new Error('Failed saving physicalentity');

        const _id = res.upsertedId ?? savedEntity._id;
        Users.makeOwnerOf(user, _id, 'physicalentity');
        return _id;
      })) as any;
  }

  await Users.makeOwnerOf(user, newEntity._id, 'digitalentity');

  return newEntity as IDigitalEntity;
};

export const Save = {
  compilation: saveCompilation,
  annotation: saveAnnotation,
  entity: saveEntity,
  group: saveGroup,
  address: saveAddress,
  institution: saveInstitution,
  contact: saveContact,
  person: savePerson,
  metadataentity: saveMetaDataEntity,
  digitalentity: saveDigitalEntity,
  tag: saveTag,
};
