import { isMongoAvailable, passwordCollection, userCollection } from 'src/mongo';
import {
  type AuthResult,
  type AuthWithUsernamePassword,
  AuthenticationStrategy,
} from '../strategy';
import { verifyPassword } from 'src/util/authentication-helpers';

export class MongoDbStrategy extends AuthenticationStrategy<AuthWithUsernamePassword> {
  strategyName = 'MongoDbStrategy';

  async isAvailable(): Promise<boolean> {
    return isMongoAvailable();
  }

  async authenticate({ username, password }: AuthWithUsernamePassword): Promise<AuthResult> {
    const [userFindResult, passwordFindResult] = await Promise.all([
      userCollection.findOne({ username, strategy: 'local' }),
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
