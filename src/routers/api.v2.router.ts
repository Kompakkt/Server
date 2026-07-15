import { Elysia, t } from 'elysia';
import { collectionMap, compilationCollection, entityCollection, userCollection } from 'src/mongo';
import configServer from 'src/server.config';
import { authService } from './handlers/auth.service';
import {
  Collection,
  EntityAccessRole,
  ProfileType,
  IEntitySchema,
  ICompilationSchema,
  ICompilationResolvedOnlyEntitiesSchema,
} from '@kompakkt/common';
import { makeUserOwnerOf, undoUserOwnerOf } from './modules/user-management/users';
import { resolveEntity, resolveCompilation } from './modules/api.v1/resolving-strategies';
import type { CreatorField, ICompilation } from '@kompakkt/common';
import { ObjectId } from 'mongodb';
import { info, warn } from 'src/logger';
import { RouterTags } from './tags';
import { exploreHandler } from './modules/api.v2/explore';
import { ExploreRequest } from './modules/api.v2/types';
import { PermissionHelper, permissionService } from './handlers/permission.service';
import { searchCache } from 'src/redis';
import { saveHandler } from './modules/api.v1/save-to-collection';
import { deleteAny } from './modules/api.v1/deletion-strategies';
import { userDataCollectionRouter } from './modules/user-management/userdata-collection.router';
import { profileRouter } from './modules/user-management/profile.router';

