import { Collection, ObjectId } from 'mongodb';

import { IAnnotation, ICompilation, ILDAPData, IModel } from '../interfaces';

import { Logger } from './logger';
import { Mongo } from './mongo';

const updateAnnotationList =
  async (modelOrCompId: string, add_to_coll: string, annotationId: string) => {
    const obj: IModel | ICompilation = await Mongo.resolve(modelOrCompId, add_to_coll, 0);
    // Create annotationList if missing
    obj.annotationList = (obj.annotationList)
      ? obj.annotationList : [];
    // Filter null
    obj.annotationList = obj.annotationList
      .filter(_annotation => _annotation);

    const doesAnnotationExist = obj.annotationList
      .filter(_annotation => _annotation)
      .find((_annotation: IAnnotation) =>
        (_annotation._id) ? _annotation._id.toString() === annotationId
          : _annotation.toString() === annotationId);

    // Add annotation to list if it doesn't exist
    if (!doesAnnotationExist) obj.annotationList.push(new ObjectId(annotationId));

    // We resolved the compilation earlier, so now we have to replace
    // the resolved annotations with their ObjectId again
    obj.annotationList = obj.annotationList
      .map((_annotation: IAnnotation) =>
        (_annotation._id) ? new ObjectId(_annotation._id) : _annotation);

    return obj;
  };

const saveCompilation = async (compilation: ICompilation, userData: ILDAPData) => {
  compilation.annotationList = (compilation.annotationList)
    ? compilation.annotationList : [];
  compilation.relatedOwner = {
    _id: userData._id,
    username: userData.username,
    fullname: userData.fullname,
  };
  // Compilations should have all their models referenced by _id
  compilation.models =
    compilation.models
      .filter(model => model)
      .map((model: IModel) => ({ _id: new ObjectId(model['_id']) }));

  await Mongo.insertCurrentUserData(userData, compilation._id, 'compilation');
  return compilation;
};

const saveAnnotation = async (annotation: IAnnotation, userData: ILDAPData, doesObjectExist: boolean) => {
  return new Promise<IAnnotation>(async (resolve, reject) => {
    // If the Annotation already exists, check for owner
    const isAnnotationOwner = (doesObjectExist)
      ? await Mongo.isUserOwnerOfObject(userData, annotation._id)
      : true;
    // Check if anything was missing for safety
    if (!annotation || !annotation.target || !annotation.target.source) {
      return reject({
        status: 'error', message: 'Invalid annotation',
        invalidObject: annotation,
      });
    }
    const source = annotation.target.source;
    if (!source) {
      return reject({ status: 'error', message: 'Missing source' });
    }
    if (!annotation.body || !annotation.body.content
      || !annotation.body.content.relatedPerspective) {
      return reject({ status: 'error', message: 'Missing body.content.relatedPerspective' });
    }
    annotation.body.content.relatedPerspective.preview = await Mongo.saveBase64toImage(
      annotation.body.content.relatedPerspective.preview, 'annotation', annotation._id);

    const relatedModelId: string | undefined = source.relatedModel;
    const relatedCompId: string | undefined = source.relatedCompilation;
    // Check if === undefined because otherwise this quits on empty string
    if (relatedModelId === undefined || relatedCompId === undefined) {
      return reject({ status: 'error', message: 'Related model or compilation undefined' });
    }

    const validModel = ObjectId.isValid(relatedModelId);
    const validCompilation = ObjectId.isValid(relatedCompId);

    if (!validModel) {
      return reject({ status: 'error', message: 'Invalid related model id' });
    }

    // Case: Trying to change Default Annotations
    const isModelOwner = await Mongo.isUserOwnerOfObject(userData, relatedModelId);
    if (!validCompilation && !isModelOwner) {
      return reject({ status: 'error', message: 'Permission denied' });
    }

    // Case: Compilation owner trying to re-rank annotations
    const isCompilationOwner = await Mongo.isUserOwnerOfObject(userData, relatedCompId);
    if (!isAnnotationOwner) {
      if (isCompilationOwner) {
        const oldAnnotation: IAnnotation | null = await Mongo.resolve(annotation, 'annotation');
        // Compilation owner is not supposed to change the annotation body
        if (oldAnnotation && oldAnnotation.body === annotation.body) {
          return reject({ status: 'error', message: 'Permission denied' });
        }
      } else {
        return reject({ status: 'error', message: 'Permission denied' });
      }
    }

    // Update data inside of annotation
    annotation.generated = (annotation.generated)
      ? annotation.generated : new Date().toISOString();
    annotation.lastModificationDate = new Date().toISOString();
    annotation.lastModifiedBy._id = userData._id;
    annotation.lastModifiedBy.name = userData.fullname;
    annotation.lastModifiedBy.type = 'person';

    const modelOrCompId = (!validCompilation) ? relatedModelId : relatedCompId;
    const requestedCollection = (!validCompilation) ? 'model' : 'compilation';
    const resultModelOrComp =
      await updateAnnotationList(
        modelOrCompId, requestedCollection,
        annotation._id.toString());

    // Finally we update the annotationList in the compilation
    const coll: Collection = Mongo.getObjectsRepository()
      .collection(requestedCollection);
    const listUpdateResult = await coll
      .updateOne(
        { _id: new ObjectId(modelOrCompId) },
        { $set: { annotationList: resultModelOrComp.annotationList } });

    if (listUpdateResult.result.ok !== 1) {
      Logger.err(`Failed updating annotationList of ${requestedCollection} ${modelOrCompId}`);
      return reject({ status: 'error' });
    }

    if (isAnnotationOwner) {
      await Mongo.insertCurrentUserData(userData, annotation._id, 'annotation');
    }
    resolve(annotation);
  });
};

const saveModel = async (model: IModel, userData: ILDAPData) => {
  /* Preview image URLs might have a corrupted address
 * because of Kompakkt runnning in an iframe
 * This removes the host address from the URL
 * so images will load correctly */
  if (model.settings && model.settings.preview) {
    model.settings.preview = await Mongo.saveBase64toImage(
      model.settings.preview, 'model', model._id);
  }
  await Mongo.insertCurrentUserData(userData, model._id, 'model');
  return model;
};

export { saveAnnotation, saveCompilation, saveModel };
