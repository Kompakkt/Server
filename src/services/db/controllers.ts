// prettier-ignore
import { IUserData, IAddress, IAnnotation, ICompilation, IContact, IDigitalEntity, IEntity, IGroup, IInstitution, IPerson, IPhysicalEntity, ITag } from '../../common/interfaces';
// prettier-ignore
import { ObjectId, Filter, Db, OptionalId, UpdateFilter, UpdateOptions, FindOptions } from 'mongodb';
import { Configuration } from '../configuration';
import DBClient from './client';
import { Logger } from '../logger';
import { IPasswordEntry } from '../express';

// TODO: Add resolving strategy to controller
// TODO: Add saving strategy to controller
class Controller<T> {
  private coll: string;
  private db: Db;
  constructor(collectionName: string, database: Db) {
    this.coll = collectionName;
    this.db = database;
  }
  get collection() {
    return this.db.collection<T>(this.coll);
  }
  public findOne(filter: Filter<T>) {
    return this.collection.findOne<T>(filter).catch(err => {
      Logger.err('Failed findOne', this.db.databaseName, this.coll, filter, err);
      return undefined;
    });
  }
  public find(filter: Filter<T>, options: FindOptions = {}) {
    return this.collection
      .find<T>(filter, options)
      .toArray()
      .catch(err => {
        Logger.err('Failed findOne', this.db.databaseName, this.coll, filter, err);
        return undefined;
      });
  }
  public findCursor(filter: Filter<T>, options: FindOptions = {}) {
    return this.collection.find<T>(filter, options);
  }
  public findAllCursor() {
    return this.collection.find<T>({});
  }
  public findAll() {
    return this.findAllCursor().toArray();
  }
  public insertOne(doc: OptionalId<T>) {
    return this.collection.insertOne(doc).catch(err => {
      Logger.err('Failed insertOne', this.db.databaseName, this.coll, doc, err);
      return undefined;
    });
  }
  public insertMany(docs: Array<OptionalId<T>>) {
    return this.collection.insertMany(docs).catch(err => {
      Logger.err('Failed insertMany', this.db.databaseName, this.coll, docs, err);
      return undefined;
    });
  }
  public updateOne(filter: Filter<T>, update: UpdateFilter<T>, options: UpdateOptions = {}) {
    return this.collection.updateOne(filter, update, options).catch(err => {
      Logger.err('Failed updateOne', this.db.databaseName, this.coll, filter, update, options, err);
      return undefined;
    });
  }
  public deleteOne(filter: Filter<T>) {
    return this.collection.deleteOne(filter).catch(err => {
      Logger.err('Failed deleteOne', this.db.databaseName, this.coll, filter, err);
      return undefined;
    });
  }
}

// TODO: Move somewhere else
export interface IMailEntry {
  _id: string | ObjectId;
  target: string;
  content: {
    mailbody: string;
    subject: string;
  };
  timestamp: string;
  user: IUserData;
  answered: boolean;
  mailSent: boolean;
}

const AccountsDB = DBClient.Client.db(Configuration.Mongo.AccountsDB);
const RepositoryDB = DBClient.Client.db(Configuration.Mongo.RepositoryDB);

export const Accounts = {
  users: new Controller<IUserData>('users', AccountsDB),
  passwords: new Controller<IPasswordEntry>('passwords', AccountsDB),
  mails: new Controller<IMailEntry>('mails', AccountsDB),
};

export const Repo = {
  address: new Controller<IAddress>('address', RepositoryDB),
  annotation: new Controller<IAnnotation>('annotation', RepositoryDB),
  compilation: new Controller<ICompilation>('compilation', RepositoryDB),
  contact: new Controller<IContact>('contact', RepositoryDB),
  digitalentity: new Controller<IDigitalEntity>('digitalentity', RepositoryDB),
  entity: new Controller<IEntity>('entity', RepositoryDB),
  group: new Controller<IGroup>('group', RepositoryDB),
  institution: new Controller<IInstitution>('institution', RepositoryDB),
  person: new Controller<IPerson>('person', RepositoryDB),
  physicalentity: new Controller<IPhysicalEntity>('physicalentity', RepositoryDB),
  tag: new Controller<ITag>('tag', RepositoryDB),
  get: <T extends unknown>(coll: string) => (Repo as any)[coll] as Controller<T> | undefined,
};
