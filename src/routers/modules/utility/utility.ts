import {
  Collection,
  isAnnotation,
  type IAnnotation,
  type ICompilation,
  type IEntity,
  type IStrippedUserData,
  type IUserData,
} from 'src/common';
import { ObjectId, type Filter } from 'mongodb';
import {
  annotationCollection,
  compilationCollection,
  entityCollection,
  groupCollection,
  userCollection,
} from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import type { Server } from 'http';
import {
  resolveAnnotation,
  resolveCompilation,
  resolveEntity,
} from '../api.v1/resolving-strategies';
import { makeUserOwnerOf, undoUserOwnerOf } from '../user-management/users';

// Query helpers
// TODO: This can be cached without trouble
const userInWhitelistQuery = async (user: ServerDocument<IUserData>) => {
  // Get groups containing the user
  const groups = await groupCollection.find(userInGroupQuery(user)).toArray();

  // Build query for whitelist containing the user in persons or in groups
  const query: Filter<ServerDocument<ICompilation>> = {
    'whitelist.enabled': { $eq: true },
    '$or': [
      { 'whitelist.persons': { $elemMatch: { _id: { $in: [user._id, new ObjectId(user._id)] } } } },
    ],
  };
  if (groups && groups.length > 0) {
    const groupQuery = {
      $elemMatch: { _id: { $in: groups.flatMap(g => [g._id, new ObjectId(g._id)]) } },
    };
    query.$or!.push({ 'whitelist.groups': groupQuery });
  }

  return query;
};

const userInGroupQuery = (userdata: ServerDocument<IUserData>) => {
  const _idQuery = [userdata._id, new ObjectId(userdata._id)];
  return {
    $or: [
      { 'creator._id': { $in: _idQuery } },
      { members: { $elemMatch: { _id: { $in: _idQuery } } } },
      { owners: { $elemMatch: { _id: { $in: _idQuery } } } },
    ],
  };
};

export const findEntityOwnersQuery = async (
  _id: string | ObjectId,
): Promise<ServerDocument<IStrippedUserData>[]> => {
  const accounts = await userCollection
    .find({ 'data.entity': { $in: [_id, new ObjectId(_id)] } })
    .toArray();
  return accounts.map(({ _id, username, fullname }) => ({
    _id,
    username,
    fullname,
  }));
};

export const countEntityUses = async (
  identifier: string | ObjectId,
  userdata?: ServerDocument<IUserData>,
) => {
  // Build query for:
  // (Not password protected || user is creator || user is whitelisted) && has entity
  const filter: Filter<ServerDocument<ICompilation>> = { $or: [{ password: { $eq: '' } }] };
  if (userdata) {
    filter.$or!.push({ 'creator._id': { $in: [userdata._id, new ObjectId(userdata._id)] } });
    filter.$or!.push(await userInWhitelistQuery(userdata));
  }
  filter[`entities.${identifier.toString()}`] = { $exists: true };

  const result = await compilationCollection.find(filter).toArray();
  const compilations = result.map(compilation => ({
    ...compilation,
    password: !!compilation.password,
  }));
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
    _id: { $in: [identifier, new ObjectId(identifier)] },
  });
  if (!compilation) throw new Error('Compilation not found');

  const resolvedList = await Promise.all(
    annotationList.map(aId => resolveAnnotation({ _id: aId })),
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
    {
      _id: { $in: [identifier, new ObjectId(identifier)] },
    },
    {
      $set: { annotations: compilation.annotations },
    },
  );
  if (!updateResult || updateResult.modifiedCount !== 1)
    throw new Error('Failed updating Compilation');

  // Add Annotations to LDAP user
  makeUserOwnerOf({
    docs: correctedList,
    collection: Collection.annotation,
    userdata: userdata,
  });
  return resolveCompilation({ _id: identifier });
};

export enum Command {
  add = 'add',
  remove = 'remove',
}

export const applyActionToEntityOwner = async ({
  command,
  otherUsername,
  entityId,
  userdata,
}: {
  entityId: string | ObjectId;
  command: Command;
  otherUsername: string;
  userdata: ServerDocument<IUserData>;
}) => {
  const entity = await resolveEntity({ _id: new ObjectId(entityId) });
  if (!entity) throw new Error('Entity not found');

  const isUserOwner = userdata.data.entity?.includes(entityId.toString());
  if (!isUserOwner) throw new Error('User is not an owner of the entity');

  const otherUser = await userCollection.findOne({ username: otherUsername });
  if (!otherUser) throw new Error('User not found by username');

  otherUser.data.entity = otherUser.data.entity?.filter(_ => _) ?? [];

  if (command === 'remove') {
    const entityUses = (await findEntityOwnersQuery(entityId)).length;
    if (entityUses <= 1) throw new Error('Cannot remove last owner');
  }

  const changed = await (async () => {
    switch (command) {
      case Command.add: {
        return await makeUserOwnerOf({
          docs: entity,
          collection: Collection.entity,
          userdata: otherUser,
        });
      }
      case Command.remove: {
        return await undoUserOwnerOf({
          docs: entity,
          collection: Collection.entity,
          userdata: otherUser,
        });
      }
    }
  })();

  return { changed };
};

export const findUserInGroups = async (userdata: ServerDocument<IUserData>) => {
  const groups = await groupCollection.find(userInGroupQuery(userdata)).toArray();
  return groups;
};

export const findUserInCompilations = async (userdata: ServerDocument<IUserData>) => {
  // Only show compilations where the user is in the whitelist
  const filter = await userInWhitelistQuery(userdata);
  const compilations = await compilationCollection.find(filter).toArray();
  if (!compilations) return [];

  const resolved = await Promise.all(
    compilations.map(comp => resolveCompilation({ _id: new ObjectId(comp._id) })),
  );
  const filtered = resolved.filter(_ => _) as ServerDocument<ICompilation>[];

  return filtered.map(comp => ({
    ...comp,
    password: !!comp.password,
  }));
};

export const findUserInMetadata = async (userdata: ServerDocument<IUserData>) => {
  const entities = await entityCollection.find({}).toArray();

  const resolvedEntities = (
    await Promise.all(entities.map(e => resolveEntity({ _id: new ObjectId(e._id) })))
  ).filter(entity => {
    if (!entity) return false;
    const stringified = JSON.stringify(entity.relatedDigitalEntity);
    return stringified.includes(userdata.fullname) || stringified.includes(userdata.mail);
  });

  return resolvedEntities;
};
