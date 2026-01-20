import { info } from 'src/logger';
import { MongoDbStrategy } from './strategies/mongodb';
import { type AuthResult, type AuthWithUsernamePassword } from './strategies/strategy';

export const AuthController = new (class {
  readonly strategies = {
    MongoDbStrategy: new MongoDbStrategy(),
  };
  #disabledStrategies = new Set<string>();

  constructor() {
    info(`Configured authentication strategies: ${Object.keys(this.strategies).join(', ')}`);

    for (const [name, strategy] of Object.entries(this.strategies)) {
      strategy.isAvailable().then(isAvailable => {
        if (!isAvailable) {
          info(`Authentication strategy ${strategy.strategyName} is configured but not available`);
          this.#disabledStrategies.add(name);
        }
      });
    }
  }

  get availableStrategies(): string[] {
    return Object.keys(this.strategies).filter(strategy => !this.#disabledStrategies.has(strategy));
  }

  async authenticate<T extends keyof typeof this.strategies>(
    strategy: T,
    authObj: Parameters<(typeof this.strategies)[T]['authenticate']>[0],
  ): Promise<AuthResult> {
    if (this.#disabledStrategies.has(strategy)) {
      return new Error('Authentication strategy is not available');
    }
    const strategyClass = this.strategies[strategy];
    if (!strategyClass) {
      return new Error('Unknown authentication strategy');
    }
    return strategyClass.authenticate(authObj);
  }

  /**
   * Try to authenticate with any of the strategies, preferring the first one that works.
   * Local authentication is tried first.
   * @param authObj
   * @returns
   */
  async authenticateAnyWithUsernamePassword(
    authObj: AuthWithUsernamePassword,
  ): Promise<AuthResult> {
    let result: AuthResult;
    for (const strategy of ['MongoDbStrategy']) {
      result = await this.authenticate(strategy as keyof typeof this.strategies, authObj);
      if (result instanceof Error) {
      } else {
        break;
      }
    }
    return result!;
  }
})();
