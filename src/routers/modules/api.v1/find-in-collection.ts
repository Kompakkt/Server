import { t } from 'elysia';
import { Collection, type IUserData } from 'src/common';
import { collectionMap } from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { resolveAny, resolveCompilation, resolveEntity } from './resolving-strategies';

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
      return resolveEntity({ _id: identifier });
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
  const resolved = await Promise.all(docs.map(doc => resolveAny(collection, doc)));
  return resolved.filter(_ => _);
};

export const findAllParams = t.Object({
  collection: t.Enum(Collection),
});
