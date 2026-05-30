import { IContact, isContact, type IPerson } from '@kompakkt/common';
import { personCollection } from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { RESOLVE_FULL_DEPTH, resolvePerson } from '../api.v1/resolving-strategies';
import { log } from 'src/logger';

export const combinePersons = async () => {
  const persons = await personCollection
    .find({})
    .toArray()
    .then(documents => Promise.all(documents.map(doc => resolvePerson(doc, RESOLVE_FULL_DEPTH))))
    .then(persons => persons.filter((v): v is ServerDocument<IPerson> => !!v));

  const groupedByContactRef: Record<string, ServerDocument<IPerson>[]> = {};
  for (const person of persons) {
    if (!person) continue;
    const contactRefs = Object.values(person.contact_references)
      .filter((ref): ref is IContact => isContact(ref) && ref.mail.trim().length > 0)
      .map(ref => person.prename + person.name + ref.mail + ref.phonenumber + ref.note);
    for (const ref of contactRefs) {
      if (!groupedByContactRef[ref]) {
        groupedByContactRef[ref] = [person];
      } else {
        groupedByContactRef[ref].push(person);
      }
    }
  }

  log(`combinePersons
Potential savings by combining persons by contact references:
before ${persons.length}, after ${Object.keys(groupedByContactRef).length}
    `);

  return groupedByContactRef;
};
