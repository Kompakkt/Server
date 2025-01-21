import { type IUserData } from 'src/common';
import type { ServerDocument } from 'src/util/document-with-objectid-type';

export type AuthResult = ServerDocument<IUserData> | Error;

export type AuthWithUsernamePassword = {
  username: string;
  password: string;
};

export abstract class AuthenticationStrategy<AuthObj> {
  abstract strategyName: string;
  abstract isAvailable(): Promise<boolean>;
  abstract authenticate(authObj: AuthObj): Promise<AuthResult>;
}
