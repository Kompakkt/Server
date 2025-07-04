import { Elysia, t } from 'elysia';
import { ObjectId } from 'mongodb';
import {
  Collection,
  type IStrippedUserData,
  isAnnotation,
  isInstitution,
  isPerson,
} from 'src/common';
import { isEntitySettings } from 'src/common/typeguards';
import { err, info, log, warn } from 'src/logger';
import { collectionMap, entityCollection, groupCollection, userCollection } from 'src/mongo';
import configServer from 'src/server.config';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { updatePreviewImage } from 'src/util/image-helpers';
import { authService, signInBody } from './handlers/auth.service';
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
import { checkIsOwner, makeUserOwnerOf, undoUserOwnerOf } from './modules/user-management/users';
import { deleteAny } from './modules/api.v1/deletion-strategies';
import { exploreCache } from 'src/redis';

const apiV1Router = new Elysia().use(configServer).group('/api/v1', app =>
  app
    .use(authService)
    .get(
      '/get/find/:collection/:identifier',
      ({ params, userdata }) => findSingleHandler(params, userdata),
      { params: findSingleParams },
    )
    .get(
      '/get/find/:collection/:identifier/:password?',
      ({ params, userdata }) => findSingleHandler(params, userdata),
      { params: findSingleParams },
    )
    .get('/get/findall/:collection', ({ params }) => findAll(params), {
      params: findAllParams,
    })
    .get('/get/id', () => new ObjectId())
    .post(
      '/post/explore',
      async ({ body, userdata, status }) => {
        const combined = { ...body, userData: userdata ?? undefined };
        return body.searchEntity ? exploreEntities(combined) : exploreCompilations(combined);
      },
      {
        body: ExploreRequest,
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

        // Flatten account.data so its an array of ObjectId.toString()
        const userEntities = Object.values(user.data)
          .flat()
          .map(e => e?.toString())
          .filter((e): e is string => !!e);

        if (!userEntities.includes(_id)) {
          const message = 'Entity removal failed because Entity does not belong to user';
          err(message);
          return status(401, message);
        }

        const success = await deleteAny({
          _id,
          collection,
          userdata,
        });
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
      },
    )
    .guard({ isLoggedIn: true }, app =>
      app
        .get('/get/users', () =>
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
        )
        .get('/get/groups', () => groupCollection.find({}).toArray())
        .post(
          '/post/push/:collection',
          async ({ status, params: { collection }, body, userdata }) => {
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

            /**
             * If the entity already exists we need to check for owner status
             * We skip this for annotations, since annotation ranking can be changed by owner
             * We check this in the saving strategy instead
             * We also skip this for persons and institutions since their nested content
             * (addresses, contact_references, etc.) can also be updated
             */
            const isEditableType = (_e: unknown) =>
              isAnnotation(_e) || isPerson(_e) || isInstitution(_e);

            const needOwnerCheck = isValidObjectId && doesEntityExist && !isEditableType(body);
            if (needOwnerCheck) {
              const isOwner = await checkIsOwner({
                doc: body,
                collection,
                userdata,
              });
              log(`Checking if user is owner of ${body._id} to ${collection}: ${isOwner}`);
              if (!isOwner) return status(403);
            }

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
          },
        )
        .post(
          '/post/settings/:identifier',
          async ({ status, params: { identifier }, body }) => {
            if (!body || !isEntitySettings(body)) return status('Bad Request');
            const preview = body.preview;
            const entityId = ObjectId.isValid(identifier) ? new ObjectId(identifier) : identifier;

            // Save preview to file, if not yet done
            const finalImagePath = await updatePreviewImage(preview, 'entity', entityId);

            // Overwrite old settings
            const settings = { ...body, preview: finalImagePath };
            const result = await entityCollection.updateOne(
              { _id: new ObjectId(entityId) },
              { $set: { settings } },
            );

            if (!result || result.modifiedCount !== 1) return status('Internal Server Error');

            return settings;
          },
          {
            params: t.Object({
              identifier: t.String(),
            }),
            body: t.Unknown(),
          },
        ),
    ),
);

export default apiV1Router;
