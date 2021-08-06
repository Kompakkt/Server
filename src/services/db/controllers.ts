import {
  ObjectId,
  Filter,
  Db,
  OptionalId,
  UpdateFilter,
  UpdateOptions,
  FindOptions,
} from 'mongodb';
import { Configuration } from '../configuration';
import DBClient from './client';
import {
  IUserData,
  IAddress,
  IAnnotation,
  ICompilation,
  IContact,
  IDigitalEntity,
  IEntity,
  IGroup,
  IInstitution,
  IPerson,
  IPhysicalEntity,
  ITag,
} from '../../common/interfaces';
import { Logger } from '../logger';
import { IPasswordEntry } from '../express';

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
  public findAll() {
    return this.collection.find<T>({}).toArray();
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
const EntitiesDB = DBClient.Client.db(Configuration.Mongo.RepositoryDB);

export const Accounts = {
  User: new Controller<IUserData>('users', AccountsDB),
  Password: new Controller<IPasswordEntry>('users', AccountsDB),
  Mail: new Controller<IMailEntry>('mails', AccountsDB),
};

export const Entities = {
  Address: new Controller<IAddress>('address', EntitiesDB),
  Annotation: new Controller<IAnnotation>('annotation', EntitiesDB),
  Compilation: new Controller<ICompilation>('compilation', EntitiesDB),
  Contact: new Controller<IContact>('contact', EntitiesDB),
  DigitalEntity: new Controller<IDigitalEntity>('digitalentity', EntitiesDB),
  Entity: new Controller<IEntity>('entity', EntitiesDB),
  Group: new Controller<IGroup>('group', EntitiesDB),
  Institution: new Controller<IInstitution>('institution', EntitiesDB),
  Person: new Controller<IPerson>('person', EntitiesDB),
  PhysicalEntity: new Controller<IPhysicalEntity>('physicalentity', EntitiesDB),
  Tag: new Controller<ITag>('tag', EntitiesDB),
};
