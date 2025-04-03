import type { IStrippedUserData, IUserData } from 'src/common';
import type { ServerDocument } from './document-with-objectid-type';

/**
 * Strip user data to only include necessary fields for public facing API methods
 * @param user
 * @returns
 */
export const stripUser = (
  user:
    | IUserData
    | IStrippedUserData
    | ServerDocument<IUserData>
    | ServerDocument<IStrippedUserData>,
): IStrippedUserData => {
  return {
    _id: user._id.toString(),
    fullname: user.fullname,
    username: user.username,
  };
};
