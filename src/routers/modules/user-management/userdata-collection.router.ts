// This router replaces a previously more generic route approach for the benefit of being strongly typed per collection

import {
  Collection,
  IAddressSchema,
  IAnnotationSchema,
  ICompilationResolvedOnlyEntitiesSchema,
  ICompilationResolvedSchema,
  ICompilationSchema,
  IContactSchema,
  IDigitalEntityResolvedSchema,
  IDigitalEntitySchema,
  IEntityResolvedOnlyDigitalEntitySchema,
  IEntityResolvedSchema,
  IEntitySchema,
  IInstitutionResolvedSchema,
  IInstitutionSchema,
  IPersonResolvedSchema,
  IPersonSchema,
  IPhysicalEntityResolvedSchema,
  IPhysicalEntitySchema,
  isAddress,
  isAnnotation,
  isCompilation,
  isContact,
  isDigitalEntity,
  isEntity,
  isInstitution,
  isPerson,
  isPhysicalEntity,
  isTag,
  ITagSchema,
  type IDocument,
  type IUserData,
  type UserDataCollectionDocumentType,
} from '@kompakkt/common';
import Elysia, { ElysiaCustomStatusResponse, status, t, type DocumentDecoration } from 'elysia';
import { authService } from 'src/routers/handlers/auth.service';
import { RouterTags } from 'src/routers/tags';
import configServer from 'src/server.config';
import { RESOLVE_FULL_DEPTH } from '../api.v1/resolving-strategies';
import { resolveUserDocument } from './users';
import { compilationCollection, entityCollection } from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';

/**
 * Resolves documents of a specific collection associated with the user through both direct association in userdata and access permissions, with an optional depth for nested document resolution.
 */
const resolveUserDataCollection = async <
  C extends Collection,
  T extends UserDataCollectionDocumentType<C>,
>(
  collection: C,
  userdata: ServerDocument<IUserData> | undefined,
  options: { depth?: number; profileId?: string },
  guard: (obj: unknown) => obj is T,
): Promise<
  T[] | ElysiaCustomStatusResponse<403, string> | ElysiaCustomStatusResponse<500, string>
> => {
  const profileId = options.profileId;
  const depth = options.depth ?? 0;

  const user = structuredClone(userdata);
  if (!user) return status(500, 'Failed to retrieve user data');
  if (profileId && !user.profiles.some(profile => profile.profileId === profileId)) {
    return status(403, 'You do not have access to the requested profile data');
  }

  const fromUserData = (async () => {
    if (profileId) return [];
    const data = user.data[collection] ?? [];
    const resolved = await Promise.all(
      Array.from(new Set(data)).map(docId => resolveUserDocument(docId, collection, depth)),
    );
    const filtered = resolved.filter((obj): obj is IDocument => !!obj && obj !== undefined);
    return filtered;
  })();

  const fromAccess = (async () => {
    const documents =
      collection === Collection.entity
        ? await entityCollection.find({ 'access.profile.profileId': profileId }).toArray()
        : collection === Collection.compilation
          ? await compilationCollection.find({ 'access.profile.profileId': profileId }).toArray()
          : [];
    const resolved = await Promise.all(
      documents.map(entity => resolveUserDocument(entity._id, collection, depth)),
    );
    return resolved.filter((obj): obj is IDocument => !!obj && obj !== undefined);
  })();

  return await Promise.all([fromUserData, fromAccess]).then(results =>
    results.flat().filter(v => guard(v)),
  );
};

const userDataRouterQuerySchema = t.Object({
  full: t.Optional(
    t.Boolean({
      description: 'If true, deeply resolves documents of the requested collection',
    }),
  ),
  depth: t.Optional(
    t.Number({
      description:
        'If provided, specifies the depth to which documents should be resolved. Will override "full" if set.',
    }),
  ),
  profileId: t.Optional(
    t.String({
      description: 'If provided, retrieves documents associated with a specific user profile ID',
    }),
  ),
});
const userDataRouterDetail: DocumentDecoration = {
  description:
    'Retrieves user data from the specified collection, resolving document IDs to full documents if requested.',
  tags: [RouterTags['API V2']],
};

const configuration = {
  [Collection.address]: {
    guard: isAddress,
    schema: IAddressSchema,
  },
  [Collection.annotation]: {
    guard: isAnnotation,
    schema: IAnnotationSchema,
  },
  [Collection.compilation]: {
    guard: isCompilation,
    schema: ICompilationSchema,
  },
  [Collection.contact]: {
    guard: isContact,
    schema: IContactSchema,
  },
  [Collection.digitalentity]: {
    guard: isDigitalEntity,
    schema: IDigitalEntitySchema,
  },
  [Collection.entity]: {
    guard: isEntity,
    schema: IEntitySchema,
  },
  [Collection.institution]: {
    guard: isInstitution,
    schema: IInstitutionSchema,
  },
  [Collection.person]: {
    guard: isPerson,
    schema: IPersonSchema,
  },
  [Collection.physicalentity]: {
    guard: isPhysicalEntity,
    schema: IPhysicalEntitySchema,
  },
  [Collection.tag]: {
    guard: isTag,
    schema: ITagSchema,
  },
} as const;

export const userDataCollectionRouter = new Elysia().use(configServer).use(authService);

for (const [collection, { guard, schema }] of Object.entries(configuration)) {
  userDataCollectionRouter.get(
    `/${collection}`,
    async obj => {
      const result = await resolveUserDataCollection(
        collection as Collection,
        obj.userdata,
        {
          profileId: obj.query.profileId,
          depth: obj.query.full ? RESOLVE_FULL_DEPTH : obj.query.depth,
        },
        // @ts-expect-error - The guards are correctly hardcoded to match the schema, but creating a type to automatically infer this is complex and not worth the effort at the moment
        guard,
      );
      if ('code' in result) return obj.status(result.code, result.response);
      return result;
    },
    {
      isLoggedIn: true,
      detail: userDataRouterDetail,
      query: userDataRouterQuerySchema,
      response: {
        200: t.Array(schema),
        403: t.Any(),
        500: t.Any(),
      },
    },
  );
}
