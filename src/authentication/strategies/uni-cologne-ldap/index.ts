import { ObjectId } from 'mongodb';
import { type IUserData, UserRank } from 'src/common';
import { err, log } from 'src/logger';
import { userCollection } from 'src/mongo';
import {
  type AuthResult,
  type AuthWithUsernamePassword,
  AuthenticationStrategy,
} from '../strategy';

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

const sendLDAPSearchRequest = async (
  username: string,
  password: string,
): Promise<UniCologneLDAPResponse | Error> => {
  return Bun.fetch('localhost:3000/search', {
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
    .catch(err => new Error(err.toString()));
};

export class UniCologneLDAPStrategy extends AuthenticationStrategy<AuthWithUsernamePassword> {
  strategyName = 'UniCologneLDAPStrategy';

  async isAvailable(): Promise<boolean> {
    const result = await sendLDAPSearchRequest('test', 'test');
    return !(result instanceof Error || !result);
  }

  async authenticate(authObj: AuthWithUsernamePassword): Promise<AuthResult> {
    const result = await sendLDAPSearchRequest(authObj.username, authObj.password);
    if (result instanceof Error) {
      return new Error('Failed to authenticate');
    }

    // If the fields are not returned, this likely means that the user does not exist or the password is wrong
    const { uid: username, givenName: prename, sn: surname, mail } = result;
    if (!prename || !surname || !mail || !username) {
      return new Error('Invalid username or password');
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
      log(`${user.fullname} is not registered yet. Creating new account...`);

      const insertResult = await userCollection.insertOne({
        ...user,
        _id: new ObjectId(),
      });
      if (!insertResult.acknowledged) {
        return new Error('Failed to authenticate');
      }

      const insertedUser = await userCollection.findOne({ _id: insertResult.insertedId });
      if (!insertedUser) {
        return new Error('Failed to authenticate');
      }

      return insertedUser;
    }

    log(`Logging in existing LDAP account ${user.fullname}`);
    return resolvedUser;
  }
}
