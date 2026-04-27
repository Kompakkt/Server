import { type Filter, ObjectId } from 'mongodb';
import {
  Collection,
  type IAnnotation,
  type ICompilation,
  type IEntity,
  type IUserData,
  isAnnotation,
} from '@kompakkt/common';
import { annotationCollection, compilationCollection } from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import {
  RESOLVE_FULL_DEPTH,
  resolveAnnotation,
  resolveCompilation,
} from '../api.v1/resolving-strategies';
import { makeUserOwnerOf } from '../user-management/users';
import { log } from 'src/logger';

const asIdQueryArray = (id: string | ObjectId) =>
  [id.toString(), new ObjectId(id)] as [string, ObjectId];

// Query helpers
// TODO: Verify if this is correct after whitelist -> access migration
const userInAccessQuery = async (user: ServerDocument<IUserData>) => {
  // Build query for whitelist containing the user in persons or in groups
  const query: Filter<ServerDocument<IEntity | ICompilation>> = {
    access: { $elemMatch: { _id: { $in: asIdQueryArray(user._id) } } },
  };

  return query;
};

export const countEntityUses = async (
  identifier: string | ObjectId,
  userdata?: ServerDocument<IUserData>,
) => {
  // Build query for:
  // (user is creator || user is whitelisted) && has entity
  const filter: Filter<ServerDocument<ICompilation>> = {};
  if (userdata) {
    filter.$or ??= [];
    filter.$or.push({
      'creator._id': { $in: asIdQueryArray(userdata._id) },
    });
    filter.$or.push(await userInAccessQuery(userdata));
  }
  filter[`entities.${identifier.toString()}`] = { $exists: true };

  const compilations = await compilationCollection
    .find(filter)
    .toArray()
    .catch(err => {
      log('Error counting entity uses', err, filter);
      return [];
    });
  const occurences = compilations.length;

  return { occurences, compilations };
};

export const addAnnotationsToAnnotationList = async ({
  identifier,
  annotationList,
  userdata,
}: {
  identifier: string | ObjectId;
  annotationList: string[];
  userdata: ServerDocument<IUserData>;
}) => {
  const compilation = await compilationCollection.findOne({
    _id: { $in: asIdQueryArray(identifier) },
  });
  if (!compilation) throw new Error('Compilation not found');

  const resolvedList = await Promise.all(
    annotationList.map(aId => resolveAnnotation({ _id: aId }, RESOLVE_FULL_DEPTH)),
  );
  const filteredList = resolvedList.filter((a): a is ServerDocument<IAnnotation> => !!a);
  const correctedList = filteredList.map(ann => {
    ann._id = new ObjectId();
    ann.target.source.relatedCompilation = identifier.toString();
    ann.lastModificationDate = new Date().toISOString();
    return ann;
  });

  const insertResult = await annotationCollection.insertMany(correctedList);
  if (!insertResult || insertResult.insertedCount !== correctedList.length)
    throw new Error('Failed inserting Annotations');

  for (const anno of correctedList) {
    if (!isAnnotation(anno)) continue;
    compilation.annotations[anno._id.toString()] = anno;
  }

  const updateResult = await compilationCollection.updateOne(
    { _id: { $in: asIdQueryArray(identifier) } },
    { $set: { annotations: compilation.annotations } },
  );
  if (!updateResult || updateResult.modifiedCount !== 1)
    throw new Error('Failed updating Compilation');

  // Add Annotations to LDAP user
  makeUserOwnerOf({
    docs: correctedList,
    collection: Collection.annotation,
    userdata: userdata,
  }).catch(err => {
    log('Failed to add Annotations to user ownership after adding to Compilation', err);
  });
  return resolveCompilation({ _id: identifier }, RESOLVE_FULL_DEPTH);
};
