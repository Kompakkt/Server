import { ObjectId } from 'mongodb';
import { Collection, type IDocument, type IUserData } from 'src/common';
import { userCollection } from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { resolveAny } from '../api.v1/resolving-strategies';

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
  return obj.userdata.data[obj.collection]?.includes(docId) ?? false;
};

export const resolveUsersDataObject = async (inputUser: ServerDocument<IUserData>) => {
  const user = structuredClone(inputUser);
  try {
    if (!user.data) {
      user.data = {};
    }
    for (const collection of Object.values(Collection)) {
      if (!user.data?.[collection]) {
        user.data[collection] = [];
      }
      const resolved = await Promise.all(
        Array.from(new Set(user.data[collection])).map(docId => {
          if (!docId) return undefined;
          if (typeof docId === 'string')
            return resolveAny(collection, { _id: new ObjectId(docId) });
          if (typeof docId === 'object') {
            if (docId instanceof ObjectId) return resolveAny(collection, { _id: docId });
            return resolveAny(collection, {
              _id: new ObjectId(docId._id.toString()),
            });
          }
          return undefined;
        }),
      );
      const filtered = resolved.filter((obj): obj is IDocument => obj !== undefined);
      user.data[collection] = filtered;
    }
  } catch (e) {
    console.log(e);
  }
  return user;
};
