import { Mongo, updateOne } from '../services/mongo';
import { Configuration } from '../services/configuration';
import { saveAddress, saveContact } from '../services/saving-strategies';
import {
  IPerson,
  IInstitution,
  IContact,
  IAddress,
  IDocument,
  isUnresolved,
} from '../common/interfaces';

(async () => {
  const client = await Mongo.init();
  if (!client) return;
  const db = client.db(Configuration.Mongo.RepositoryDB);
  const persons = db.collection<IPerson>('person');
  const institutions = db.collection<IInstitution>('institution');

  // Institutions
  const instCursor = institutions.find({});
  while (await instCursor.hasNext()) {
    let institution: IInstitution | undefined | null = await instCursor.next();
    if (!institution) continue;
    const { name, notes, roles, addresses } = institution;
    const relatedIds = Array.from(
      new Set([...Object.keys(notes), ...Object.keys(roles), ...Object.keys(addresses)]),
    );

    const needsMigration = !!Object.values(addresses).find(addr => !isUnresolved(addr));
    if (!needsMigration) continue;
    console.log(`Migrating institution ${name}`);
    institution = await Mongo.resolve<IInstitution>(institution, 'institution');
    if (!institution) {
      console.log(`Failed to resolve ${name}. Not migrated.`);
      continue;
    }

    let addressEntry: IAddress | undefined;
    for (const address of Object.values(addresses) as IAddress[]) {
      if (address?.street?.length <= 0) continue;
      if (addressEntry && address.creation_date < addressEntry.creation_date) continue;
      addressEntry = address;
    }

    if (!addressEntry) {
      console.log(`No valid entries found for ${name}`);
      continue;
    }

    const address = await saveAddress(addressEntry);

    institution.addresses = {};
    for (const id of relatedIds) {
      institution.addresses[id] = { _id: address._id };
    }

    const result = await updateOne(
      Mongo.getEntitiesRepository().collection<IInstitution>('institution'),
      Mongo.query(institution._id),
      { $set: institution },
    ).catch(console.log);
    console.log(result ? result.result.ok === 1 : `Failed saving institution ${name}`);
  }

  // Persons
  const personCursor = persons.find({});
  while (await personCursor.hasNext()) {
    let person: IPerson | undefined | null = await personCursor.next();
    if (!person) continue;
    const { name, prename, contact_references, roles, institutions } = person;
    const relatedIds = Array.from(
      new Set([
        ...Object.keys(institutions),
        ...Object.keys(roles),
        ...Object.keys(contact_references),
      ]),
    );

    const needsMigration = !!Object.values(contact_references).find(c => !isUnresolved(c));
    if (!needsMigration) continue;
    console.log(`Migrating person ${prename} ${name}`);
    person = await Mongo.resolve<IPerson>(person, 'person');
    if (!person) {
      console.log(`Failed to resolve ${prename} ${name}. Not migrated.`);
      continue;
    }

    let contactEntry: IContact | undefined;
    for (const contact of Object.values(contact_references) as IContact[]) {
      if (contact?.mail?.length <= 0) continue;
      if (contactEntry && contact.creation_date < contactEntry.creation_date) continue;
      contactEntry = contact;
    }

    for (const [id, institutions] of Object.entries(person.institutions)) {
      person.institutions[id] = institutions
        .filter(i => !!i._id)
        .map(i => ({ _id: i._id.toString() })) as IDocument[];
    }

    person.contact_references = {};
    if (contactEntry) {
      const contact = await saveContact(contactEntry);
      for (const id of relatedIds) {
        person.contact_references[id] = { _id: contact._id };
      }
    } else {
      console.log(`No valid entries found for ${prename} ${name}`);
    }

    const result = await updateOne(
      Mongo.getEntitiesRepository().collection<IPerson>('person'),
      Mongo.query(person._id),
      { $set: person },
    ).catch(console.log);
    console.log(result ? result.result.ok === 1 : `Failed saving ${prename} ${name}`);
  }
})();
