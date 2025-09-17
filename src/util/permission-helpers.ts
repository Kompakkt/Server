import type { IStrippedUserData, IUserData, IWhitelist } from 'src/common';
import type { ServerDocument } from './document-with-objectid-type';

export const isUserWhitelisted = (
  entity: IWhitelist,
  userdata?: ServerDocument<IUserData> | IStrippedUserData,
) => {
  if (!userdata) return false;
  const isUserWhitelisted = entity.whitelist.persons
    .concat(entity.whitelist.groups.flatMap(g => [...g.members, ...g.owners, g.creator]))
    .some(p => p._id === userdata._id.toString());
  return isUserWhitelisted;
};
