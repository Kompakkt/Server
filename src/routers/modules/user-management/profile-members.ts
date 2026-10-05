import {
  ProfileMemberRole,
  ProfileType,
  type IPublicProfile,
  type IProfileMember,
  type IUserData,
} from '@kompakkt/common';
import { ObjectId } from 'mongodb';
import { profileCollection, userCollection } from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';

export type ProfileAccessCheck =
  | { ok: true; role: ProfileMemberRole; profile: ServerDocument<IPublicProfile> }
  | { ok: false; reason: 'not_found' | 'not_member' };

const rankOf = (role: ProfileMemberRole): number => {
  switch (role) {
    case ProfileMemberRole.viewer:
      return 0;
    case ProfileMemberRole.editor:
      return 1;
    case ProfileMemberRole.owner:
      return 2;
  }
};

/**
 * Resolve which role the user holds for the given profile.
 *
 * Personal profiles grant owner only to the user who links the profile in
 * their `userdata.profiles`. Organization profiles grant owner to the
 * bootstrap owner (`ownerId`) and the stored role to regular members.
 */
export const getProfileAccess = async (
  userdata: ServerDocument<IUserData> | IUserData,
  profileId: string,
): Promise<ProfileAccessCheck> => {
  if (!ObjectId.isValid(profileId)) return { ok: false, reason: 'not_found' };
  const profile = await profileCollection.findOne({ _id: new ObjectId(profileId) });
  if (!profile) return { ok: false, reason: 'not_found' };

  if (profile.type === ProfileType.user) {
    const isLinkedOwner = userdata.profiles?.some(
      entry => entry.type === ProfileType.user && entry.profileId === profileId,
    );
    return isLinkedOwner
      ? { ok: true, role: ProfileMemberRole.owner, profile }
      : { ok: false, reason: 'not_member' };
  }

  const userId = userdata._id.toString();
  if (profile.ownerId === userId) {
    return { ok: true, role: ProfileMemberRole.owner, profile };
  }
  const membership = profile.members?.find(member => member.userId === userId);
  if (membership) {
    return { ok: true, role: membership.role, profile };
  }
  return { ok: false, reason: 'not_member' };
};

export const assertMinProfileRole = (
  check: ProfileAccessCheck,
  minimum: ProfileMemberRole,
): check is Extract<ProfileAccessCheck, { ok: true }> =>
  check.ok && rankOf(check.role) >= rankOf(minimum);

export const addProfileMember = async (
  profileId: string,
  member: IProfileMember,
): Promise<boolean> => {
  const result = await profileCollection.updateOne(
    { '_id': new ObjectId(profileId), 'members.userId': { $ne: member.userId } },
    { $push: { members: member } },
  );
  return result.modifiedCount > 0;
};

export const updateProfileMember = async (
  profileId: string,
  userId: string,
  role: ProfileMemberRole,
): Promise<boolean> => {
  const result = await profileCollection.updateOne(
    { _id: new ObjectId(profileId) },
    { $set: { 'members.$[member].role': role } },
    { arrayFilters: [{ 'member.userId': userId }] },
  );
  return result.modifiedCount > 0;
};

export const removeProfileMember = async (profileId: string, userId: string): Promise<boolean> => {
  const result = await profileCollection.updateOne(
    { _id: new ObjectId(profileId) },
    { $pull: { members: { userId } } },
  );
  return result.modifiedCount > 0;
};

/**
 * Keep the membership role on the user's `IUserData.profiles` entry in sync.
 * Pushes a new entry if the user is not yet linked to the profile.
 */
export const syncMembershipToUser = async (
  userId: string,
  profileId: string,
  role: ProfileMemberRole,
): Promise<void> => {
  const updateResult = await userCollection.updateOne(
    { '_id': new ObjectId(userId), 'profiles.profileId': profileId },
    { $set: { 'profiles.$.role': role } },
  );
  if (updateResult.modifiedCount > 0) return;
  await userCollection.updateOne(
    { _id: new ObjectId(userId) },
    {
      $push: {
        profiles: { profileId, type: ProfileType.organization, role },
      },
    },
  );
};

/** Remove the profile link from every user that still references it. */
export const unlinkProfileFromUsers = async (profileId: string): Promise<void> => {
  await userCollection.updateMany(
    { 'profiles.profileId': profileId },
    { $pull: { profiles: { profileId } } },
  );
};

/** Remove a single user's link entry for the given profile. */
export const removeMembershipFromUser = async (
  profileId: string,
  userId: string,
): Promise<void> => {
  await userCollection.updateOne(
    { _id: new ObjectId(userId) },
    { $pull: { profiles: { profileId } } },
  );
};

/**
 * Resolve a profile the user may act under, with the effective role.
 *
 * Fast path reads the (role-stamped) `userdata.profiles` entry; falls back to
 * a live membership lookup for stale or role-less entries.
 */
export const resolveProfileForUser = async (
  userdata: ServerDocument<IUserData> | IUserData,
  profileId: string,
): Promise<{ profileId: string; type: ProfileType; role: ProfileMemberRole } | null> => {
  const entry = userdata.profiles?.find(profileEntry => profileEntry.profileId === profileId);
  if (entry?.type === ProfileType.user) {
    return { profileId, type: entry.type, role: ProfileMemberRole.owner };
  }
  if (entry?.role) {
    return { profileId, type: entry.type, role: entry.role };
  }
  const check = await getProfileAccess(userdata, profileId);
  if (!check.ok) return null;
  return { profileId, type: check.profile.type, role: check.role };
};
