import Elysia from 'elysia';
import { ObjectId } from 'mongodb';
import {
  Collection,
  EntityAccessRole,
  ProfileMemberRole,
  ProfileType,
  isCollection,
  isEntityAccessRole,
  type IUserData,
} from '@kompakkt/common';
import { log } from 'src/logger';
import { collectionMap, profileCollection } from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { authService } from './auth.service';
import type { AccessField } from '@kompakkt/common';

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
const isAccessObject = (obj: unknown): obj is AccessField => {
  if (!isRecord(obj)) return false;
  return (
    Array.isArray(obj) &&
    obj.every(entry => {
      return (
        isRecord(entry) &&
        hasFieldOfType(entry, '_id', 'string') &&
        hasFieldOfType(entry, 'role', 'string') &&
        Object.values(EntityAccessRole).includes(entry.role as EntityAccessRole)
      );
    })
  );
};

/**
 * List of collections that allows editing by users with EntityAccessRole.editor.
 */
const editorCollections = [Collection.entity, Collection.annotation, Collection.compilation];

export const PermissionHelper = new (class {
  /**
   * Resolve the membership role a user holds in an organization profile.
   * Falls back to the profile document when the user's role-stamped link entry
   * is missing or stale.
   */
  async getMembershipRole(
    profileId: string,
    userdata: ServerDocument<IUserData> | IUserData,
  ): Promise<ProfileMemberRole | undefined> {
    const userId = userdata._id.toString();
    const entry = userdata.profiles?.find(profileEntry => profileEntry.profileId === profileId);
    if (entry?.type !== ProfileType.organization) return;
    if (entry.role) return entry.role;

    const profile = await profileCollection.findOne({ _id: new ObjectId(profileId) });
    if (!profile || profile.type !== ProfileType.organization) return;
    if (profile.ownerId === userId) return ProfileMemberRole.owner;
    return profile.members?.find(member => member.userId === userId)?.role;
  }

  /**
   * Membership baseline: users with no explicit access entry on a document
   * inherit their role from the organization profile that owns the document.
   */
  async getMembershipBaselineRole(
    document: unknown,
    userdata: ServerDocument<IUserData> | IUserData,
  ): Promise<EntityAccessRole | undefined> {
    if (!isRecord(document) || !isRecord(document.creator)) return;
    if (!isRecord(document.creator.profile)) return;
    const ownerProfileId = document.creator.profile.profileId;
    if (typeof ownerProfileId !== 'string') return;

    const membershipRole = await this.getMembershipRole(ownerProfileId, userdata);
    return isEntityAccessRole(membershipRole) ? membershipRole : undefined;
  }

  /**
   * Get the user's role in the document's access field.
   *
   * Resolution order:
   * 1. Explicit entry scoped to the requested profile (`profileId` given).
   * 2. Legacy fallback: entries without a profile reference still grant access.
   * 3. Membership baseline for organization-owned content when the user has
   *    no explicit entry on the document at all.
   */
  async getUserRoleInAccess(
    document: unknown,
    userdata: ServerDocument<IUserData> | IUserData,
    profileId?: string,
  ): Promise<EntityAccessRole | undefined> {
    if (!isDocument(document)) return;
    if (!('access' in document)) return;
    const access = document.access;
    if (!isAccessObject(access)) return;

    const userId = userdata._id.toString();
    const userEntries = access.filter(entry => entry._id === userId);

    if (userEntries.length > 0) {
      if (profileId) {
        const scoped = userEntries.find(entry => entry.profile?.profileId === profileId);
        if (scoped) return scoped.role;
        const legacy = userEntries.find(entry => !entry.profile);
        return legacy?.role;
      }
      const legacy = userEntries.find(entry => !entry.profile);
      return legacy ? legacy.role : userEntries[0]?.role;
    }

    return await this.getMembershipBaselineRole(document, userdata);
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

  async isUserMinimumRole(
    document: unknown,
    userdata: ServerDocument<IUserData> | IUserData,
    minimumRole: EntityAccessRole,
    profileId?: string,
  ) {
    const accessRole = await this.getUserRoleInAccess(document, userdata, profileId);
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

  /**
   * Check if the collection regulates permission via access field and EntityAccessRole.
   */
  isEditorCollection(collection: string) {
    if (!isCollection(collection)) return false;
    return (editorCollections as Collection[]).includes(collection);
  }
})();

const getRequestedProfileId = (context: { body: unknown; query: unknown }): string | undefined => {
  for (const source of [context.body, context.query]) {
    if (isRecord(source) && hasFieldOfType(source, 'profileId', 'string')) {
      return source.profileId as string;
    }
  }
  return;
};

const getUserRole = async (options: {
  userdata?: ServerDocument<IUserData> | IUserData;
  params: { identifier: string; collection: string } | unknown;
  body: { username: string } | unknown;
  query: unknown;
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

  const profileId = getRequestedProfileId(options);

  // Access field check (profile-scoped when the request carries a profileId)
  const userRoleInAccess = await PermissionHelper.getUserRoleInAccess(
    document,
    options.userdata,
    profileId,
  );

  // Legacy check
  const isUserLegacyOwner = PermissionHelper.isUserLegacyOwner(document, options.userdata);

  return isUserLegacyOwner
    ? EntityAccessRole.owner
    : isEntityAccessRole(userRoleInAccess)
      ? userRoleInAccess
      : undefined;
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
