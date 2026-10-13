import { type Collection, type IPublicProfile } from '@kompakkt/common';
import type { ObjectId } from 'mongodb';
import { searchService } from 'src/sonic';

export const PROFILE_SONIC_COLLECTION = 'profile' as Collection;

/** Index (or re-index) a public profile in Sonic. Applies to personal and organizational profiles. */
export const indexProfile = (profile: IPublicProfile & { _id: ObjectId | string }): void => {
  searchService.updateDocument(PROFILE_SONIC_COLLECTION, profile);
};

/** Remove a profile from the Sonic index. */
export const deleteProfileFromIndex = (id: string): void => {
  searchService.deleteDocument(PROFILE_SONIC_COLLECTION, { _id: id });
};
