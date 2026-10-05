import {
  Collection,
  ICompilationSchema,
  IEntitySchema,
  IPublicProfileSchema,
  IProfileMemberSchema,
  IStrippedUserDataSchema,
  ProfileMemberRole,
  ProfileType,
  type IPublicProfile,
  type IStrippedUserData,
} from '@kompakkt/common';
import Elysia, { t } from 'elysia';
import { ObjectId } from 'mongodb';
import {
  compilationCollection,
  entityCollection,
  profileCollection,
  userCollection,
} from 'src/mongo';
import { authService } from 'src/routers/handlers/auth.service';
import { permissionService } from 'src/routers/handlers/permission.service';
import {
  addProfileMember,
  assertMinProfileRole,
  getProfileAccess,
  removeMembershipFromUser,
  removeProfileMember,
  syncMembershipToUser,
  unlinkProfileFromUsers,
  updateProfileMember,
} from 'src/routers/modules/user-management/profile-members';
import { RouterTags } from 'src/routers/tags';
import configServer from 'src/server.config';
import { MAX_PROFILE_IMAGE_RESOLUTION, updatePreviewImage } from 'src/util/image-helpers';
import { searchService } from 'src/sonic';

const PROFILE_SONIC_COLLECTION = 'profile' as Collection;
const indexProfile = (profile: IPublicProfile & { _id: ObjectId | string }): void => {
  searchService.updateDocument(PROFILE_SONIC_COLLECTION, profile);
};

const stripManagedProfileFields = (body: Partial<IPublicProfile> & { type: ProfileType }): void => {
  delete body.members;
  delete body.ownerId;
};