const apiV2Router = new Elysia().use(configServer).group('/api/v2', app =>
  app
    .use(authService)
    .use(permissionService)
    .group('/profile', app => app.use(profileRouter))
    .group('/user-data/get-collection', app => app.use(userDataCollectionRouter))
    .post(
      '/user-data/update-entity-access',
      async ({ status, body: { _id: entityId, access }, userdata }) => {
        if (!userdata) return status(401, 'User not authenticated');
        const userProfile = userdata.profiles.find(profile => profile.type === ProfileType.user);
        if (!userProfile) return status(403, 'User profile not found in userdata');
        const entity = await entityCollection.findOne({ _id: new ObjectId(entityId) });
        if (!entity) return status(404, 'Entity not found');

        // Fallback to userdata check if no access exists yet
        // TODO: What happens if multiple users are owners only in userdata?
        if (!entity.access) {
          const entityExistsInUserdata = userdata.data.entity?.find(
            id => !!id && (typeof id === 'string' ? true : !!id?._id),
          );
          if (!entityExistsInUserdata) {
            return status(400, 'Entity not found in user data');
          }
          entity.access = [
            {
              _id: userdata._id.toString(),
              fullname: userdata.fullname,
              username: userdata.username,
              role: EntityAccessRole.owner, // Default to owner if no access exists
              profile: userProfile,
            },
          ];
        }

        // Check if access update is valid (at least one owner, and user must currently be owner)
        // Is user owner?
        const currentAccess = entity.access.find(user => user._id === userdata._id.toString());
        if (!currentAccess || currentAccess.role !== EntityAccessRole.owner) {
          return status(403, 'You must be an owner to update access');
        }

        // Ensure at least one owner remains
        const hasOneOwner = access.find(user => user.role === EntityAccessRole.owner);
        if (!hasOneOwner) {
          return status(400, 'At least one owner must remain');
        }

        // User remains owner in update?
        const userRemainsOwner =
          access.find(user => user._id === userdata._id.toString())?.role ===
          EntityAccessRole.owner;
        if (!userRemainsOwner) {
          return status(403, 'You must remain an owner to update access');
        }

        const updateResult = await entityCollection.updateOne(
          { _id: new ObjectId(entityId) },
          { $set: { access } },
        );

        if (updateResult.modifiedCount === 0) {
          return status(500, 'Failed to update entity access');
        }

        // Return the updated entity
        const updatedEntity = await entityCollection.findOne({ _id: new ObjectId(entityId) });
        if (!updatedEntity) {
          return status(404, 'Updated entity not found');
        }

        return updatedEntity;
      },
      {
        isLoggedIn: true,
        response: {
          200: IEntitySchema,
          400: t.Any(),
          401: t.Any(),
          403: t.Any(),
          404: t.Any(),
          500: t.Any(),
        },
        body: t.Pick(IEntitySchema, ['_id', 'access']),
        detail: {
          description:
            'Updates the access permissions for an entity, ensuring at least one owner remains.',
          tags: [RouterTags['API V2']],
        },
      },
    )
    .post(
      '/user-data/transfer-ownership',
      async ({ body, status, userdata }) => {
        if (!userdata) return status(401, 'User not authenticated');
        const docId = 'entityId' in body ? body.entityId : body.docId;
        const collection = 'collection' in body ? body.collection : Collection.entity;
        if (collection !== Collection.entity && collection !== Collection.compilation)
          return status(
            400,
            `Invalid collection type. Only "${Collection.entity}" and "${Collection.compilation}" are supported.`,
          );

        const dbCollection = collectionMap[collection] as
          | typeof entityCollection
          | typeof compilationCollection;
        const entity = await dbCollection.findOne({ _id: new ObjectId(docId) });
        if (!entity) return status(404, 'Entity not found');

        const targetUserId = body.targetUserId;
        const targetOwner = await userCollection.findOne({ _id: new ObjectId(targetUserId) });
        const targetOwnerProfile = targetOwner?.profiles.find(
          profile => profile.type === ProfileType.user,
        );
        if (!targetOwner || !targetOwnerProfile)
          return status(404, 'Target user or profile not found');

        // Ensure the current user is the owner
        const isOwner = entity.access?.length
          ? entity.access.find(user => user._id === userdata._id.toString())?.role ===
            EntityAccessRole.owner
          : (userdata.data.entity?.some(
              other => docId === (typeof other === 'string' ? other : other?._id?.toString()),
            ) ?? false);
        if (!isOwner) return status(403, 'You must be an owner to transfer ownership');

        // Add/set the target user as owner
        const targetUserIndex = entity.access.findIndex(user => user._id === targetUserId);
        if (targetUserIndex >= 0) {
          entity.access[targetUserIndex].role = EntityAccessRole.owner;
        } else {
          entity.access.push({
            _id: targetOwner._id.toString(),
            fullname: targetOwner.fullname,
            username: targetOwner.username,
            role: EntityAccessRole.owner,
            profile: targetOwnerProfile,
          });
        }

        // Remove the current user as owner
        const currentOwnerIndex = entity.access.findIndex(
          user => user._id === userdata._id.toString(),
        );
        if (currentOwnerIndex >= 0) {
          entity.access.splice(currentOwnerIndex, 1);
        } else {
          return status(
            500,
            'Current user not found in entity access list, cannot remove ownership',
          );
        }

        // Legacy: swap owner in userdata
        const legacyOwnerResults = await Promise.allSettled([
          makeUserOwnerOf({
            collection,
            docs: [entity],
            userdata: targetOwner,
          }),
          undoUserOwnerOf({
            collection,
            docs: [entity],
            userdata,
          }),
        ]);

        const legacySwapSuccess = legacyOwnerResults.every(result => result.status === 'fulfilled');
        if (!legacySwapSuccess) {
          warn(
            `Failed to update ownership in userdata for one or more operations: ${{ docId, targetUserId, userId: userdata._id.toString() }}`,
          );
        }

        // Update the entity in the database
        const updateResult = await dbCollection.updateOne(
          { _id: new ObjectId(docId) },
          { $set: { access: entity.access } },
        );
        if (updateResult.modifiedCount === 0) {
          return status(500, 'Failed to transfer ownership');
        }

        // Return the updated entity
        const updatedEntity = await dbCollection.findOne({ _id: new ObjectId(docId) });
        if (!updatedEntity) {
          return status(404, 'Updated entity not found');
        }
        return updatedEntity;
      },
      {
        isLoggedIn: true,
        body: t.Union([
          t.Object({
            collection: t.UnionEnum([Collection.entity, Collection.compilation], {
              description: `The collection type. Only "${Collection.entity}"" and "${Collection.compilation}" are supported as values`,
            }),
            docId: t.String({
              description: 'The ID of the entity or compilation to transfer ownership of.',
            }),
            targetUserId: t.String({ description: 'The ID of the user to transfer ownership to.' }),
          }),
          t.Object({
            entityId: t.String({ description: 'The ID of the entity to transfer ownership of.' }),
            targetUserId: t.String({ description: 'The ID of the user to transfer ownership to.' }),
          }),
        ]),
        response: {
          200: t.Union([IEntitySchema, ICompilationSchema]),
          400: t.Any(),
          401: t.Any(),
          403: t.Any(),
          404: t.Any(),
          500: t.Any(),
        },
        detail: {
          description:
            'Transfers ownership of an entity or compilation to another user, removing the current user as owner and ensuring the target user is set as the new owner.',
          tags: [RouterTags['API V2']],
        },
      },
    )
    .get(
      '/list-entity-formats',
      async () => {
        const result = await entityCollection.distinct('processed.raw', {
          'online': true,
          'finished': true,
          'processed.raw': { $exists: true, $ne: null },
        });

        const formats = new Set<string>();

        result.forEach(rawPath => {
          if (typeof rawPath === 'string') {
            const format = rawPath.split('.').pop()?.toLowerCase();
            if (format) formats.add(format);
          }
        });

        return Array.from(formats).sort();
      },
      {
        response: {
          200: t.Array(t.String()),
        },
        detail: {
          description: 'Lists all unique file formats of processed entities.',
          tags: [RouterTags['API V2']],
        },
      },
    )
    .get(
      '/entities-by-format/:formats',
      async ({ params: { formats } }) => {
        const formatList = formats.split(',').map(format => format.trim().toLowerCase());

        const results = await entityCollection
          .aggregate([
            {
              $match: {
                'online': true,
                'finished': true,
                'processed.raw': { $exists: true, $ne: null },
              },
            },
            {
              $addFields: {
                fileExtension: {
                  $toLower: {
                    $arrayElemAt: [{ $split: ['$processed.raw', '.'] }, -1],
                  },
                },
              },
            },
            {
              $match: {
                fileExtension: { $in: formatList },
              },
            },
            {
              $project: {
                _id: 1,
                fileExtension: 1,
              },
            },
          ])
          .toArray();

        return {
          formats: formatList,
          entities: Array.from(new Set(results.map(e => e._id))).sort((a, b) => a.localeCompare(b)),
        };
      },
      {
        params: t.Object({
          formats: t.String({
            description:
              'The format to filter entities by to retrieve, e.g., "glb", "obj", etc.\nCan be a comma separated list of formats.',
          }),
        }),
        response: {
          200: t.Object({
            formats: t.Array(t.String()),
            entities: t.Array(t.String()),
          }),
        },
        detail: {
          description:
            'Retrieves entities that match the specified file formats, filtering by processed raw paths.',
          tags: [RouterTags['API V2']],
        },
      },
    )
    .post(
      '/explore',
      async ({ body, status, userdata, query: { profileId } }) => {
        const result = await exploreHandler(body, userdata, profileId).catch(err => {
          warn(`Error in exploreHandler: ${err}`);
          return undefined;
        });
        if (!result) {
          return status(500, 'Internal server error');
        }
        return result;
      },
      {
        detail: {
          description:
            'Explore entities (objects) and compilations (collections) on various filters.',
          tags: [RouterTags['API V2']],
        },
        body: ExploreRequest,
        response: {
          200: t.Object({
            results: t.Union([
              t.Array(IEntitySchema, { title: 'IEntity[]' }),
              t.Array(ICompilationSchema, { title: 'ICompilation[]' }),
            ]),
            suggestions: t.Array(t.String()),
            requestTime: t.Number(),
            count: t.Number(),
          }),
          500: t.Any(),
        },
        query: t.Object({
          profileId: t.Optional(
            t.String({
              description:
                'If provided, retrieves results associated with a specific user profile ID',
            }),
          ),
        }),
      },
    )
    .get(
      '/explore-popular-searches',
      async ({ query: { collection, limit } }) => {
        const key = `search-terms::${collection}`;
        const topN = await searchCache.redis
          .send('ZRANGE', [
            key,
            '1',
            '+inf',
            'BYSCORE',
            'LIMIT',
            '0',
            (limit ?? 10).toString(),
            'WITHSCORES',
          ])
          .then(result => {
            return result.filter((entry: unknown): entry is [string, number] => {
              if (!Array.isArray(entry)) return false;
              const [query, score] = entry;
              return typeof query === 'string' && !isNaN(Number(score));
            }) as [string, number][];
          })
          .catch(err => {
            warn(`Failed to retrieve popular searches for collection "${collection}": ${err}`);
            return [] as [string, number][];
          });
        return topN;
      },
      {
        query: t.Object({
          collection: t.Enum(Collection, {
            description: 'The collection to retrieve popular searches from.',
          }),
          limit: t.Optional(
            t.Number({
              description: 'The maximum number of popular searches to retrieve.',
              default: 10,
            }),
          ),
        }),
        response: {
          200: t.Array(t.Tuple([t.String(), t.Number()])),
        },
        detail: {
          description: 'Retrieves the most popular search queries for a given collection.',
          tags: [RouterTags['API V2']],
        },
      },
    )
    .post(
      '/remove-self-from-access/:collection/:identifier',
      async ({ params: { collection, identifier }, userdata, userRole, status }) => {
        if (!userdata) return status(403, 'Must be logged in to remove self from access');
        if (userRole === EntityAccessRole.owner)
          return status(403, 'Owner cannot remove themselves');
        if (!PermissionHelper.isEditorCollection(collection))
          return status(
            400,
            `Collection "${collection}" has no access field or does not allow modification of access field.`,
          );

        const document = await collectionMap[collection].findOne({ _id: new ObjectId(identifier) });
        if (!document) return status(404, 'Document not found');
        if (!('access' in document)) return status(400, 'Document has no access field');

        const updateResult = await collectionMap[collection].updateOne(
          { _id: new ObjectId(identifier) },
          { $pull: { access: { _id: userdata._id.toString() } } },
        );
        info(
          `User ${userdata.username} (${userdata._id.toString()}) removed themselves from access of ${collection} ${identifier}`,
          updateResult,
        );

        return { status: 'OK', message: `You've removed your access to the specified object` };
      },
      {
        body: t.Object({}),
        params: t.Object({
          collection: t.Enum(Collection, {
            description: 'The collection of the document to remove self from.',
          }),
          identifier: t.String({
            description: 'The identifier of the document to remove self from.',
          }),
        }),
        response: {
          200: t.Object({
            status: t.String(),
            message: t.String(),
          }),
          400: t.Any(),
          403: t.Any(),
          404: t.Any(),
        },
        hasRole: EntityAccessRole.viewer,
        isLoggedIn: true,
        detail: {
          description:
            'Removes the logged-in user from editor or viewer to no special access on the specified document. The user must be either editor or viewer to use this endpoint.',
          tags: [RouterTags['API V2']],
        },
      },
    )
    .post(
      '/compilation/create-empty',
      async ({ status, body, userdata }) => {
        if (!userdata) {
          return status(401, 'Unauthorized');
        }

        const associatedProfile = userdata.profiles?.find(p => p.profileId === body.profileId);
        if (!associatedProfile) {
          return status(400, 'The provided profileId is not associated with the user');
        }

        const creator: CreatorField = {
          _id: userdata._id.toString(),
          username: userdata.username,
          fullname: userdata.fullname,
          profile: {
            profileId: body.profileId,
            type: associatedProfile.type,
          },
        };

        const newCompilation: ICompilation = {
          _id: new ObjectId().toString(),
          // Given fields
          name: body.name,
          description: body.description,
          creator,
          access: [{ ...creator, role: EntityAccessRole.owner }],
          // Empty fields
          entities: {},
          annotations: {},
        };

        const saved = await saveHandler({
          collection: Collection.compilation,
          body: newCompilation,
          userdata,
        });

        if (!saved) {
          return status(500, 'Failed to create compilation');
        }

        const resolved = await resolveCompilation({ _id: newCompilation._id }, 1);
        if (!resolved) {
          return status(500, 'Failed to resolve compilation after creation');
        }

        const ownerSuccess = await makeUserOwnerOf({
          docs: resolved,
          collection: Collection.compilation,
          userdata,
        }).catch(err => {
          warn(
            `Failed to add compilation ${newCompilation._id} to user data of ${userdata._id}: ${err}`,
          );
        });
        if (!ownerSuccess) {
          return status(500, 'Failed to add compilation to user data');
        }

        return resolved;
      },
      {
        isLoggedIn: true,
        body: t.Object({
          name: t.String({ description: 'The name of the new compilation.' }),
          description: t.String({ description: 'A description for the compilation.' }),
          profileId: t.String({
            description: 'The profile identifier to associate the compilation with.',
          }),
        }),
        response: {
          200: ICompilationResolvedOnlyEntitiesSchema,
          400: t.Any(),
          401: t.Any(),
          500: t.Any(),
        },
        detail: {
          description:
            'Creates an empty compilation that can be added to with the normal compilation update endpoint.',
          tags: [RouterTags['API V2']],
        },
      },
    )
    .post(
      '/compilation/update-metadata',
      async ({ status, body, userdata }) => {
        if (!userdata) {
          return status(401, 'Unauthorized');
        }

        const associatedProfile = userdata.profiles?.find(p => p.profileId === body.profileId);
        if (!associatedProfile) {
          return status(400, 'The provided profileId is not associated with the user');
        }

        const compilation = await compilationCollection.findOne({ _id: new ObjectId(body._id) });
        if (!compilation) {
          return status(404, 'Compilation not found');
        }

        const userAccess = compilation.access.find(
          user => user._id === userdata._id.toString() && user.profile.profileId === body.profileId,
        );
        if (!userAccess) {
          return status(403, 'You do not have access to this compilation');
        }

        if (userAccess.role === EntityAccessRole.viewer) {
          return status(403, 'You must have at least editor access to update the compilation');
        }

        const updateResult = await compilationCollection.updateOne(
          { _id: new ObjectId(body._id) },
          { $set: { name: body.name, description: body.description } },
        );

        if (updateResult.modifiedCount === 0) {
          return status(500, 'Failed to update compilation metadata');
        }

        const updatedCompilation = await resolveCompilation({ _id: body._id }, 1);
        if (!updatedCompilation) {
          return status(404, 'Updated compilation not found');
        }

        return updatedCompilation;
      },
      {
        isLoggedIn: true,
        body: t.Object({
          _id: t.String({ description: 'The identifier of the compilation to update.' }),
          name: t.String({ description: 'The new name of the compilation.' }),
          description: t.String({ description: 'The new description for the compilation.' }),
          profileId: t.String({
            description: 'The profile identifier updating the compilation.',
          }),
        }),
        response: {
          200: ICompilationResolvedOnlyEntitiesSchema,
          400: t.Any(),
          401: t.Any(),
          403: t.Any(),
          404: t.Any(),
          500: t.Any(),
        },
        detail: {
          description:
            'Updates the metadata of a compilation, such as name and description. The user must have editor access to the compilation.',
          tags: [RouterTags['API V2']],
        },
      },
    )
    .post(
      '/compilation/add-entities',
      async ({ status, body: { compilationIds, entityIds }, userdata }) => {
        if (!userdata) {
          return status(401, 'Unauthorized');
        }

        // Compilation access check
        const compilations = await Promise.all(
          compilationIds.map(_id => resolveCompilation({ _id }, 0)),
        );

        for (const compilation of compilations) {
          if (!compilation) return status(404, 'One or more compilations not found');
          const userrole = compilation?.access.find(
            user => user._id === userdata._id.toString(),
          )?.role;
          if (!userrole)
            return status(
              403,
              'You do not have access to one or more of the specified compilations',
            );
          if (userrole === EntityAccessRole.viewer)
            return status(
              403,
              'You must have at least editor access to the specified compilations',
            );
        }

        const entities = await Promise.all(entityIds.map(_id => resolveEntity({ _id }, 0)));

        for (const entity of entities) {
          if (!entity) return status(404, 'One or more entities not found');
          if (!entity.finished)
            return status(
              400,
              'One or more entities are not finished processing and cannot be added to compilations',
            );
          if (entity.online) continue; // Online entities are always accessible, no need to check access
          const userrole = entity.access.find(user => user._id === userdata._id.toString())?.role;
          if (!userrole)
            return status(403, 'You do not have access to one or more of the specified entities');
        }

        // If all checks passed, proceed to add entities to compilations
        for (const compilation of compilations) {
          if (!compilation) continue;
          for (const entity of entities) {
            if (!entity) continue;
            compilation.entities[entity._id.toString()] = { _id: entity._id.toString() };
          }

          const saveResult = await saveHandler({
            collection: Collection.compilation,
            body: { ...compilation, _id: compilation._id.toString() },
            userdata,
          }).catch(err => {
            warn(`Failed to add entities to compilation ${compilation._id}: ${err}`);
            return false;
          });
          if (!saveResult) {
            return status(500, 'Failed to add entities to one or more compilations');
          }
        }

        return { success: true };
      },
      {
        isLoggedIn: true,
        body: t.Object({
          compilationIds: t.Array(
            t.String({ description: 'An array of compilation identifiers.' }),
          ),
          entityIds: t.Array(t.String(), {
            description: 'An array of entity identifiers to add to the compilation(s).',
          }),
        }),
        response: {
          200: t.Object({ success: t.Boolean() }),
          400: t.Any(),
          401: t.Any(),
          403: t.Any(),
          404: t.Any(),
          500: t.Any(),
        },
        detail: {
          description:
            'Adds entities to one or more compilations. The user must have edit access to the compilation and at least viewer access to the entities.',
          tags: [RouterTags['API V2']],
        },
      },
    )
    .post(
      '/compilation/remove-entities',
      async ({ status, body: { compilationId, entityIds }, userdata }) => {
        if (!userdata) {
          return status(401, 'Unauthorized');
        }

        const compilation = await resolveCompilation({ _id: compilationId }, 0);
        if (!compilation) return status(404, 'Compilation not found');
        const userrole = compilation.access.find(
          user => user._id === userdata._id.toString(),
        )?.role;
        if (!userrole) return status(403, 'You do not have access to the specified compilation');
        if (userrole === EntityAccessRole.viewer)
          return status(403, 'You must have at least editor access to the specified compilation');

        for (const entityId of entityIds) {
          delete compilation.entities[entityId];
        }

        const saveResult = await (async () => {
          if (compilation.entities && Object.keys(compilation.entities).length > 0) {
            return await saveHandler({
              collection: Collection.compilation,
              body: { ...compilation, _id: compilation._id.toString() },
              userdata,
            }).catch(err => {
              warn(`Failed to remove entities from compilation ${compilation._id}: ${err}`);
              return false;
            });
          } else {
            // If no entities remain, delete the compilation
            return deleteAny({
              _id: compilation._id,
              collection: Collection.compilation,
              userdata,
            }).catch(err => {
              warn(
                `Failed to delete compilation ${compilation._id} after removing all entities: ${err}`,
              );
              return false;
            });
          }
        })();
        if (!saveResult) {
          return status(500, 'Failed to remove entities from compilation');
        }

        return { success: true };
      },
      {
        isLoggedIn: true,
        body: t.Object({
          compilationId: t.String({ description: 'The identifier of the compilation.' }),
          entityIds: t.Array(t.String(), {
            description: 'An array of entity identifiers to remove from the compilation.',
          }),
        }),
        response: {
          200: t.Object({ success: t.Boolean() }),
          400: t.Any(),
          401: t.Any(),
          403: t.Any(),
          404: t.Any(),
          500: t.Any(),
        },
        detail: {
          description:
            'Removes entities from a compilation. The user must have edit access to the compilation.',
          tags: [RouterTags['API V2']],
        },
      },
    ),
);

export default apiV2Router;
