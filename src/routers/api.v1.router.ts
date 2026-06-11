import { Elysia, t } from 'elysia';
import { ObjectId } from 'mongodb';
import {
  Collection,
  EntityAccessRole,
  IAddressSchema,
  IAnnotationSchema,
  ICompilationResolvedSchema,
  ICompilationSchema,
  IContactSchema,
  IDigitalEntitySchema,
  IEntityResolvedSchema,
  IEntitySchema,
  IEntitySettingsSchema,
  IInstitutionResolvedSchema,
  IInstitutionSchema,
  IPersonResolvedSchema,
  IPersonSchema,
  IPhysicalEntitySchema,
  type IStrippedUserData,
  IStrippedUserDataSchema,
  ITagSchema,
  ProfileType,
  UserRank,
  isAnnotation,
  isInstitution,
  isPerson,
} from '@kompakkt/common';
import { isEntitySettings } from '@kompakkt/common';
import { err, info, log, warn } from 'src/logger';
import { collectionMap, entityCollection, userCollection } from 'src/mongo';
import { exploreCache } from 'src/redis';
import configServer from 'src/server.config';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { MAX_PREVIEW_IMAGE_RESOLUTION, updatePreviewImage } from 'src/util/image-helpers';
import { authService, signInBody } from './handlers/auth.service';
import { PermissionHelper, permissionService } from './handlers/permission.service';
import { deleteAny } from './modules/api.v1/deletion-strategies';
import {
  findAll,
  findAllParams,
  findSingleHandler,
  findSingleParams,
} from './modules/api.v1/find-in-collection';
import { resolveAny } from './modules/api.v1/resolving-strategies';
import { saveHandler } from './modules/api.v1/save-to-collection';
import { increasePopularity } from './modules/api.v2/increase-popularity';
import { checkIsOwner, makeUserOwnerOf } from './modules/user-management/users';
import { RouterTags } from './tags';
import type { AccessField, AccessFieldEntry, CreatorField } from '@kompakkt/common';
import { AllCollectionsSchemaUnion } from 'src/types/schema-unions';

/**
 * If the entity already exists we need to check for owner status
 * We skip this for annotations, since annotation ranking can be changed by owner
 * We check this in the saving strategy instead
 * We also skip this for persons and institutions since their nested content
 * (addresses, contact_references, etc.) can also be updated
 */
const isEditableType = (_e: unknown) => isAnnotation(_e) || isPerson(_e) || isInstitution(_e);

