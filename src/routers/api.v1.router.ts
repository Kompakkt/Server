import { Elysia, t } from 'elysia';
import { ObjectId } from 'mongodb';
import {
  Collection,
  EntityAccessRole,
  type IStrippedUserData,
  isAnnotation,
  isInstitution,
  isPerson,
} from 'src/common';
import { isEntitySettings } from 'src/common/typeguards';
import { err, info, log, warn } from 'src/logger';
import { collectionMap, entityCollection, groupCollection, userCollection } from 'src/mongo';
import { exploreCache } from 'src/redis';
import configServer from 'src/server.config';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { MAX_PREVIEW_IMAGE_RESOLUTION, updatePreviewImage } from 'src/util/image-helpers';
import { authService, signInBody } from './handlers/auth.service';
import { PermissionHelper, permissionService } from './handlers/permission.service';
import { deleteAny } from './modules/api.v1/deletion-strategies';
import {
  ExploreRequest,
  exploreCompilations,
  exploreEntities,
} from './modules/api.v1/explore-strategies';
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
      async ({ params, userdata, request, server }) => {
        const result = await findSingleHandler(params, userdata).catch(error => {
          err(
            `Error finding single handler for ${params.collection} ${params.identifier}: ${error}`,
          );
          return undefined;
        });

        if (result && [Collection.entity, Collection.compilation].includes(params.collection)) {
          try {
            increasePopularity(result, params.collection, request, server);
          } catch (error) {
            warn(
              `Failed increasing popularity for ${params.collection} ${params.identifier}: ${error}`,
            );
          }
        }
        return result;
      },
      {
        params: findSingleParams,
        detail: {
          description: 'Find a single entity in a collection by its identifier',
          tags: [RouterTags['API V1']],
        },
      },
    )
    .get(
      '/get/find/:collection/:identifier/:password?',
      ({ params, userdata }) => findSingleHandler(params, userdata),
      {
        params: findSingleParams,
        detail: {
          description:
            'Find a single entity in a collection, and decode it with the provided password',
          tags: [RouterTags['API V1']],
        },
      },
    )
    .get('/get/findall/:collection', ({ params }) => findAll(params), {
      params: findAllParams,
      detail: {
        description: 'Find all entities in a collection',
        tags: [RouterTags['API V1']],
      },
    })
    .get('/get/id', () => new ObjectId(), {
      detail: {
        description: 'Get a new ObjectId',
        tags: [RouterTags['API V1']],
      },
    })
    .post(
      '/post/explore',
      async ({ body, userdata, status }) => {
        const combined = { ...body, userData: userdata ?? undefined };
        return (
          body.searchEntity ? exploreEntities(combined) : exploreCompilations(combined)
        ).catch(error => {
          err(`Error during explore request ${error}`);
          return status(500, 'Internal Server Error');
        });
      },
      {
        body: ExploreRequest,
        detail: {
          description: 'Explore entities or compilations based on search criteria',
          tags: [RouterTags['API V1']],
        },
      },
    )
    .post(
      '/post/remove/:collection/:identifier',
      async ({
        status,
        params: { collection, identifier },
        body: { username, password },
        userdata,
      }) => {
        const _id = ObjectId.isValid(identifier) ? new ObjectId(identifier).toString() : identifier;

        if (!userdata) return status('Not Found');
        const user = await userCollection.findOne({
          _id: new ObjectId(userdata._id),
        });
        if (!user) return status('Not Found');

        if (user.username !== username) {
          err('Entity removal failed due to username & session not matching');
          return status(
            'Forbidden',
            'Input username does not match username with current sessionID',
          );
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
      },
    )
    .guard({ isLoggedIn: true }, app =>
      app
        .get(
          '/get/users',
          () =>
            userCollection
              .find()
              .toArray()
              .then(users => {
                return users.map(
                  ({ _id, username, fullname }) =>
                    ({
                      _id,
                      username,
                      fullname,
                    }) satisfies ServerDocument<IStrippedUserData>,
                );
              }),
          {
            detail: {
              description: 'Get all users with stripped data',
              tags: [RouterTags['API V1']],
            },
          },
        )
        .get('/get/groups', () => groupCollection.find({}).toArray(), {
          detail: {
            description: 'Get all groups',
            tags: [RouterTags['API V1']],
          },
        })
        .post(
          '/post/push/:collection',
          async ({ status, params: { collection }, body, userdata, userRole }) => {
            if (!body || typeof body !== 'object') return status(400);
            if (!userdata) return status(401);
            const isDocument = (obj: unknown): obj is { _id: string } => {
              return typeof obj === 'object' && obj !== null && '_id' in obj;
            };
            if (!isDocument(body)) return status(400);
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
            if (!canProceed) return status('Forbidden');

            const saveResult = await saveHandler({
              collection,
              body,
              userdata,
            }).catch(error => {
              err(error);
              return false;
            });
            if (!saveResult) return status(500);

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
            if (!resolveResult) return status(500);

            exploreCache.flush();

            return resolveResult;
          },
          {
            params: t.Object({
              collection: t.Enum(Collection),
            }),
            body: t.Unknown(),
            detail: {
              description: 'Push an entity to a collection',
              tags: [RouterTags['API V1']],
            },
          },
        )
        .post(
          '/post/settings/:identifier',
          async ({ status, params: { identifier }, body, userdata }) => {
            if (!body || !isEntitySettings(body) || !userdata) return status('Bad Request');
            const preview = body.preview;
            const entity = await entityCollection.findOne({
              _id: new ObjectId(identifier),
            });
            if (!entity) return status(404, 'Entity not found');

            const hasAccess = await (async () => {
              const currentAccess = entity.access?.[userdata._id.toString()];
              const isOwner = await checkIsOwner({
                doc: entity,
                collection: Collection.entity,
                userdata,
              });

              return (
                currentAccess?.role === EntityAccessRole.owner ||
                currentAccess?.role === EntityAccessRole.editor ||
                isOwner
              );
            })();

            if (!hasAccess) return status(403);

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

            if (!result || result.modifiedCount !== 1) return status('Internal Server Error');

            return settings;
          },
          {
            params: t.Object({
              identifier: t.String(),
            }),
            body: t.Unknown(),
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
