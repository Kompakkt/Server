import { Err, Ok } from '@thames/monads';
import { type IUserData, UserRank } from 'src/common';
import {
  AuthenticationStrategy,
  type AuthResult,
  type AuthWithUsernamePassword,
} from '../strategy';
import { log } from 'src/logger';
import { userCollection } from 'src/mongo';

export type UniCologneLDAPResponse = {
  objectClass: string[];
  UniCologneFaculty: string;
  schacGender: string;
  givenName: string;
  uid: string;
  mail: string;
  UniColognePersonStatus: string;
  sn: string;
  description: string;
  userPassword: string;
  dn: string;
};

const sendLDAPSearchRequest = (username: string, password: string) => {
  return Bun.fetch(`localhost:3000/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      host: 'ldaps://ldapproxy-hvtzent-1.rrz.uni-koeln.de',
      bindDn: `uid=${username},ou=People,dc=uni-koeln,dc=de`,
      bindPassword: password,
      searchBase: 'ou=People,dc=uni-koeln,dc=de',
      searchFilter: `(uid=${username})`,
    }),
  })
    .then(res => res.json())
    .then(res => res as UniCologneLDAPResponse)
    .catch(() => undefined);
};

export class UniCologneLDAPStrategy extends AuthenticationStrategy<AuthWithUsernamePassword> {
  strategyName: string = 'UniCologneLDAPStrategy';

  async isAvailable(): Promise<boolean> {
    return sendLDAPSearchRequest('test', 'test')
      .then(result => result !== undefined)
      .catch(() => false);
  }

  async authenticate(authObj: AuthWithUsernamePassword): Promise<AuthResult> {
    const result = await sendLDAPSearchRequest(authObj.username, authObj.password);
    if (!result) {
      return Err('Failed to authenticate');
    }

    // If the fields are not returned, this likely means that the user does not exist or the password is wrong
    const { uid: username, givenName: prename, sn: surname, mail } = result;
    if (!prename || !surname || !mail || !username) {
      return Err('Invalid username or password');
    }

    const user: Omit<Omit<IUserData, 'sessionID'>, '_id'> & { strategy: string } = {
      username,
      fullname: `${prename} ${surname}`,
      prename,
      surname,
      mail,
      role: UserRank.uploader,
      data: {},
      strategy: 'ldap',
    };

    log(`${user.fullname} logging in using LDAP strategy`);

    const resolvedUser = await userCollection.findOne({ username, mail });
    if (!resolvedUser) {
      // TODO
      // await userCollection.insertOne(user);
      return Err('Failed to authenticate');
    }

    return Ok(resolvedUser);
  }
}
