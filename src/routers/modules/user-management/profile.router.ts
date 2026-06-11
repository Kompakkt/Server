import {
  IPublicProfileSchema,
  IStrippedUserDataSchema,
  ProfileType,
  type IStrippedUserData,
} from '@kompakkt/common';
import Elysia, { t } from 'elysia';
import { ObjectId } from 'mongodb';
import { profileCollection, userCollection } from 'src/mongo';
import { authService } from 'src/routers/handlers/auth.service';
import { permissionService } from 'src/routers/handlers/permission.service';
import { RouterTags } from 'src/routers/tags';
import configServer from 'src/server.config';
import { MAX_PROFILE_IMAGE_RESOLUTION, updatePreviewImage } from 'src/util/image-helpers';

export const profileRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .use(permissionService)
  .get(
    '/user-of-profile/:id',
    async ({ params: { id }, status }) => {
      const profile = await profileCollection.findOne({ _id: new ObjectId(id) });
      if (!profile) return status(404, 'Profile not found');
      const user = await userCollection.findOne({
        [`profiles.${id}`]: { $exists: true },
      });
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
  .post(
    '/organization',
    async ({ userdata, body, status }) => {
      if (!userdata) return status(401, 'User not authenticated');
      if (body.type !== ProfileType.organization)
        return status(400, 'Profile type must be "organization"');

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
          $push: {
            profiles: {
              profileId: insertResult.insertedId.toString(),
              type: ProfileType.organization,
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

      // Ensure we don't overwrite the _id field
      // @ts-expect-error: Ensure we don't overwrite the _id field
      delete body._id;
      const updateResult = await profileCollection.updateOne(
        { _id: new ObjectId(organizationId) },
        { $set: { ...body } },
      );

      if (updateResult.modifiedCount <= 0) {
        return status(500, 'Profile update failed');
      }

      const updatedProfile = await profileCollection.findOne({
        _id: new ObjectId(organizationId),
      });
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
  );
