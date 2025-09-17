import { Elysia, t } from 'elysia';
import { entityCollection, profileCollection, userCollection } from 'src/mongo';
import configServer from 'src/server.config';
import { authService } from './handlers/auth.service';
import {
  Collection,
  EntityAccessRole,
  isEntity,
  type IDocument,
  isPublicProfile,
  ProfileType,
} from 'src/common';
import {
  makeUserOwnerOf,
  resolveUserDocument,
  undoUserOwnerOf,
} from './modules/user-management/users';
import { resolveEntity, RESOLVE_FULL_DEPTH } from './modules/api.v1/resolving-strategies';
import type { IPublicProfile } from 'src/common/interfaces';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { ObjectId } from 'mongodb';
import { info, warn } from 'src/logger';
import { MAX_PROFILE_IMAGE_RESOLUTION, updatePreviewImage } from 'src/util/image-helpers';
import { RouterTags } from './tags';
import { exploreHandler } from './modules/api.v2/explore';
import { ExploreRequest } from './modules/api.v2/types';

const apiV2Router = new Elysia().use(configServer).group('/api/v2', app =>
  app
    .use(authService)
    .get(
      '/user-data/:collection',
      async ({ userdata, status, params: { collection }, query: { full, depth } }) => {
        const user = structuredClone(userdata);
        if (!user) return status(500);
        const data = user.data[collection] ?? [];
        const resolved = await Promise.all(
          Array.from(new Set(data)).map(docId =>
            resolveUserDocument(docId, collection, depth ? depth : full ? RESOLVE_FULL_DEPTH : 0),
          ),
        );
        const filtered = resolved.filter((obj): obj is IDocument => !!obj && obj !== undefined);
        return filtered;
      },
      {
        isLoggedIn: true,
        params: t.Object({
          collection: t.Enum(Collection, {
            description:
              'The collection to retrieve user data from, e.g., "entity", "compilation", etc.',
          }),
        }),
        query: t.Object({
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
        }),
        detail: {
          description:
            'Retrieves user data from the specified collection, resolving document IDs to full documents if requested.',
          tags: [RouterTags.API, RouterTags['API V2']],
        },
      },
    )
    .get(
      '/user-data/entities-with-access/:role',
      async ({ params: { role }, userdata, status }) => {
        if (!userdata) return status(401);

        role = role.toLowerCase();
        const isRoleArray = role.includes(',');
        const roles = isRoleArray ? role.split(',').map(r => r.trim()) : [role];

        const validRoles = Object.values(EntityAccessRole);
        const allRolesValid = roles.every(role => validRoles.includes(role as EntityAccessRole));
        if (!allRolesValid) {
          return status(
            400,
            `Invalid role(s) provided. Valid role values are: ${validRoles.join(', ')}`,
          );
        }

        const entities = await entityCollection
          .find({
            $and: [
              { [`access.${userdata._id.toString()}`]: { $exists: true, $ne: null } },
              { [`access.${userdata._id.toString()}.role`]: { $in: roles } },
            ],
          })
          .toArray();

        const resolved = await Promise.all(entities.map(entity => resolveEntity(entity, 1))).then(
          arr => arr.filter(isEntity),
        );

        // Combine with entities in userdata for legacy support
        if (role === EntityAccessRole.owner && userdata.data.entity) {
          const userEntities = userdata.data.entity
            .filter((docId): docId is string | IDocument => !!docId)
            .map(docId => resolveEntity({ _id: typeof docId === 'string' ? docId : docId._id }, 1));
          const userResolved = await Promise.all(userEntities);
          resolved.push(...userResolved.filter(isEntity));
        }

        return resolved;
      },
      {
        isLoggedIn: true,
        params: t.Object({
          role: t.Union([
            t.Enum(EntityAccessRole, {
              description: 'The role to filter entities by, e.g., "owner", "editor", "viewer".',
            }),
            t.String({ description: 'List of roles, seperated by comma' }),
          ]),
        }),
        detail: {
          description: 'Retrieves entities the user has access to based on the specified role.',
          tags: [RouterTags.API, RouterTags['API V2']],
        },
      },
    )
    .post(
      '/user-data/update-entity-access',
      async ({ status, body: { _id: entityId, access }, userdata }) => {
        if (!userdata) return status(401);
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
          entity.access = {
            [userdata._id.toString()]: {
              _id: userdata._id.toString(),
              fullname: userdata.fullname,
              username: userdata.username,
              role: EntityAccessRole.owner, // Default to owner if no access exists
            },
          };
        }

        // Check if access update is valid (at least one owner, and user must currently be owner)
        // Is user owner?
        const currentAccess = entity.access[userdata._id.toString()];
        if (!currentAccess || currentAccess.role !== EntityAccessRole.owner) {
          return status(403, 'You must be an owner to update access');
        }

        // Ensure at least one owner remains
        const hasOneOwner = Object.values(access).find(
          user => user.role === EntityAccessRole.owner,
        );
        if (!hasOneOwner) {
          return status(400, 'At least one owner must remain');
        }

        // User remains owner in update?
        const userRemainsOwner = access[userdata._id.toString()]?.role === EntityAccessRole.owner;
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
        body: t.Object({
          _id: t.String({ description: 'Identifier of the entity' }),
          access: t.Record(
            t.String({ description: 'Identifier of a user' }),
            t.Object({
              _id: t.String({ description: 'Same identifier of the user' }),
              fullname: t.String({ description: 'Full name of the user' }),
              username: t.String({ description: 'Username of the user' }),
              role: t.Enum(EntityAccessRole, {
                description: 'The access role of the user for the entity',
              }),
            }),
          ),
        }),
        detail: {
          description:
            'Updates the access permissions for an entity, ensuring at least one owner remains.',
          tags: [RouterTags.API, RouterTags['API V2']],
        },
      },
    )
    .post(
      '/user-data/transfer-ownership',
      async ({ body: { entityId, targetUserId }, status, userdata }) => {
        if (!userdata) return status(401);
        const entity = await entityCollection.findOne({ _id: new ObjectId(entityId) });
        if (!entity) return status(404, 'Entity not found');
        const targetOwner = await userCollection.findOne({ _id: new ObjectId(targetUserId) });
        if (!targetOwner) return status(404, 'Target user not found');

        // Ensure the current user is the owner
        const isOwner =
          entity.access?.[userdata._id.toString()]?.role === EntityAccessRole.owner ||
          userdata.data.entity?.find(id => !!id && (typeof id === 'string' ? true : !!id?._id));
        if (!isOwner) return status(403, 'You must be an owner to transfer ownership');

        // Add/set the target user as owner
        entity.access ??= {};
        entity.access[targetUserId] = {
          _id: targetOwner._id.toString(),
          fullname: targetOwner.fullname,
          username: targetOwner.username,
          role: EntityAccessRole.owner,
        };
        // Remove the current user as owner
        delete entity.access[userdata._id.toString()];

        // Legacy: swap owner in userdata
        const legacyOwnerResults = await Promise.allSettled([
          makeUserOwnerOf({
            collection: Collection.entity,
            docs: [entity],
            userdata: targetOwner,
          }),
          undoUserOwnerOf({
            collection: Collection.entity,
            docs: [entity],
            userdata,
          }),
        ]);

        const legacySwapSuccess = legacyOwnerResults.every(result => result.status === 'fulfilled');
        if (!legacySwapSuccess) {
          warn(
            `Failed to update ownership in userdata for one or more operations: ${{ entityId, targetUserId, userId: userdata._id.toString() }}`,
          );
        }

        // Update the entity in the database
        const updateResult = await entityCollection.updateOne(
          { _id: new ObjectId(entityId) },
          { $set: { access: entity.access } },
        );
        if (updateResult.modifiedCount === 0) {
          return status(500, 'Failed to transfer ownership');
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
        body: t.Object({
          entityId: t.String({ description: 'The ID of the entity to transfer ownership of.' }),
          targetUserId: t.String({ description: 'The ID of the user to transfer ownership to.' }),
        }),
        detail: {
          description:
            'Transfers ownership of an entity to another user, removing the current user as owner and ensuring the target user is set as the new owner.',
          tags: [RouterTags.API, RouterTags['API V2']],
        },
      },
    )
    .get(
      '/user-data/profile/:idOrName',
      async ({ status, params: { idOrName } }) => {
        const profile = await profileCollection.findOne(
          ObjectId.isValid(idOrName) ? { _id: new ObjectId(idOrName) } : { displayName: idOrName },
        );

        if (!profile) return status(404, 'Profile not found');
        return profile;
      },
      {
        params: t.Object({
          idOrName: t.String({
            description:
              'The identifier of the user profile to retrieve, or the display name of the profile.',
          }),
        }),
        detail: {
          description: 'Retrieves a user profile by its ID or display name.',
          tags: [RouterTags.API, RouterTags['API V2']],
        },
        isLoggedIn: false,
      },
    )
    .get(
      '/user-data/profile',
      async ({ userdata, status }) => {
        if (!userdata) return status(401);
        const profileId = Object.entries(userdata.profiles ?? {}).find(
          ([id, type]) => ObjectId.isValid(id) && type === ProfileType.user,
        )?.[0];
        const profile = profileId
          ? await profileCollection.findOne({ _id: new ObjectId(profileId) })
          : undefined;
        if (!profile) {
          // Create a default profile if none exists
          const newProfile = {
            type: ProfileType.user,
            _id: new ObjectId(),
            description: '',
            displayName: userdata.fullname,
            imageUrl: undefined,
            location: undefined,
            socials: {
              website: undefined,
            },
          } satisfies ServerDocument<IPublicProfile>;
          const insertResult = await profileCollection.insertOne(newProfile);
          if (insertResult.acknowledged) {
            await userCollection.updateOne(
              { _id: new ObjectId(userdata._id.toString()) },
              {
                $set: {
                  profiles: {
                    ...userdata.profiles,
                    [insertResult.insertedId.toString()]: ProfileType.user,
                  },
                },
              },
            );
            return {
              ...newProfile,
              _id: insertResult.insertedId.toString(),
            };
          }
        }
        return profile;
      },
      {
        isLoggedIn: true,
        detail: {
          description: "Retrieves the logged-in user's profile.",
          tags: [RouterTags.API, RouterTags['API V2']],
        },
      },
    )
    .post(
      '/institution/profile',
      async ({ userdata, body, status }) => {
        if (!userdata) return status(401);
        if (!body || !isPublicProfile(body)) return status(400, 'Invalid profile data');
        if (body.type !== ProfileType.institution)
          return status(400, 'Profile type must be "institution"');

        const _id = new ObjectId();

        // Save image if necessary
        body.imageUrl = await (async () => {
          if (!body.imageUrl) return undefined;
          if (!body.imageUrl.startsWith('data:image')) return body.imageUrl;
          return await updatePreviewImage(
            body.imageUrl,
            'profile-pictures',
            _id.toString(),
            MAX_PROFILE_IMAGE_RESOLUTION,
          );
        })();

        const insertResult = await profileCollection.insertOne({ ...body, _id });

        if (!insertResult.acknowledged) {
          return status(500, 'Profile creation failed');
        }

        await userCollection.updateOne(
          { _id: new ObjectId(userdata._id.toString()) },
          {
            $set: {
              profiles: {
                ...userdata.profiles,
                [insertResult.insertedId.toString()]: ProfileType.institution,
              },
            },
          },
        );

        return {
          ...body,
          _id: insertResult.insertedId.toString(),
        };
      },
      {
        isLoggedIn: true,
        detail: {
          description: 'Creates a new institutional profile.',
          tags: [RouterTags.API, RouterTags['API V2']],
        },
      },
    )
    .post(
      '/institution/profile/:id',
      async ({ userdata, body, status, params: { id: institutionId } }) => {
        if (!userdata) return status(401);
        if (!body || !isPublicProfile(body)) return status(400, 'Invalid profile data');
        if (body.type !== ProfileType.institution)
          return status(400, 'Profile type must be "institution"');

        const existingProfile = await profileCollection.findOne({
          _id: new ObjectId(institutionId),
        });
        if (!existingProfile) return status(404, 'Institutional profile not found');

        // Save image if necessary
        body.imageUrl = await (async () => {
          if (!body.imageUrl) return undefined;
          if (!body.imageUrl.startsWith('data:image')) return body.imageUrl;
          return await updatePreviewImage(
            body.imageUrl,
            'profile-pictures',
            institutionId,
            MAX_PROFILE_IMAGE_RESOLUTION,
          );
        })();

        // Ensure we don't overwrite the _id field
        // @ts-expect-error: Ensure we don't overwrite the _id field
        delete body._id;
        const updateResult = await profileCollection.updateOne(
          { _id: new ObjectId(institutionId) },
          { $set: { ...body } },
        );

        if (updateResult.modifiedCount <= 0) {
          return status(500, 'Profile update failed');
        }

        const updatedProfile = await profileCollection.findOne({
          _id: new ObjectId(institutionId),
        });
        return updatedProfile;
      },
      {
        isLoggedIn: true,
        detail: {
          description: 'Updates an existing institutional profile.',
          tags: [RouterTags.API, RouterTags['API V2']],
        },
        params: t.Object({
          id: t.String({
            description: 'The ID of the institutional profile to update.',
          }),
        }),
      },
    )
    .post(
      '/user-data/profile',
      async ({ userdata, status, body }) => {
        if (!userdata) return status(401);

        if (!body || !isPublicProfile(body)) return status(400, 'Invalid profile data');
        if (body.type !== ProfileType.user) return status(400, 'Profile type must be "user"');

        // Look for existing profile in userdata
        const profileId = Object.entries(userdata.profiles ?? {}).find(
          ([id, type]) => ObjectId.isValid(id) && type === ProfileType.user,
        )?.[0];
        const profile = profileId
          ? await profileCollection.findOne({ _id: new ObjectId(profileId) })
          : undefined;
        const existingProfileId = profile ? profile._id.toString() : undefined;
        const _id = existingProfileId ? new ObjectId(existingProfileId) : new ObjectId();

        // Save image if necessary
        body.imageUrl = await (async () => {
          if (!body.imageUrl) return undefined;
          if (!body.imageUrl.startsWith('data:image')) return body.imageUrl;
          return await updatePreviewImage(
            body.imageUrl,
            'profile-pictures',
            _id.toString(),
            MAX_PROFILE_IMAGE_RESOLUTION,
          );
        })();

        // TODO: think if we need to merge?
        // @ts-expect-error: Ensure we don't overwrite the _id field
        delete body._id;
        const updateResult = await profileCollection.updateOne(
          { _id },
          { $set: { ...body } },
          { upsert: true },
        );

        if (!updateResult.acknowledged) {
          return status(500, 'Profile update failed');
        }

        await userCollection.updateOne(
          { _id: new ObjectId(userdata._id.toString()) },
          {
            $set: {
              profiles: {
                ...userdata.profiles,
                [_id.toString()]: ProfileType.user,
              },
            },
          },
        );

        const updatedProfile = await profileCollection.findOne({ _id });
        return updatedProfile;
      },
      {
        isLoggedIn: true,
        detail: {
          description: "Updates the logged-in user's profile with the provided data.",
          tags: [RouterTags.API, RouterTags['API V2']],
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
        detail: {
          description: 'Lists all unique file formats of processed entities.',
          tags: [RouterTags.API, RouterTags['API V2']],
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
          entities: Array.from(new Set(results.map(e => e._id))).sort(),
        };
      },
      {
        params: t.Object({
          formats: t.String({
            description:
              'The format to filter entities by to retrieve, e.g., "glb", "obj", etc.\nCan be a comma separated list of formats.',
          }),
        }),
        detail: {
          description:
            'Retrieves entities that match the specified file formats, filtering by processed raw paths.',
          tags: [RouterTags.API, RouterTags['API V2']],
        },
      },
    )
    .post(
      '/explore',
      async ({ body, status, userdata }) => {
        const result = await exploreHandler(body, userdata).catch(err => {
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
          tags: [RouterTags.API, RouterTags['API V2']],
        },
        body: ExploreRequest,
      },
    ),
);

export default apiV2Router;
