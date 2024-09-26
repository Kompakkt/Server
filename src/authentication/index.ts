import { Err } from '@thames/monads';
import { MongoDbStrategy } from './strategies/mongodb';
import { AuthenticationStrategy, type AuthResult, type AuthWithUsernamePassword } from './strategies/strategy';
import { UniCologneLDAPStrategy } from './strategies/uni-cologne-ldap';
import { info } from 'src/logger';

const strategies = {
  UniCologneLDAPStrategy: new UniCologneLDAPStrategy(),
  MongoDbStrategy: new MongoDbStrategy(),
} as const;

export const AuthController = new (class {
  #disabledStrategies = new Set<keyof typeof strategies>();

  get strategies(): (keyof typeof strategies)[] {
    return Object.keys(strategies) as (keyof typeof strategies)[];
  }

  constructor() {
    info(`Configured authentication strategies: ${this.strategies.join(', ')}`);
    
    for (const strategy of this.strategies) {
      strategies[strategy].isAvailable().then(isAvailable => {
        if (!isAvailable) {
          info(`Authentication strategy ${strategy} is configured but not available`);
          this.#disabledStrategies.add(strategy);
        }
      })
    }
  }

  async authenticate<T extends keyof typeof strategies>(
    strategy: T,
    authObj: Parameters<(typeof strategies)[T]['authenticate']>[0],
  ): Promise<AuthResult> {
    if (this.#disabledStrategies.has(strategy)) {
      return Err('Authentication strategy is not available');
    }
    const strategyClass = strategies[strategy];
    if (!strategyClass) {
      return Err('Unknown authentication strategy');
    }
    return strategyClass.authenticate(authObj);
  }

  /**
   * Try to authenticate with any of the strategies, preferring the first one that works.
   * Local authentication is tried first.
   * @param authObj 
   * @returns 
   */
  async authenticateAnyWithUsernamePassword(authObj: AuthWithUsernamePassword): Promise<AuthResult> {
    let result: AuthResult;
    for (const strategy of ['MongoDbStrategy', 'UniCologneLDAPStrategy']) {
      result = await this.authenticate(strategy as keyof typeof strategies, authObj);
      if (result.isErr()) {
        continue;
      } else {
        break;
      }
    }
    return result!;
  }
})();
