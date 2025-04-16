import type { IDocument } from 'src/common';
import type { ServerDocument } from './document-with-objectid-type';
import type { InferIdType, UpdateResult } from 'mongodb';

type CombinedUpdateResult<T extends ServerDocument<IDocument>> = {
  allAcknowledged: boolean;
  totalModifiedCount: number;
  upsertedIds: Array<InferIdType<T> | null>;
  totalUpsertedCount: number;
  totalMatchedCount: number;
};

export const combineUpdateResult = <T extends ServerDocument<IDocument>>(
  updateResults: UpdateResult<T>[],
): CombinedUpdateResult<T> => {
  return {
    allAcknowledged: updateResults.every(result => result.acknowledged),
    totalModifiedCount: updateResults.reduce((acc, result) => acc + result.modifiedCount, 0),
    upsertedIds: updateResults.map(result => result.upsertedId).filter(Boolean),
    totalUpsertedCount: updateResults.reduce((acc, result) => acc + result.upsertedCount, 0),
    totalMatchedCount: updateResults.reduce((acc, result) => acc + result.matchedCount, 0),
  };
};
