import { SAML } from '@node-saml/node-saml';
import { UserRank } from 'src/common';
import { err, log, warn } from 'src/logger';

export const samlProfileToUser = (profile: any) => {
  try {
    // TODO remove after debugging
    log('SAML Profile:', profile);
    if (!profile.uid || !profile.mail || !profile.givenName || !profile.sn) {
      warn('Missing required fields from SAML response');
      return false;
    }
    const adjustedUser = {
      username: profile.uid,
      fullname: profile.cn || `${profile.givenName} ${profile.sn}`,
      prename: profile.givenName,
      surname: profile.sn,
      mail: profile.mail,
      role: UserRank.user,
      data: {
        // ...getEmptyUserData(),
      },
      strategy: 'saml',
    };

    log(`${adjustedUser.fullname} logging in using SAML strategy`);

    return adjustedUser;
  } catch (error) {
    err('SAML Strategy Error:', error);
    return false;
  }
};
