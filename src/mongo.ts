import type { BinaryLike } from 'node:crypto';
import { MongoClient, type ObjectId } from 'mongodb';
import type {
  IAddress,
  IAnnotation,
  ICompilation,
  IContact,
  IDigitalEntity,
  IDocument,
  IEntity,
  IGroup,
  IInstitution,
  IPerson,
  IPhysicalEntity,
  ITag,
  IUserData,
} from './common';
import { Collection } from './common';
import { Configuration } from './configuration';
import { info } from './logger';
import type { ETarget } from './mailer';
import type { ServerDocument } from './util/document-with-objectid-type';
import { type IPublicProfile } from './common/interfaces';
import { retryWithBackoff } from './util/retry-with-backoff';
const { Hostname, Port, ClientURL } = Configuration.Mongo;

export const mongoClient = ClientURL
  ? new MongoClient(ClientURL)
  : new MongoClient(`mongodb://${Hostname}:${Port}`, {
      auth: {
        username: 'admin',
        password: 'password',
      },
    });

await retryWithBackoff(async () => await mongoClient.connect())
  .then(() => {
    info('Connected to MongoDB');
  })
  .catch(error => {
    info('Failed to connect to MongoDB');
    process.exit(1);
  });

const db = (name: string) => mongoClient.db(name);

export const accountsDb = db(Configuration.Mongo.AccountsDB);
export const userCollection = accountsDb.collection<ServerDocument<IUserData>>('users');
export const profileCollection = accountsDb.collection<ServerDocument<IPublicProfile>>('profiles');
export type PasswordDocument = {
  username: string;
  password: {
    salt: BinaryLike;
    passwordHash: string;
  };
};
export const passwordCollection = accountsDb.collection<PasswordDocument>('passwords');
export const mailCollection = accountsDb.collection<{
  target: ETarget;
  content: {
    subject: string;
    mailbody: string;
  };
  timestamp: string;
  user: string | IDocument | ObjectId;
  answered: boolean;
  mailSent: boolean;
}>('mails');
export const userTokenCollection = accountsDb.collection<{
  username: string;
  resetToken?: string;
  tokenExpiration?: number;
}>('tokens');
export const followsCollection = accountsDb.collection<{
  follower: string | ObjectId;
  following: string | ObjectId;
}>('follows');

followsCollection.createIndex({ follower: 1, following: 1 }, { unique: true });

export type ApiKeyDocument = {
  routes: string[];
  key: string;
  description: string;
  issueDate: number;
  lastUsed?: number;
  expirationDate?: number;
};
export const apiKeyCollection = accountsDb.collection<ServerDocument<ApiKeyDocument>>('apikeys');

export const entitiesDb = db(Configuration.Mongo.RepositoryDB);
export const entityCollection = entitiesDb.collection<ServerDocument<IEntity>>('entity');
export const groupCollection = entitiesDb.collection<ServerDocument<IGroup>>('group');
export const addressCollection = entitiesDb.collection<ServerDocument<IAddress>>('address');
export const annotationCollection =
  entitiesDb.collection<ServerDocument<IAnnotation>>('annotation');
export const compilationCollection =
  entitiesDb.collection<ServerDocument<ICompilation>>('compilation');
export const contactCollection = entitiesDb.collection<ServerDocument<IContact>>('contact');
export const digitalEntityCollection =
  entitiesDb.collection<ServerDocument<IDigitalEntity>>('digitalentity');
export const institutionCollection =
  entitiesDb.collection<ServerDocument<IInstitution>>('institution');
export const personCollection = entitiesDb.collection<ServerDocument<IPerson>>('person');
export const physicalEntityCollection =
  entitiesDb.collection<ServerDocument<IPhysicalEntity>>('physicalentity');
export const tagCollection = entitiesDb.collection<ServerDocument<ITag>>('tag');

entityCollection.createIndex({ 'relatedDigitalEntity._id': 1 });

export const collectionMap = {
  [Collection.entity]: entityCollection,
  [Collection.group]: groupCollection,
  [Collection.address]: addressCollection,
  [Collection.annotation]: annotationCollection,
  [Collection.compilation]: compilationCollection,
  [Collection.contact]: contactCollection,
  [Collection.digitalentity]: digitalEntityCollection,
  [Collection.institution]: institutionCollection,
  [Collection.person]: personCollection,
  [Collection.physicalentity]: physicalEntityCollection,
  [Collection.tag]: tagCollection,
};
