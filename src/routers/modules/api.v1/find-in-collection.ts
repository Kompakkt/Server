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
  {
    collection,
    identifier,
    password,
  }: {
    collection: Collection;
    identifier: string;
    password?: string;
  },
  userdata: ServerDocument<IUserData> | undefined,
) => {
  switch (collection) {
    case Collection.entity: {
      const entity = await resolveEntity({ _id: identifier }, RESOLVE_FULL_DEPTH);
      if (!entity) return undefined;
      // Check if user has access to the entity
      const entityExistsInUserdata = userdata
        ? await checkIsOwner({
            collection: Collection.entity,
            doc: entity,
            userdata,
          })
        : false;
      const userInAccess = userdata
        ? entity.access.find(user => user._id === userdata._id.toString())
        : undefined;
      const isAdmin = userdata?.role === UserRank.admin;

      const userHasAccess = isAdmin || entityExistsInUserdata || !!userInAccess;
      if (isAdmin && !entity.online)
        log(`Admin ${userdata.username} requested access to ${entity._id.toString()}`);

      if (entity.online) {
        return entity;
      } else {
        return userHasAccess ? entity : undefined;
      }
    }
    case Collection.compilation: {
      const compilation = await resolveCompilation({ _id: identifier }, RESOLVE_FULL_DEPTH);
      if (!compilation) return undefined;
      const _pw = compilation.password;
      const isPasswordProtected = _pw !== '';
      // Deprecate password access. We do not reveal these compilations at all anymore.
      // May change in the future, but for now this is the safest way to handle this without breaking existing passwords and without revealing protected compilations at all.
      if (isPasswordProtected) return undefined;

      return compilation;
    }
    default: {
      return undefined;
    }
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
