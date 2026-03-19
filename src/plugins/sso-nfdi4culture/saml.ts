import { type Profile } from '@node-saml/node-saml';
import { ObjectId } from 'mongodb';
import { UserRank, type IUserData } from '@kompakkt/common';
import { err, log, warn } from 'src/logger';
import type { ServerDocument } from 'src/util/document-with-objectid-type';

export const samlProfileToUser = (profile: Profile) => {
  try {
    // TODO remove after debugging
    log('SAML Profile:', profile);
    const mail = profile.mail ?? profile.email;
    if (!profile.uid || !mail || !profile.givenName || !profile.sn) {
      warn('Missing required fields from SAML response');
      return false;
    }
    const adjustedUser: ServerDocument<IUserData> = {
      _id: new ObjectId(),
      username: profile.uid.toString(),
      fullname: profile.cn?.toString() ?? `${profile.givenName} ${profile.sn}`,
      prename: profile.givenName.toString(),
      surname: profile.sn.toString(),
      mail: mail,
      role: UserRank.uploader,
      data: {},
      strategy: 'sso-nfdi4culture',
      profiles: [],
    };

    log(`${adjustedUser.fullname} logging in using SAML strategy`);

    return adjustedUser;
  } catch (error) {
    err('SAML Strategy Error:', error);
    return false;
  }
};
