// prettier-ignore
import { ICompilation, IAddress, IEntity, IContact, IDigitalEntity, IPerson, IInstitution, IPhysicalEntity, ITag, IAnnotation, isDigitalEntity, isPerson, isInstitution, isUnresolved } from '../../common';
import Entities from './entities';

const removeUnrelatedEntities = <T extends unknown>(
  obj: IPerson | IInstitution,
  entityId: string,
) => {
  const relatedRole = obj.roles[entityId];
  obj.roles = {};
  if (relatedRole) obj.roles[entityId] = relatedRole;
  if (isPerson(obj)) {
    const relatedInst = obj.institutions[entityId];
    obj.institutions = {};
    if (relatedInst) obj.institutions[entityId] = relatedInst;
    const relatedContact = obj.contact_references[entityId];
    obj.contact_references = {};
    if (relatedContact) obj.contact_references[entityId] = relatedContact;
  } else if (isInstitution(obj)) {
    const relatedAddress = obj.addresses[entityId];
    obj.addresses = {};
    if (relatedAddress) obj.addresses[entityId] = relatedAddress;
    const relatedNote = obj.notes[entityId];
    obj.notes = {};
    if (relatedNote) obj.notes[entityId] = relatedNote;
  }
  return obj as T;
};

const exists = (obj: any) => !!obj;

const resolveInstitution = async (institution: IInstitution, entityId?: string) => {
  if (entityId) institution = removeUnrelatedEntities<IInstitution>(institution, entityId);

  for (const [id, address] of Object.entries(institution.addresses)) {
    // Next line is due to migration 0001
    // Can be removed once all institutions are migrated using 0001
    if (!isUnresolved(address)) continue;
    const resolved = await Entities.resolve<IAddress>(address, 'address');
    if (resolved) institution.addresses[id] = resolved;
    else delete institution.addresses[id];
  }

  return institution;
};

const resolvePerson = async (person: IPerson, entityId?: string) => {
  if (entityId) person = removeUnrelatedEntities<IPerson>(person, entityId);

  for (const [id, contact] of Object.entries(person.contact_references)) {
    // Next line is due to migration 0001
    // Can be removed once all persons are migrated using 0001
    if (!isUnresolved(contact)) continue;
    const resolved = await Entities.resolve<IContact>(contact, 'contact');
    if (resolved) person.contact_references[id] = resolved;
    else delete person.contact_references[id];
  }

  for (const [id, institutions] of Object.entries(person.institutions)) {
    const resolvedInstitutions = await Promise.all(
      (institutions ?? []).map(async i =>
        Entities.resolve<IInstitution>(i, 'institution').then(resolved => {
          if (!resolved) return undefined;
          return resolveInstitution(resolved, entityId);
        }),
      ),
    );
    person.institutions[id] = resolvedInstitutions.filter(i => isInstitution(i)) as IInstitution[];
  }

  return person;
};

const resolveMetaDataEntity = async (entity: IDigitalEntity | IPhysicalEntity) => {
  if (!entity || !entity._id) return entity;

  const _id = entity._id.toString();

  if (entity.persons) {
    for (let i = 0; i < entity.persons.length; i++) {
      const shallow = await Entities.resolve<IPerson>(entity.persons[i], 'person');
      if (!shallow) continue;
      const deep = await resolvePerson(shallow, _id);
      if (!deep) continue;
      entity.persons[i] = removeUnrelatedEntities(deep, _id);

      // @ts-ignore-next-line
      if (!entity.persons[i].roles) {
        // @ts-ignore-next-line
        entity.persons[i].roles = {};
      }
      // @ts-ignore-next-line
      if (!entity.persons[i].roles[_id]) {
        // @ts-ignore-next-line
        entity.persons[i].roles[_id] = [];
      }
    }
  }

  if (entity.institutions) {
    for (let i = 0; i < entity.institutions.length; i++) {
      const shallow = await Entities.resolve<IInstitution>(entity.institutions[i], 'institution');
      if (!shallow) continue;
      const deep = await resolveInstitution(shallow, _id);
      if (!deep) continue;
      entity.institutions[i] = removeUnrelatedEntities(deep, _id);
    }
  }

  return entity;
};

const resolveDigitalEntity = async (digitalEntity: IDigitalEntity) => {
  const entity = (await resolveMetaDataEntity(digitalEntity)) as IDigitalEntity;

  entity.tags = (
    await Promise.all((entity.tags ?? []).map(tag => Entities.resolve<ITag>(tag, 'tag')))
  ).filter(exists) as ITag[];

  if (entity.phyObjs) {
    for (let i = 0; i < entity.phyObjs.length; i++) {
      const resolved = await Entities.resolve<IPhysicalEntity>(entity.phyObjs[i], 'physicalentity');
      if (!resolved) {
        continue;
      }
      entity.phyObjs[i] = (await resolveMetaDataEntity(resolved)) as IPhysicalEntity;
    }
  }

  return entity;
};

const resolveEntity = async (entity: IEntity) => {
  for (const id in entity.annotations) {
    const resolved = await Entities.resolve<IAnnotation>(id, 'annotation');
    if (!resolved) {
      delete entity.annotations[id];
      continue;
    }
    entity.annotations[id] = resolved;
  }

  if (!isDigitalEntity(entity.relatedDigitalEntity)) {
    const resolved = await Entities.resolve<IDigitalEntity>(
      entity.relatedDigitalEntity,
      'digitalentity',
    );
    if (resolved) entity.relatedDigitalEntity = resolved;
  }
  return entity;
};

const resolveCompilation = async (compilation: ICompilation) => {
  for (const id in compilation.entities) {
    const resolved = await Entities.resolve<IEntity>(id, 'entity');
    if (!resolved) {
      delete compilation.entities[id];
      continue;
    }
    compilation.entities[id] = resolved;
  }

  for (const id in compilation.annotations) {
    const resolved = await Entities.resolve<IAnnotation>(id, 'annotation');
    if (!resolved) {
      delete compilation.annotations[id];
      continue;
    }
    compilation.annotations[id] = resolved;
  }

  return compilation;
};

export const Resolve = {
  institution: resolveInstitution,
  person: resolvePerson,
  digitalentity: resolveDigitalEntity,
  entity: resolveEntity,
  compilation: resolveCompilation,
  get: <T extends unknown>(collection: string, ...args: any) =>
    (Resolve as any)[collection]
      ? ((Resolve as any)[collection](...args) as Promise<T | undefined>)
      : undefined,
};
