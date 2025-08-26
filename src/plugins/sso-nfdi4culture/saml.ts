import { type Profile } from '@node-saml/node-saml';
import { UserRank, type IUserData } from 'src/common';
import { err, log, warn } from 'src/logger';

export const samlProfileToUser = (profile: Profile) => {
  try {
    // TODO remove after debugging
    log('SAML Profile:', profile);
    const mail = profile.mail ?? profile.email;
    if (!profile.uid || !mail || !profile.givenName || !profile.sn) {
      warn('Missing required fields from SAML response');
      return false;
    }
    const adjustedUser: Omit<Omit<IUserData, 'sessionID'>, '_id'> & { strategy: string } = {
      username: profile.uid.toString(),
      fullname: profile.cn?.toString() ?? `${profile.givenName} ${profile.sn}`,
      prename: profile.givenName.toString(),
      surname: profile.sn.toString(),
      mail: mail,
      role: UserRank.uploader,
      data: {},
      strategy: 'sso-nfdi4culture',
    };

    log(`${adjustedUser.fullname} logging in using SAML strategy`);

    return adjustedUser;
  } catch (error) {
    err('SAML Strategy Error:', error);
    return false;
  }
};
