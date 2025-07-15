import { t } from 'elysia';
import { Collection, type IUserData } from 'src/common';
import type { IDocument } from 'src/common/interfaces';
import { collectionMap } from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { resolveAny, resolveCompilation, resolveEntity } from './resolving-strategies';
import { checkIsOwner } from '../user-management/users';

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
      const entity = await resolveEntity({ _id: identifier });
      if (!entity) return undefined;
      // Check if user has access to the entity
      // TODO: Remove whitelist after migration to new access system
      const isWhitelistEnabled = entity.whitelist.enabled;
      const entityExistsInUserdata = userdata
        ? await checkIsOwner({
            collection: Collection.entity,
            doc: entity,
            userdata,
          })
        : false;
      const userInAccess = userdata ? entity.access?.[userdata._id.toString()] : undefined;
      const isUserWhitelisted = entity.whitelist.persons
        .concat(entity.whitelist.groups.flatMap(g => g.members))
        .some(p => p._id === userdata?._id.toString());

      const userHasAccess = entityExistsInUserdata || isUserWhitelisted || userInAccess;

      if (entity.online && isWhitelistEnabled) {
        return userHasAccess ? entity : undefined;
      } else if (entity.online && !isWhitelistEnabled) {
        return entity;
      } else if (!entity.online) {
        return userInAccess || entityExistsInUserdata ? entity : undefined;
      }
      return undefined;
    }
    case Collection.compilation: {
      const compilation = await resolveCompilation({ _id: identifier });
      if (!compilation) return undefined;
      const _pw = compilation.password;
      const isPasswordProtected = _pw !== '';
      const isUserOwner = JSON.stringify(userdata ?? {}).includes(identifier);
      const isPasswordCorrect = _pw && _pw === password;

      if (!isPasswordProtected || isUserOwner || isPasswordCorrect) return compilation;

      return undefined;
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
