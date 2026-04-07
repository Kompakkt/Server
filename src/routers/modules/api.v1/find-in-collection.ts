import { t } from 'elysia';
import { Collection, UserRank, type IUserData } from '@kompakkt/common';
import type { IDocument } from '@kompakkt/common/interfaces';
import { collectionMap } from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import {
  RESOLVE_FULL_DEPTH,
  resolveAny,
  resolveCompilation,
  resolveEntity,
} from './resolving-strategies';
import { checkIsOwner } from '../user-management/users';
import { log } from 'src/logger';

export const findSingleHandler = async (
  {    collection,    identifier,  }: {    collection: Collection;    identifier: string;  },
  userdata: ServerDocument<IUserData> | undefined,
) => {
  if (collection !== Collection.entity && collection !== Collection.compilation) {
    return undefined;
  }

  const doc = collection === Collection.entity ? await resolveEntity({ _id: identifier }, RESOLVE_FULL_DEPTH) : await resolveCompilation({ _id: identifier }, RESOLVE_FULL_DEPTH);
  if (!doc) return undefined;
  // Check if user has access to the entity
  const existsInUserdata = userdata
    ? await checkIsOwner({        collection,        doc,        userdata,      })
    : false;
  const userInAccess = userdata
    ? // Hotfix: Some entities do not have an access field yet due to migration issues.
      Array.isArray(doc.access)
      ? doc.access.find(user => user._id === userdata._id.toString())
      : undefined
    : undefined;
  const isAdmin = userdata?.role === UserRank.admin;

  const userHasAccess = isAdmin || existsInUserdata || !!userInAccess;
  if (isAdmin && !doc.online)
    log(`Admin ${userdata.username} requested access to ${doc._id.toString()}`);

  if (doc.online) {
    return doc;
  } else {
    return userHasAccess ? doc : undefined;
  }
};

export const findSingleParams = t.Object({
  collection: t.Enum(Collection),
  identifier: t.String(),
  password: t.Optional(t.String()),
});

export const findAll = async ({ collection }: { collection: Collection }) => {
  const allowed = [Collection.person, Collection.institution, Collection.tag];
  if (!allowed.includes(collection)) return [];

  const docs = await collectionMap[collection].find({}).toArray();
  const resolved = await Promise.all(docs.map(doc => resolveAny(collection, doc))).then(arr =>
    arr.filter((v): v is ServerDocument<IDocument> => !!v),
  );

  return resolved;
};

export const findAllParams = t.Object({
  collection: t.Enum(Collection),
});
