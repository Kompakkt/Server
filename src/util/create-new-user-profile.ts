import { ObjectId } from 'mongodb';
import { ProfileType, type IUserData } from '@kompakkt/common';
import { profileCollection } from 'src/mongo';
import { indexProfile } from 'src/util/profile-index';
import type { ServerDocument } from './document-with-objectid-type';

/**
 * Create a new profile for a user and return the profile ID and type to be added to the user's 'profiles' array
 *
 * Note: This creates the database entry for the profile, but does not link it to the user.
 * The returned profile ID and type must be added to the user's 'profiles' array in a separate step.
 * @param user
 * @returns
 */
export const createNewUserProfile = async (user: Omit<ServerDocument<IUserData>, 'profiles'>) => {
  const profile = {
    _id: new ObjectId(),
    displayName: user.fullname,
    type: ProfileType.user,
    description: undefined,
    imageUrl: undefined,
    location: undefined,
    socials: { website: undefined },
  };
  const profileInsertResult = await profileCollection.insertOne(profile).catch(err => {
    console.error('Error inserting profile for new user:', err);
    return null;
  });
  if (!profileInsertResult) {
    throw new Error('Failed creating user profile');
  }

  indexProfile({ ...profile, _id: profileInsertResult.insertedId });

  return {
    profileId: profileInsertResult.insertedId.toString(),
    type: ProfileType.user,
  };
};