const apiV1Router = new Elysia().use(configServer).group('/api/v1', app =>
  app
    .use(authService)
    .use(permissionService)
    .get(
      '/get/find/:collection/:identifier',
      async ({ params, userdata, request, server, status }) => {
        try {
          const result = await findSingleHandler(params, userdata).catch(error => {
            err(
              `Error finding single handler for ${params.collection} ${params.identifier}: ${error}`,
            );
            return undefined;
          });

          const validCollection =
            params.collection === Collection.entity || params.collection === Collection.compilation;
          if (result && validCollection) {
            try {
              void increasePopularity(result, params.collection, request, server);
            } catch (error) {
              warn(
                `Failed increasing popularity for ${params.collection} ${params.identifier}: ${error}`,
              );
            }
          }
          return result;
        } catch (error) {
          err(
            `Error in find single endpoint for ${params.collection} ${params.identifier}: ${error}`,
          );
          return status(500, 'Internal server error');
        }
      },
      {
        params: findSingleParams,
        detail: {
          description: 'Find a single entity in a collection by its identifier',
          tags: [RouterTags['API V1']],
        },
        response: {
          // While the findSingleHandler theoretically always tries to resolve, on initial upload the relatedDigitalEntity might not exist yet
          // Important: Resolved schema needs to precede unresolved schema, otherwise the resolved properties will be omitted
          200: t.Union([
            t.Undefined(),
            IEntityResolvedSchema,
            IEntitySchema,
            ICompilationResolvedSchema,
            ICompilationSchema,
          ]),
          500: t.Any(),
        },
      },
    )
    .get(
      '/get/findall/:collection',
      async ({ params, status }) => {
        const result = await findAll(params).catch(err => {
          info('Failed getting all documents of collection', { params, err });
          return undefined;
        });
        if (!result) {
          return status(500, 'Internal server error');
        }
        return result;
      },
      {
        params: findAllParams,
        detail: {
          description: 'Find all documents in a collection',
          tags: [RouterTags['API V1']],
        },
        response: {
          200: t.Union([
            t.Array(IPersonResolvedSchema, {
              title: 'IPerson[] fully resolved',
            }),
            t.Array(IInstitutionResolvedSchema, {
              title: 'IInstitution[] fully resolved',
            }),
            t.Array(ITagSchema, {
              title: 'ITag[]',
            }),
          ]),
          500: t.Any(),
        },
      },
    )
    .get(
      '/get/id',
      () => {
        return new ObjectId().toString();
      },
      {
        detail: {
          description: 'Get a new ObjectId',
          tags: [RouterTags['API V1']],
        },
        response: {
          200: t.String(),
        },
      },
    )
    .post(
      '/post/explore',
      async ({ status }) => {
        return status(
          410,
          'This endpoint is deprecated. Please use the API V2 Explore endpoint instead.',
        );
      },
      {
        body: t.Object({}),
        detail: {
          description:
            'Deprecation notice: This endpoint will be removed in the future. Switch to the API V2 Explore endpoint. Explore entities or compilations based on search criteria',
          deprecated: true,
          tags: [RouterTags['API V1']],
        },
        response: {
          410: t.Any(),
        },
      },
    )
    .post(
      '/post/remove/:collection/:identifier',
      async ({ status, params: { collection, identifier }, body: { username }, userdata }) => {
        const _id = ObjectId.isValid(identifier) ? new ObjectId(identifier).toString() : identifier;

        if (!userdata) return status(403, 'User not authenticated');
        const user = await userCollection.findOne({
          _id: new ObjectId(userdata._id),
        });
        if (!user) return status(404, 'Not Found');

        if (user.username !== username) {
          err('Entity removal failed due to username & session not matching');
          return status(403, 'Input username does not match username with current sessionID');
        }

        const success = await deleteAny({ _id, collection, userdata });
        if (!success) {
          const message = 'Entity removal failed';
          err(message);
          return status(500, message);
        }

        // entitiesCache.flush();

        const message = `Deleted ${collection} ${identifier}`;
        info(message);
        return { status: 'OK', message };
      },
      {
        params: t.Object({
          collection: t.Enum(Collection),
          identifier: t.String(),
        }),
        body: signInBody,
        verifyLoginData: true,
        hasRole: EntityAccessRole.owner,
        detail: {
          description: 'Remove an entity from a collection',
          tags: [RouterTags['API V1']],
        },
        response: {
          200: t.Object({ status: t.Literal('OK'), message: t.String() }),
          403: t.Any(),
          404: t.Any(),
          500: t.Any(),
        },
      },
    )
    .guard({ isLoggedIn: true }, app =>
      app
        .get(
          '/get/users',
          () => {
            return userCollection
              .aggregate<CreatorField>([
                {
                  $project: {
                    _id: { $toString: '$_id' },
                    username: 1,
                    fullname: 1,
                    profile: {
                      $first: {
                        $filter: {
                          input: '$profiles',
                          as: 'p',
                          cond: { $eq: ['$$p.type', ProfileType.user] },
                        },
                      },
                    },
                  },
                },
              ])
              .toArray();
          },
          {
            detail: {
              description: 'Get all users with stripped data',
              tags: [RouterTags['API V1']],
            },
            response: {
              200: t.Array(
                t.Intersect([
                  IStrippedUserDataSchema,
                  t.Object({
                    profile: t.Object({
                      type: t.Enum(ProfileType),
                      profileId: t.String(),
                    }),
                  }),
                ]),
              ),
            },
          },
        )
        .post(
          '/post/push/:collection',
          async ({ status, params: { collection }, body, userdata, userRole }) => {
            if (!body || typeof body !== 'object')
              return status(400, 'Body must be a non-null object');
            if (!userdata) return status(401, 'User not authenticated');
            const isDocument = (obj: unknown): obj is { _id: string } => {
              return typeof obj === 'object' && obj !== null && '_id' in obj;
            };
            if (!isDocument(body)) return status(400, 'Body must be an object with an _id field');
            const _id = body._id;
            const isValidObjectId = ObjectId.isValid(_id);
            const doesEntityExist = await (async () => {
              if (!isValidObjectId) return false;
              const result = await collectionMap[collection]?.findOne({
                _id: new ObjectId(_id),
              });
              return !!result;
            })();

            const canProceed = await (async (): Promise<boolean> => {
              // Creation always allowed here
              if (!doesEntityExist) return true;
              // Editable types can be edited by anyone
              if (isEditableType(body)) return true;
              const isLegacyOwner = PermissionHelper.isUserLegacyOwner(body, userdata);
              log(
                `Checking if user is owner of ${body._id} to ${collection}: { role: ${userRole}, isLegacyOwner: ${isLegacyOwner} }`,
              );
              // Owner can always edit
              if (isLegacyOwner) return true;
              if (userRole === EntityAccessRole.owner) return true;
              // Editors can edit certain collections
              if (
                PermissionHelper.isEditorCollection(collection) &&
                userRole === EntityAccessRole.editor
              )
                return true;

              if (collection === Collection.digitalentity) {
                // For digital entities, we allow editing if the user is an editor of the parent entity
                const parentEntity = await entityCollection.findOne({
                  'relatedDigitalEntity._id': { $in: [_id.toString(), new ObjectId(_id)] },
                });
                const hasParentPermission = PermissionHelper.isUserMinimumRole(
                  parentEntity,
                  userdata,
                  EntityAccessRole.editor,
                );
                log(
                  `User has parent entity editor permission: ${hasParentPermission}, { parentEntity: ${parentEntity?._id} }`,
                );
                if (hasParentPermission) return true;
              }

              return false;
            })();
            if (!canProceed)
              return status(403, 'User does not have permission to edit this document');

            const saveResult = await saveHandler({
              collection,
              body,
              userdata,
            }).catch(error => {
              err(error);
              return false;
            });
            if (!saveResult) return status(500, 'Failed saving document');

            if (!doesEntityExist) {
              log(`Making user owner of ${body._id} to ${collection}`);
              await makeUserOwnerOf({ docs: body, collection, userdata }).catch(error => {
                err(`Error making user owner of ${body._id} to ${collection}`, error);
              });
            }

            const resolveResult = await resolveAny(collection, {
              _id: body._id,
            }).catch(error => {
              err(error);
              return undefined;
            });
            if (!resolveResult) return status(500, 'Failed resolving saved document');

            void exploreCache.flush();

            return resolveResult;
          },
          {
            params: t.Object({
              collection: t.Enum(Collection),
            }),
            body: t.Partial(AllCollectionsSchemaUnion),
            detail: {
              description: 'Push an entity to a collection',
              tags: [RouterTags['API V1']],
            },
            response: {
              200: AllCollectionsSchemaUnion,
              400: t.Any(),
              401: t.Any(),
              403: t.Any(),
              500: t.Any(),
            },
          },
        )
        .post(
          '/post/settings/:identifier',
          async ({ status, params: { identifier }, body, userdata }) => {
            if (!userdata) return status(401, 'User not authenticated');
            if (!body || !isEntitySettings(body)) return status(400, 'Invalid body');
            const preview = body.preview;
            const entity = await entityCollection.findOne({
              _id: new ObjectId(identifier),
            });
            if (!entity) return status(404, 'Entity not found');

            const hasAccess = await (async () => {
              const currentAccess = entity.access.find(
                user => user._id === userdata._id.toString(),
              );
              const isOwner = await checkIsOwner({
                doc: entity,
                collection: Collection.entity,
                userdata,
              });

              const isAdmin = userdata.role === UserRank.admin;

              return (
                currentAccess?.role === EntityAccessRole.owner ||
                currentAccess?.role === EntityAccessRole.editor ||
                isOwner ||
                isAdmin
              );
            })();

            if (!hasAccess) return status(403, 'User does not have permission to edit this entity');

            // Save preview to file, if not yet done
            const finalImagePath = await updatePreviewImage(
              preview,
              'entity',
              entity._id.toString(),
              MAX_PREVIEW_IMAGE_RESOLUTION,
            );

            // Overwrite old settings
            const settings = { ...body, preview: finalImagePath };
            const result = await entityCollection.updateOne(
              { _id: new ObjectId(entity._id.toString()) },
              { $set: { settings: { ...entity.settings, ...settings } } },
            );

            if (!result || result.modifiedCount !== 1) return status(500, 'Internal Server Error');

            return settings;
          },
          {
            params: t.Object({
              identifier: t.String(),
            }),
            body: t.Partial(IEntitySettingsSchema),
            response: {
              200: IEntitySettingsSchema,
              400: t.Any(),
              401: t.Any(),
              403: t.Any(),
              404: t.Any(),
              500: t.Any(),
            },
            detail: {
              description: 'Update settings of an entity',
              tags: [RouterTags['API V1']],
            },
            isLoggedIn: true,
          },
        ),
    ),
);

export default apiV1Router;