export const profileRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .use(permissionService)
  .get(
    '/user-of-profile/:id',
    async ({ params: { id }, status }) => {
      const profile = await profileCollection.findOne({ _id: new ObjectId(id) });
      if (!profile) return status(404, 'Profile not found');
      const user = await userCollection.findOne(
        { 'profiles.profileId': id },
        { projection: { fullname: 1, username: 1 } },
      );
      if (!user) return status(404, 'User not found for the given profile ID');
      return {
        _id: user._id.toString(),
        fullname: user.fullname,
        username: user.username,
      } satisfies IStrippedUserData;
    },
    {
      response: {
        200: IStrippedUserDataSchema,
        404: t.Any(),
      },
      params: t.Object({
        id: t.String({ description: 'The ID of the profile to find the user for.' }),
      }),
      detail: {
        description: 'Finds the user associated with a given profile ID.',
        tags: [RouterTags['API V2'], RouterTags.Profile],
      },
    },
  )
  .get(
    '/via-id/:id',
    async ({ status, params: { id } }) => {
      if (!ObjectId.isValid(id)) return status(400, 'Invalid profile ID format');

      const profile = await profileCollection.findOne({ _id: new ObjectId(id) });
      if (!profile) return status(404, 'Profile not found');
      return profile;
    },
    {
      response: {
        200: IPublicProfileSchema,
        400: t.Any(),
        404: t.Any(),
      },
      params: t.Object({
        id: t.String({
          description: 'The id of the profile to retrieve',
        }),
      }),
      detail: {
        description: 'Retrieves a user or organization profile via id.',
        tags: [RouterTags['API V2'], RouterTags.Profile],
      },
      isLoggedIn: false,
    },
  )
  .get(
    '/via-id/:id/entities',
    async ({ status, params: { id } }) => {
      if (!ObjectId.isValid(id)) return status(400, 'Invalid profile ID format');

      const profile = await profileCollection.findOne({ _id: new ObjectId(id) });
      if (!profile) return status(404, 'Profile not found');

      return await entityCollection
        .find({ 'creator.profile.profileId': id, 'online': true, 'finished': true })
        .toArray();
    },
    {
      response: {
        200: t.Array(IEntitySchema),
        400: t.Any(),
        404: t.Any(),
      },
      params: t.Object({
        id: t.String({ description: 'The id of the profile to list public entities for.' }),
      }),
      detail: {
        description:
          'Lists published (online, finished) entities created under the given profile. Public endpoint backing profile pages.',
        tags: [RouterTags['API V2'], RouterTags.Profile],
      },
      isLoggedIn: false,
    },
  )
  .get(
    '/via-id/:id/compilations',
    async ({ status, params: { id } }) => {
      if (!ObjectId.isValid(id)) return status(400, 'Invalid profile ID format');

      const profile = await profileCollection.findOne({ _id: new ObjectId(id) });
      if (!profile) return status(404, 'Profile not found');

      return await compilationCollection
        .find({ 'creator.profile.profileId': id, 'online': true })
        .toArray();
    },
    {
      response: {
        200: t.Array(ICompilationSchema),
        400: t.Any(),
        404: t.Any(),
      },
      params: t.Object({
        id: t.String({ description: 'The id of the profile to list public compilations for.' }),
      }),
      detail: {
        description:
          'Lists published (online) compilations created under the given profile. Public endpoint backing profile pages.',
        tags: [RouterTags['API V2'], RouterTags.Profile],
      },
      isLoggedIn: false,
    },
  )
  .get(
    '/organization/:id/members/public',
    async ({ status, params: { id } }) => {
      if (!ObjectId.isValid(id)) return status(400, 'Invalid profile ID format');

      const profile = await profileCollection.findOne({ _id: new ObjectId(id) });
      if (!profile || profile.type !== ProfileType.organization) {
        return status(404, 'Organizational profile not found');
      }

      const memberIds = [
        ...(profile.ownerId ? [profile.ownerId] : []),
        ...(profile.members ?? []).map(member => member.userId),
      ];
      const users = await userCollection
        .find(
          { _id: { $in: memberIds.map(memberId => new ObjectId(memberId)) } },
          { projection: { fullname: 1, username: 1 } },
        )
        .toArray();
      const usersById = new Map(users.map(user => [user._id.toString(), user]));

      const resolvedMembers = [
        ...(profile.ownerId
          ? [
              {
                userId: profile.ownerId,
                username: usersById.get(profile.ownerId)?.username,
                fullname: usersById.get(profile.ownerId)?.fullname,
                role: ProfileMemberRole.owner,
                addedAt: undefined,
              },
            ]
          : []),
        ...(profile.members ?? []).map(member => ({
          userId: member.userId,
          username: usersById.get(member.userId)?.username,
          fullname: usersById.get(member.userId)?.fullname,
          role: member.role,
          addedAt: member.addedAt,
        })),
      ];
      return resolvedMembers;
    },
    {
      response: {
        200: t.Array(
          t.Object({
            userId: t.String(),
            username: t.Optional(t.String()),
            fullname: t.Optional(t.String()),
            role: IProfileMemberSchema.properties.role,
            addedAt: t.Optional(t.String()),
          }),
        ),
        400: t.Any(),
        404: t.Any(),
      },
      params: t.Object({
        id: t.String({ description: 'The ID of the organizational profile.' }),
      }),
      detail: {
        description:
          'Public member list of an organizational profile with resolved usernames. Emails are never included.',
        tags: [RouterTags['API V2'], RouterTags.Profile],
      },
      isLoggedIn: false,
    },
  )
  .post(
    '/organization',
    async ({ userdata, body, status }) => {
      if (!userdata) return status(401, 'User not authenticated');
      if (body.type !== ProfileType.organization)
        return status(400, 'Profile type must be "organization"');

      const _id = new ObjectId();

      stripManagedProfileFields(body);

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

      const insertResult = await profileCollection.insertOne({
        ...body,
        _id,
        ownerId: userdata._id.toString(),
        members: [],
        // Same convention as entities/compilations (see save-to-collection.ts):
        // the ms epoch derived from the ObjectId. `/profile/search` orders by it.
        __createdAt: _id.getTimestamp().getTime(),
      });

      if (!insertResult.acknowledged) {
        return status(500, 'Profile creation failed');
      }

      indexProfile({
        ...body,
        _id: insertResult.insertedId,
        ownerId: userdata._id.toString(),
        members: [],
        __createdAt: _id.getTimestamp().getTime(),
      });

      await userCollection.updateOne(
        { _id: new ObjectId(userdata._id.toString()) },
        {
          $push: {
            profiles: {
              profileId: insertResult.insertedId.toString(),
              type: ProfileType.organization,
              role: ProfileMemberRole.owner,
            },
          },
        },
      );

      return {
        ...body,
        _id: insertResult.insertedId.toString(),
        ownerId: userdata._id.toString(),
        members: [],
      };
    },
    {
      response: {
        200: IPublicProfileSchema,
        400: t.Any(),
        401: t.Any(),
        500: t.Any(),
      },
      body: t.Omit(IPublicProfileSchema, ['_id']),
      isLoggedIn: true,
      detail: {
        description: 'Creates a new organizational profile.',
        tags: [RouterTags['API V2'], RouterTags.Profile],
      },
    },
  )
  .post(
    '/organization/:id',
    async ({ userdata, body, status, params: { id: organizationId } }) => {
      if (!userdata) return status(401, 'User not authenticated');
      if (body.type !== ProfileType.organization)
        return status(400, 'Profile type must be "organization"');

      const access = await getProfileAccess(userdata, organizationId);
      if (!assertMinProfileRole(access, ProfileMemberRole.owner)) {
        return status(403, 'You must be an owner of this organizational profile to update it');
      }

      const existingProfile = await profileCollection.findOne({
        _id: new ObjectId(organizationId),
      });
      if (!existingProfile) return status(404, 'organizational profile not found');

      // Save image if necessary
      body.imageUrl = await (async () => {
        if (!body.imageUrl) return undefined;
        if (!body.imageUrl.startsWith('data:image')) return body.imageUrl;
        return await updatePreviewImage(
          body.imageUrl,
          'profile-pictures',
          organizationId,
          MAX_PROFILE_IMAGE_RESOLUTION,
        );
      })();

      // Ensure we don't overwrite managed fields
      stripManagedProfileFields(body);
      delete body._id;
      const updateResult = await profileCollection.updateOne(
        { _id: new ObjectId(organizationId) },
        { $set: { ...body } },
      );

      // `modifiedCount === 0` means the submitted fields were identical to the
      // stored ones (or the `$set` was empty) — a legitimate no-op, not a failure.
      if (!updateResult.acknowledged) {
        return status(500, 'Profile update failed');
      }

      const updatedProfile = await profileCollection.findOne({
        _id: new ObjectId(organizationId),
      });
      if (updatedProfile) indexProfile(updatedProfile);
      return updatedProfile;
    },
    {
      isLoggedIn: true,
      detail: {
        description: 'Updates an existing organizational profile.',
        tags: [RouterTags['API V2'], RouterTags.Profile],
      },
      body: IPublicProfileSchema,
      params: t.Object({
        id: t.String({
          description: 'The ID of the organizational profile to update.',
        }),
      }),
      response: {
        200: IPublicProfileSchema,
        400: t.Any(),
        401: t.Any(),
        403: t.Any(),
        404: t.Any(),
        500: t.Any(),
      },
    },
  )
  .post(
    '/user',
    async ({ userdata, status, body }) => {
      if (!userdata) return status(401, 'User not authenticated');
      if (body.type !== ProfileType.user) return status(400, 'Profile type must be "user"');

      // Look for existing profile in userdata
      const userProfile = userdata.profiles?.find(
        ({ profileId, type }) => ObjectId.isValid(profileId) && type === ProfileType.user,
      );

      const profileId = userProfile?.profileId;
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
      stripManagedProfileFields(body);
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

      if (!userProfile) {
        await userCollection.updateOne(
          { _id: new ObjectId(userdata._id.toString()) },
          {
            $push: {
              profiles: {
                profileId: _id.toString(),
                type: ProfileType.user,
                role: ProfileMemberRole.owner,
              },
            },
          },
        );
      }

      const updatedProfile = await profileCollection.findOne({ _id });
      return updatedProfile;
    },
    {
      isLoggedIn: true,
      detail: {
        description: "Updates the logged-in user's profile with the provided data.",
        tags: [RouterTags['API V2'], RouterTags.Profile],
      },
      body: t.Omit(IPublicProfileSchema, ['_id']),
      response: {
        200: IPublicProfileSchema,
        400: t.Any(),
        401: t.Any(),
        500: t.Any(),
      },
    },
  )
  .get(
    '/organization/:id/members',
    async ({ userdata, status, params: { id } }) => {
      if (!userdata) return status(401, 'User not authenticated');
      const access = await getProfileAccess(userdata, id);
      if (!assertMinProfileRole(access, ProfileMemberRole.viewer)) {
        return status(403, 'You are not a member of this organizational profile');
      }

      const ownerUser = access.profile.ownerId
        ? await userCollection.findOne(
            { _id: new ObjectId(access.profile.ownerId) },
            { projection: { fullname: 1, username: 1 } },
          )
        : undefined;
      if (!ownerUser) return status(404, 'Owner user not found for the given profile ID');

      return {
        owner: {
          _id: ownerUser._id.toString(),
          fullname: ownerUser.fullname,
          username: ownerUser.username,
        } satisfies IStrippedUserData,
        members: access.profile.members ?? [],
      };
    },
    {
      response: {
        200: t.Object({
          owner: IStrippedUserDataSchema,
          members: t.Array(IProfileMemberSchema),
        }),
        401: t.Any(),
        403: t.Any(),
        404: t.Any(),
      },
      params: t.Object({
        id: t.String({ description: 'The ID of the organizational profile.' }),
      }),
      detail: {
        description: 'Lists the members of an organizational profile with their roles.',
        tags: [RouterTags['API V2'], RouterTags.Profile],
      },
      isLoggedIn: true,
    },
  )
  .post(
    '/organization/:id/members',
    async ({ userdata, status, body, params: { id } }) => {
      if (!userdata) return status(401, 'User not authenticated');
      const access = await getProfileAccess(userdata, id);
      if (!assertMinProfileRole(access, ProfileMemberRole.owner)) {
        return status(403, 'You must be an owner of this organizational profile to add members');
      }
      if (body.role === ProfileMemberRole.owner) {
        return status(409, 'Ownership is granted via ownership transfer, not membership');
      }

      const targetUser = await userCollection.findOne(
        { _id: new ObjectId(body.userId) },
        { projection: { _id: 1 } },
      );
      if (!targetUser) return status(404, 'User to add not found');

      const added = await addProfileMember(id, {
        userId: body.userId,
        role: body.role,
        addedAt: new Date().toISOString(),
      });
      if (!added) return status(409, 'User is already a member of this profile');

      await syncMembershipToUser(body.userId, id, body.role);
      return status(201, { userId: body.userId, role: body.role });
    },
    {
      response: {
        201: t.Object({ userId: t.String(), role: IProfileMemberSchema.properties.role }),
        401: t.Any(),
        403: t.Any(),
        404: t.Any(),
        409: t.Any(),
      },
      params: t.Object({
        id: t.String({ description: 'The ID of the organizational profile.' }),
      }),
      body: t.Omit(IProfileMemberSchema, ['addedAt']),
      detail: {
        description:
          'Adds a member to an organizational profile with a role of editor or viewer. Owner-only.',
        tags: [RouterTags['API V2'], RouterTags.Profile],
      },
      isLoggedIn: true,
    },
  )
  .post(
    '/organization/:id/members/:userId',
    async ({ userdata, status, body, params: { id, userId } }) => {
      if (!userdata) return status(401, 'User not authenticated');
      const access = await getProfileAccess(userdata, id);
      if (!assertMinProfileRole(access, ProfileMemberRole.owner)) {
        return status(403, 'You must be an owner of this organizational profile to update members');
      }
      if (access.profile.ownerId === userId) {
        return status(409, 'The role of the bootstrap owner cannot be changed');
      }
      if (body.role === ProfileMemberRole.owner) {
        return status(409, 'Ownership is granted via ownership transfer, not membership');
      }

      const updated = await updateProfileMember(id, userId, body.role);
      if (!updated) return status(404, 'Member not found');

      await syncMembershipToUser(userId, id, body.role);
      return status(200, { userId, role: body.role });
    },
    {
      response: {
        200: t.Object({ userId: t.String(), role: IProfileMemberSchema.properties.role }),
        401: t.Any(),
        403: t.Any(),
        404: t.Any(),
        409: t.Any(),
      },
      params: t.Object({
        id: t.String({ description: 'The ID of the organizational profile.' }),
        userId: t.String({ description: 'The ID of the member to update.' }),
      }),
      body: t.Object({
        role: IProfileMemberSchema.properties.role,
      }),
      detail: {
        description: 'Updates the membership role of a member. Owner-only.',
        tags: [RouterTags['API V2'], RouterTags.Profile],
      },
      isLoggedIn: true,
    },
  )
  .delete(
    '/organization/:id/members/:userId',
    async ({ userdata, status, params: { id, userId } }) => {
      if (!userdata) return status(401, 'User not authenticated');
      const access = await getProfileAccess(userdata, id);
      if (!access.ok) return status(403, 'You are not a member of this organizational profile');
      const isSelfRemoval = userdata._id.toString() === userId;
      if (access.role !== ProfileMemberRole.owner && !isSelfRemoval) {
        return status(403, 'Only owners may remove other members');
      }
      if (access.profile.ownerId === userId) {
        return status(409, 'The bootstrap owner cannot be removed');
      }

      const removed = await removeProfileMember(id, userId);
      if (!removed) return status(404, 'Member not found');

      await removeMembershipFromUser(id, userId);
      return status(200, { userId });
    },
    {
      response: {
        200: t.Object({ userId: t.String() }),
        401: t.Any(),
        403: t.Any(),
        404: t.Any(),
        409: t.Any(),
      },
      params: t.Object({
        id: t.String({ description: 'The ID of the organizational profile.' }),
        userId: t.String({ description: 'The ID of the member to remove.' }),
      }),
      detail: {
        description:
          'Removes a member from an organizational profile. Owner-only, except that a member may remove themselves.',
        tags: [RouterTags['API V2'], RouterTags.Profile],
      },
      isLoggedIn: true,
    },
  )
  .delete(
    '/organization/:id',
    async ({ userdata, status, params: { id } }) => {
      if (!userdata) return status(401, 'User not authenticated');
      const access = await getProfileAccess(userdata, id);
      if (!assertMinProfileRole(access, ProfileMemberRole.owner)) {
        return status(403, 'You must be an owner of this organizational profile to delete it');
      }

      const [entityCount, compilationCount] = await Promise.all([
        entityCollection.countDocuments({ 'creator.profile.profileId': id }),
        compilationCollection.countDocuments({ 'creator.profile.profileId': id }),
      ]);
      if (entityCount > 0 || compilationCount > 0) {
        return status(409, {
          error: 'profileNotEmpty',
          count: { entities: entityCount, compilations: compilationCount },
        });
      }

      await unlinkProfileFromUsers(id);
      const deleteResult = await profileCollection.deleteOne({ _id: new ObjectId(id) });
      if (deleteResult.deletedCount <= 0) return status(404, 'Profile not found');

      searchService.deleteDocument(PROFILE_SONIC_COLLECTION, { _id: id });

      return status(200, { deleted: id });
    },
    {
      response: {
        200: t.Object({ deleted: t.String() }),
        401: t.Any(),
        403: t.Any(),
        404: t.Any(),
        409: t.Any(),
      },
      params: t.Object({
        id: t.String({ description: 'The ID of the organizational profile to delete.' }),
      }),
      detail: {
        description:
          'Deletes an organizational profile. Owner-only. Blocked with 409 profileNotEmpty while the organization still owns entities or compilations; transfer or delete those first.',
        tags: [RouterTags['API V2'], RouterTags.Profile],
      },
      isLoggedIn: true,
    },
  )
  .get(
    '/search',
    async ({ query: { q } }) => {
      const trimmedQuery = q.trim();

      // Empty query: list the newest organizational profiles for discovery
      if (!trimmedQuery) {
        return await profileCollection
          .find({ type: ProfileType.organization })
          .sort({ __createdAt: -1 })
          .limit(20)
          .toArray();
      }

      const foundIds = await searchService.search(PROFILE_SONIC_COLLECTION, trimmedQuery);
      if (foundIds.length === 0) return [];

      return await profileCollection
        .find({
          _id: { $in: foundIds },
          type: ProfileType.organization,
        })
        .limit(20)
        .toArray();
    },
    {
      response: {
        200: t.Array(IPublicProfileSchema),
      },
      query: t.Object({
        q: t.String({ description: 'The search query for organizational profiles.' }),
      }),
      detail: {
        description:
          'Full-text search over organizational profiles (name, description, location) backed by Sonic. Public endpoint.',
        tags: [RouterTags['API V2'], RouterTags.Profile],
      },
      isLoggedIn: false,
    },
  );
