// prettier-ignore
import { IUserData, IAddress, IAnnotation, ICompilation, IContact, IDigitalEntity, IEntity, IGroup, IInstitution, IPerson, IPhysicalEntity, ITag, Collection } from '../../common/interfaces';
import { Logger } from '../logger';
import { ObjectId } from 'mongodb';

const collections = Object.values(Collection);

Logger.info(`Defined collections: ${collections.join(', ')}`);

export type CollectionName =
  | 'address'
  | 'annotation'
  | 'compilation'
  | 'contact'
  | 'digitalentity'
  | 'entity'
  | 'group'
  | 'institution'
  | 'person'
  | 'physicalentity'
  | 'tag';

export const isValidCollection = (obj: any): obj is CollectionName => {
  return collections.includes(obj.toString());
};

// TODO: limit to entries which are pushable
export type PushableEntry =
  | IAddress
  | IAnnotation
  | ICompilation
  | IContact
  | IDigitalEntity
  | IEntity
  | IGroup
  | IInstitution
  | IPerson
  | IPhysicalEntity
  | ITag;

export interface ICollectionParam {
  collection: CollectionName;
}

export interface IEntityHeadsUp {
  headsUp: {
    user: IUserData;
    doesEntityExist: boolean;
    isValidObjectId: boolean;
    collectionName: CollectionName;
  };
}

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
