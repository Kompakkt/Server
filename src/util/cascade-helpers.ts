import type { IDigitalEntity, IEntity } from 'src/common';
import type { ServerDocument } from './document-with-objectid-type';
import { compilationCollection, entityCollection } from 'src/mongo';
import { ObjectId } from 'mongodb';

export const findParentEntities = async (
  digitalEntity: IDigitalEntity | ServerDocument<IDigitalEntity>,
) => {
  const results = await entityCollection
    .find({
      $or: [
        { 'relatedDigitalEntity._id': digitalEntity._id.toString() },
        { 'relatedDigitalEntity._id': new ObjectId(digitalEntity._id) },
      ],
    })
    .toArray();
  return results;
};

export const findParentCompilations = async (entity: IEntity | ServerDocument<IEntity>) => {
  const results = await compilationCollection
    .find({
      [`entities.${entity._id.toString()}`]: { $exists: true },
    })
    .toArray();
  return results;
};
