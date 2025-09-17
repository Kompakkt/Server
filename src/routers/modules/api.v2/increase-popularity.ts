import { ObjectId } from 'mongodb';
import type { Collection } from 'src/common';
import type { ISortable } from 'src/common/interfaces';
import { info } from 'src/logger';
import { collectionMap } from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';

const lastRequestFromAddress = new Map<string, number>();
const popularityIncreaseInterval = 60 * 1000 * 60; // 60 minutes

export const increasePopularity = async (
  document: ServerDocument<ISortable>,
  collection: Collection,
  request: Request,
  server: Bun.Server | null,
) => {
  const address = server?.requestIP(request)?.address;
  if (!address) return;
  const hasher = new Bun.CryptoHasher('md5');
  hasher.update(address);
  const addressHash = hasher.digest('hex'); // Anonymize address
  const key = addressHash + document._id.toString();
  const lastRequest = lastRequestFromAddress.get(key);
  const now = Date.now();
  if (lastRequest && now - lastRequest < popularityIncreaseInterval) {
    // Too soon since last request from this address
    return;
  }
  lastRequestFromAddress.set(key, now);

  info(`Increasing popularity of ${document._id.toString()} in ${collection}`);
  collectionMap[collection].updateOne({ _id: new ObjectId(document._id) }, { $inc: { __hits: 1 } });
};
