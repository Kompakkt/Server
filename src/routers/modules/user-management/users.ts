import { ObjectId } from 'mongodb';
import { Collection, isDocument, type IDocument, type ITag, type IUserData } from 'src/common';
import { userCollection } from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { resolveAny } from '../api.v1/resolving-strategies';
import { log } from 'src/logger';

export const makeUserOwnerOf = async ({
  docs,
  collection,
  userdata,
}: {
  docs: ServerDocument<IDocument> | ServerDocument<IDocument>[];
  collection: Collection;
  userdata: ServerDocument<IUserData>;
}): Promise<boolean> => {
  const docIds = (Array.isArray(docs) ? docs : [docs]).map(doc => doc._id.toString());
  if (!userdata.data) userdata.data = {};
  if (!userdata.data[collection]) userdata.data[collection] = [];
  userdata.data[collection] = Array.from(new Set(userdata.data[collection].concat(docIds)));
  const updateResult = await userCollection.updateOne(
    { _id: new ObjectId(userdata._id) },
    { $set: { data: userdata.data } },
  );
  return !!updateResult.modifiedCount;
};

export const undoUserOwnerOf = async (obj: {
  docs: ServerDocument<IDocument> | ServerDocument<IDocument>[];
  collection: Collection;
  userdata: ServerDocument<IUserData>;
}): Promise<boolean> => {
  const docs = Array.isArray(obj.docs) ? obj.docs : [obj.docs];
  const docIds = docs.map(doc => doc._id.toString());
  obj.userdata.data[obj.collection] = obj.userdata.data[obj.collection]?.filter(
    docId => docId && !docIds.includes(docId.toString()),
  );
  const updateResult = await userCollection.updateOne(
    { _id: new ObjectId(obj.userdata._id) },
    { $set: { data: obj.userdata.data } },
  );
  return !!updateResult.modifiedCount;
};

export const checkIsOwner = async (obj: {
  doc: ServerDocument<IDocument>;
  collection: Collection;
  userdata: ServerDocument<IUserData>;
}): Promise<boolean> => {
  const docId = obj.doc._id.toString();

  const normalizedData =
    obj.userdata.data[obj.collection]?.map(doc => {
      if (typeof doc === 'string') return doc;
      if (doc instanceof ObjectId) return doc.toString();
      if (isDocument(doc)) return doc._id.toString();
      return undefined;
    }) ?? [];
  // log(`checkIsOwner`, { collection: obj.collection, data: normalizedData, id: docId });
  return normalizedData.includes(docId) ?? false;
};

type BufferObject = { buffer: Uint8Array };
const isBufferObject = (obj: object): obj is BufferObject => {
  return obj && typeof obj === 'object' && 'buffer' in obj;
};

export const resolveUserDocument = async (
  docId: string | IDocument | ITag | null | ObjectId | BufferObject,
  collection: Collection,
  depth?: number,
) => {
  if (!docId) return undefined;
  const query =
    typeof docId === 'string'
      ? { _id: new ObjectId(docId) }
      : typeof docId === 'object'
        ? docId instanceof ObjectId
          ? { _id: docId }
          : isBufferObject(docId)
            ? { _id: new ObjectId(docId.buffer) }
            : { _id: new ObjectId(docId._id.toString()) }
        : undefined;
  return query ? resolveAny(collection, query, depth) : undefined;
};

export const resolveUsersDataObject = async (
  inputUser: ServerDocument<IUserData>,
  dataTypes?: Array<keyof typeof Collection>,
  depth?: number,
) => {
  const user = structuredClone(inputUser);
  try {
    if (!user.data) {
      user.data = {};
    }
    for (const collection of Object.values(Collection)) {
      if (!user.data?.[collection]) {
        user.data[collection] = [];
      }
      if (dataTypes && !dataTypes.includes(collection)) {
        continue;
      }
      const resolved = await Promise.all(
        Array.from(new Set(user.data[collection])).map(docId =>
          resolveUserDocument(docId, collection, depth),
        ),
      );
      const filtered = resolved.filter((obj): obj is IDocument => obj !== undefined);
      user.data[collection] = filtered;
    }
  } catch (e) {
    log(e);
  }
  return user;
};
