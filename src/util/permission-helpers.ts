import type { IStrippedUserData, IUserData, IWhitelist } from 'src/common';
import type { ServerDocument } from './document-with-objectid-type';

export const isUserWhitelisted = (
  entity: IWhitelist,
  userdata?: ServerDocument<IUserData> | IStrippedUserData,
) => {
  if (!userdata) return false;
  return entity.whitelist.persons.some(p => p._id === userdata._id.toString());
};
