import Elysia from 'elysia';
import { ObjectId } from 'mongodb';
import { Collection, EntityAccessRole, type IUserData } from 'src/common';
import { log } from 'src/logger';
import { collectionMap } from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { authService } from './auth.service';

const isRecord = (obj: unknown): obj is Record<string, unknown> => {
  return typeof obj === 'object' && obj !== null;
};
const hasFieldOfType = (obj: Record<string, unknown>, fieldName: string, type: string) => {
  return fieldName in obj && typeof obj[fieldName] === type;
};
const isDocument = (obj: unknown): obj is { _id: string } => {
  return isRecord(obj) && '_id' in obj;
};
const isCollectionParam = (obj: unknown): obj is { collection: string } => {
  return isRecord(obj) && hasFieldOfType(obj, 'collection', 'string');
};
const isIdentifierParam = (obj: unknown): obj is { identifier: string } => {
  return isRecord(obj) && hasFieldOfType(obj, 'identifier', 'string');
};
const isAccessObject = (obj: unknown): obj is Record<string, { role: EntityAccessRole }> => {
  if (!isRecord(obj)) return false;
  return Object.values(obj).every(
    value =>
      isRecord(value) &&
      hasFieldOfType(value, 'role', 'string') &&
      Object.values(EntityAccessRole).includes(value.role as EntityAccessRole),
  );
};

export const PermissionHelper = new (class {
  /**
   * Get the user's role in the document's access field.
   */
  getUserRoleInAccess(document: unknown, userdata: ServerDocument<IUserData> | IUserData) {
    if (!isDocument(document)) return;
    if (!('access' in document)) return;
    if (!isAccessObject(document.access)) return;
    const userAccess = document.access[userdata._id.toString()];
    return userAccess ? userAccess.role : undefined;
  }

  /**
   * Check if the user is a legacy owner of the document.
   */
  isUserLegacyOwner(document: unknown, userdata: ServerDocument<IUserData> | IUserData) {
    if (!isDocument(document)) return false;
    const userEntities = Object.values(userdata.data)
      .flat()
      .map(e => e?.toString())
      .filter((e): e is string => !!e);
    return userEntities.includes(document._id.toString());
  }

  isUserMinimumRole(
    document: unknown,
    userdata: ServerDocument<IUserData> | IUserData,
    minimumRole: EntityAccessRole,
  ) {
    const accessRole = this.getUserRoleInAccess(document, userdata);
    const legacyOwner = this.isUserLegacyOwner(document, userdata);
    if (legacyOwner) return true;

    switch (minimumRole) {
      case EntityAccessRole.viewer:
        return !!accessRole;
      case EntityAccessRole.editor:
        return accessRole === EntityAccessRole.editor || accessRole === EntityAccessRole.owner;
      case EntityAccessRole.owner:
        return accessRole === EntityAccessRole.owner;
    }
  }
})();

const getUserRole = async (options: {
  userdata?: ServerDocument<IUserData> | IUserData;
  params: { identifier: string; collection: string } | unknown;
  body: { username: string } | unknown;
}): Promise<EntityAccessRole | undefined> => {
  if (!options.userdata) return;

  const identifier = (() => {
    if (isDocument(options.body)) return options.body._id;
    if (isIdentifierParam(options.params)) return options.params.identifier;
    return;
  })();
  if (!identifier) return;

  const collection = (() => {
    if (isCollectionParam(options.params)) return options.params.collection;
    return;
  })();
  if (!collection) return;
  const document = await collectionMap[collection as Collection].findOne({
    _id: new ObjectId(identifier),
  });
  if (!document) return;

  // Access field check
  const userRoleInAccess = PermissionHelper.getUserRoleInAccess(document, options.userdata);

  // Legacy check
  const isUserLegacyOwner = PermissionHelper.isUserLegacyOwner(document, options.userdata);

  return isUserLegacyOwner ? EntityAccessRole.owner : userRoleInAccess;
};

export const permissionService = new Elysia({ name: 'permissionService' })
  .use(authService)
  .resolve({ as: 'global' }, async context => {
    const userRole = await getUserRole(context);
    return { userRole };
  })
  .macro({
    hasRole: (role: EntityAccessRole) => ({
      resolve: async ({ userRole, userdata, status }) => {
        log(
          `Checking if ${userdata?.username ?? 'guest'} has minimum role. Required: "${role}" | User: "${userRole}"`,
        );
        if (role === EntityAccessRole.owner) {
          if (userRole !== EntityAccessRole.owner) {
            return status('Forbidden');
          }
        } else if (role === EntityAccessRole.editor) {
          if (userRole !== EntityAccessRole.editor && userRole !== EntityAccessRole.owner) {
            return status('Forbidden');
          }
        } else {
          if (!userRole) return status('Forbidden');
        }
        return;
      },
    }),
  });
