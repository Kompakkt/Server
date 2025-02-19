import { mongoClient, passwordCollection, userCollection } from 'src/mongo';
import { verifyPassword } from 'src/util/authentication-helpers';
import {
  type AuthResult,
  type AuthWithUsernamePassword,
  AuthenticationStrategy,
} from '../strategy';

export class MongoDbStrategy extends AuthenticationStrategy<AuthWithUsernamePassword> {
  strategyName = 'MongoDbStrategy';

  async isAvailable(): Promise<boolean> {
    return mongoClient
      .db('admin')
      .command({ ping: 1 })
      .then(_ => true)
      .catch(_ => false);
  }

  async authenticate({ username, password }: AuthWithUsernamePassword): Promise<AuthResult> {
    const [userFindResult, passwordFindResult] = await Promise.all([
      userCollection.findOne({ username }),
      passwordCollection.findOne({ username }),
    ]);
    if (!userFindResult || !passwordFindResult) {
      return new Error('Incorrect username or password');
    }
    const result = await verifyPassword(password, passwordFindResult);
    if (!result) {
      return new Error('Incorrect username or password');
    }
    return userFindResult;
  }
}
