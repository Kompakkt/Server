import { ObjectId } from 'mongodb';
import { Collection, type IUserData } from 'src/common';
import { log, warn } from 'src/logger';
import { annotationCollection, collectionMap, compilationCollection } from 'src/mongo';
import { combineUpdateResult } from 'src/util/combine-mongodb-results';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { undoUserOwnerOf } from '../user-management/users';
import { HookManager } from './hooks';

const removeEntityFromCompilations = async (entityId: string | ObjectId) =>
  compilationCollection
    .find({ [`entities.${entityId.toString()}`]: { $exists: 1 } })
    .toArray()
    .then(compilations =>
      compilations.map(c => {
        delete c.entities[entityId.toString()];
        return c;
      }),
    )
    .then(updatedCompilations =>
      Promise.all(
        updatedCompilations.map(c =>
          compilationCollection.updateOne(
            { _id: new ObjectId(c._id.toString()) },
            { $set: { entities: c.entities } },
          ),
        ),
      ),
    )
    .then(updateResults => combineUpdateResult(updateResults));

const deleteAnnotationsAboutEntityOrCompilation = async (
  docId: string | ObjectId,
  type: Collection.entity | Collection.compilation,
) =>
  annotationCollection
    .find(
      type === Collection.entity
        ? {
            'target.source.relatedEntity': docId.toString(),
            '$or': [
              { 'target.source.relatedCompilation': { $exists: false } },
              { 'target.source.relatedCompilation': '' },
            ],
          }
        : { 'target.source.relatedCompilation': docId.toString() },
    )
    .toArray()
    .then(annotations =>
      annotationCollection.deleteMany({
        _id: { $in: annotations.map(a => new ObjectId(a._id.toString())) },
      }),
    );

export const deleteAny = async ({
  collection,
  _id,
  userdata,
}: {
  collection: Collection;
  _id: string | ObjectId;
  userdata: ServerDocument<IUserData>;
}): Promise<{ success: boolean; error?: string }> => {
  const document = await collectionMap[collection].findOne({ _id: new ObjectId(_id.toString()) });
  if (!document) {
    const message = `Document not found for ${collection} ${_id}`;
    warn(message);
    return { success: false, error: message };
  }

  const deleteResult = await collectionMap[collection].deleteOne({
    _id: new ObjectId(_id.toString()),
  });
  if (!deleteResult || deleteResult.deletedCount === 0) {
    const message = `Failed deleting ${collection} ${_id}`;
    warn(message);
    return { success: false, error: message };
  }

  const undoResult = await undoUserOwnerOf({
    docs: { _id },
    collection,
    userdata,
  });
  if (!undoResult) {
    const message = `Failed removing owner of ${collection} ${_id}`;
    warn(message);
    return { success: false, error: message };
  }

  await HookManager.runHooks(collection, 'onDelete', document);

  switch (collection) {
    case Collection.entity: {
      // Delete entity in compilations by finding compilations,
      // where the _id of the document exists as a key in the .entities field
      // and deleting the entity from the .entities field
      await removeEntityFromCompilations(_id)
        .then(result => {
          log(`Cascade delete entity in compilations result`, result);
        })
        .catch(error => {
          log(`Cascade delete entity in compilations error`, error);
        });

      // Delete annotations related to entity
      await deleteAnnotationsAboutEntityOrCompilation(_id, collection)
        .then(result => {
          log(`Cascade delete annotations related to entity result`, result);
        })
        .catch(error => {
          log(`Cascade delete annotations related to entity error`, error);
        });
      break;
    }
    case Collection.compilation: {
      // Delete annotations related to compilation
      await deleteAnnotationsAboutEntityOrCompilation(_id, collection)
        .then(result => {
          log(`Cascade delete annotations related to compilation result`, result);
        })
        .catch(error => {
          log(`Cascade delete annotations related to compilation error`, error);
        });
      break;
    }
  }

  return { success: true };
};
