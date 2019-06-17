import * as flatten from 'flatten';
import { Collection, ObjectId } from 'mongodb';

// tslint:disable-next-line:max-line-length
import { IAnnotation, ICompilation, ILDAPData, IMetaDataDigitalObject, IMetaDataPhysicalObject, IModel } from '../interfaces';

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

const saveAnnotation = async (
  annotation: IAnnotation, userData: ILDAPData, doesObjectExist: boolean) => {
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

    // Assume invalid data
    const relatedModelId = source.relatedModel as string | undefined;
    const relatedCompId = source.relatedCompilation;
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

const saveDigitalObject = async (digitalobject: IMetaDataDigitalObject) => {
  /**
   * Handle re-submit for changing a finished DigitalObject
   */
  const isResObjIdValid = ObjectId.isValid(digitalobject._id);
  digitalobject._id = isResObjIdValid
    ? new ObjectId(digitalobject._id) : new ObjectId();
  Logger.info(`${isResObjIdValid ? 'Re-' : ''}Submitting DigitalObject ${digitalobject._id}`);

  // We overwrite this in the phyobj loop so we can
  let currentPhyObjId = '';

  //// FILTER FUNCTIONS ////
  const addToRightsOwnerFilter = (person: any) =>
    person['value'] && person['value'].indexOf('add_to_new_rightsowner') !== -1;
  const filterObjectsWithoutID = (obj: any) => ObjectId.isValid(obj._id);

  /**
   * Adds data {field} to a collection {collection}
   * and returns the {_id} of the created object.
   * If {field} already has an {_id} property the server
   * will assume the object already exists in the collection
   * and instead return the existing {_id}
   */
  const addAndGetId = async (in_field, add_to_coll, new_roles?) => {
    let field = in_field;
    if (add_to_coll === 'person') {
      field = await addNestedInstitution(field);
    }
    const coll: Collection = Mongo
      .getObjectsRepository()
      .collection(add_to_coll);
    const isPersonOrInstitution = ['person', 'institution'].includes(add_to_coll);
    const _digId = ((currentPhyObjId !== '') ? currentPhyObjId : digitalobject._id)
      .toString();
    // By default, update/create the document
    // but if its an existing person/institution
    // fetch the object and update roles
    const isIdValid = ObjectId.isValid(field['_id']);
    const _id = (isIdValid) ? new ObjectId(field['_id']) : new ObjectId();
    if (isIdValid) {
      const findResult = await coll.findOne({ _id });
      if (findResult) {
        field = { ...findResult, ...field };
      }
    }
    if (isPersonOrInstitution) {
      const doRolesExist = (field['roles'] !== undefined);

      field['roles'] = doRolesExist ? field['roles'] : {};
      field['roles'][_digId] = field['roles'][_digId]
        ? field['roles'][_digId]
        : [];

      for (const prop of ['institution_role', 'person_role']) {
        if (!field[prop]) continue;
        field[prop] = (new_roles) ? new_roles : field[prop];
        // Add new roles to person or institution
        field['roles'][_digId] = doRolesExist
          ? flatten([field['roles'][_digId], field[prop]])
          : flatten([field[prop]]);
        field['roles'][_digId] = Array.from(new Set(field['roles'][_digId]));
        field[prop] = [];
      }
    }

    // Make sure there are no null roles
    if (field['roles'] && field['roles'][_digId]) {
      field['roles'][_digId] = field['roles'][_digId].filter(obj => obj);
    }
    // We cannot update _id property when upserting
    // so we remove this beforehand
    // tslint:disable-next-line
    delete field['_id'];
    const updateResult = await coll.updateOne(
      { _id },
      { $set: field, $setOnInsert: { _id } },
      { upsert: true });

    const resultId = (updateResult.upsertedId)
      ? updateResult.upsertedId._id
      : _id;
    return { _id: resultId };
  };

  const addNestedInstitution = async person => {
    if (!person['person_institution']) return person;
    if (!(person['person_institution'] instanceof Array)) return person;
    for (let i = 0; i < person['person_institution'].length; i++) {
      if (person['person_institution'][i]['value'] !== 'add_new_institution') continue;
      const institution = person['person_institution_data'][i];
      const newInst = await addAndGetId(institution, 'institution');
      person['person_institution_data'][i] = newInst;
    }
    return person;
  };

  const concatFix = (...arr: any[]) => {
    let result: any[] = [].concat(arr[0]);
    for (let i = 1; i < arr.length; i++) {
      result = result.concat(arr[i]);
    }
    result = result.filter(filterObjectsWithoutID);
    const final: any[] = [];
    for (const res of result) {
      const obj = { _id: new ObjectId(res._id) };
      const filtered = final.filter(_obj => _obj._id.toString() === obj._id.toString());
      if (filtered.length === 0) final.push(obj);
    }
    return final;
  };

  // Always single
  let digobj_rightsowner: any[] = digitalobject.digobj_rightsowner;
  let digobj_rightsowner_person: any[] = digitalobject.digobj_rightsowner_person;
  let digobj_rightsowner_institution: any[] = digitalobject.digobj_rightsowner_institution;
  // Can be multiple
  let contact_person: any[] = digitalobject.contact_person;
  let contact_person_existing: any[] = digitalobject.contact_person_existing;
  let digobj_person: any[] = digitalobject.digobj_person;
  let digobj_person_existing: any[] = digitalobject.digobj_person_existing;
  const digobj_tags: any[] = digitalobject.digobj_tags;
  const phyObjs: any[] = digitalobject.phyObjs;

  const handleRightsOwnerBase = async (
    inArr: any[], existArrs: any[],
    roleProperty: string, add_to_coll: string, fixedRoles?: any[]) => {
    for (let x = 0; x < inArr.length; x++) {
      const toConcat: any = [];
      for (const existArr of existArrs) {
        const filtered = existArr.filter(addToRightsOwnerFilter);
        if (filtered.length !== 1) continue;
        const roles = (filtered[0][roleProperty] && filtered[0][roleProperty].length > 0)
          ? filtered[0][roleProperty] : fixedRoles;
        toConcat.push(roles);
      }
      const newRoles = flatten([inArr[x][roleProperty], toConcat]);
      inArr[x] = await addAndGetId(inArr[x], add_to_coll, newRoles);
    }
  };

  await handleRightsOwnerBase(
    digobj_rightsowner_person, [digobj_person_existing, contact_person_existing],
    'person_role', 'person', ['CONTACT_PERSON']);

  const handleRightsOwnerSelector = async (
    inArr: any[],
    personArr: any[],
    instArr: any[],
    selector: any) => {
    for (const obj of inArr) {
      switch (obj['value']) {
        case 'add_new_person':
          personArr[0] = await addAndGetId({ ...personArr[0] }, 'person');
          break;
        case 'add_new_institution':
          instArr[0] = await addAndGetId({ ...instArr[0] }, 'institution');
          break;
        default:
          const newRightsOwner = { ...obj };
          const personSelector = 1;
          const instSelector = 2;
          const selected = parseInt(selector, 10);
          switch (selected) {
            case personSelector:
              personArr[0] = await addAndGetId(newRightsOwner, 'person');
              break;
            case instSelector:
              instArr[0] = await addAndGetId(newRightsOwner, 'institution');
              break;
            default:
          }
      }
    }
  };

  await handleRightsOwnerSelector(
    digobj_rightsowner, digobj_rightsowner_person,
    digobj_rightsowner_institution, digitalobject.digobj_rightsownerSelector);

  /**
   * Newly added rightsowner persons and institutions can be
   * selected in other input fields as 'same as new rightsowner'.
   * this function handles these cases
   */
  const handleRightsOwnerAndExisting = async (
    inArr: any[],
    outArr: any[],
    add_to_coll: string,
    idIfSame: string | ObjectId,
    roleProperty: string,
    role?: string) => {
    for (const obj of inArr) {
      const newObj = {};
      newObj[roleProperty] = (role) ? role : obj[roleProperty];
      newObj['_id'] = ObjectId.isValid(obj['_id']) ? new ObjectId(obj['_id'])
        : (ObjectId.isValid(idIfSame) ? new ObjectId(idIfSame) : new ObjectId());
      const newRoles = newObj[roleProperty];
      outArr.push(await addAndGetId(newObj, add_to_coll, newRoles));
    }
  };

  /**
   * Simple cases where the item only needs to be added for nesting
   */
  const handleSimpleCases = async (inArrAndOutArr: any[], add_to_coll: string) => {
    for (let i = 0; i < inArrAndOutArr.length; i++) {
      inArrAndOutArr[i] = await addAndGetId(inArrAndOutArr[i], add_to_coll);
    }
  };

  await handleSimpleCases(digobj_rightsowner_institution, 'institution');
  await handleSimpleCases(contact_person, 'person');
  await handleSimpleCases(digobj_person, 'person');
  await handleSimpleCases(digobj_tags, 'tag');

  /**
   * Cases where persons either exist or are added to the new rightsowner
   */
  const _tempId = (digobj_rightsowner_person[0] && digobj_rightsowner_person[0]['_id'])
    ? digobj_rightsowner_person[0]['_id'] : '';
  await handleRightsOwnerAndExisting(
    contact_person_existing, contact_person, 'person',
    _tempId, 'person_role', 'CONTACT_PERSON');
  await handleRightsOwnerAndExisting(
    digobj_person_existing, digobj_person, 'person',
    _tempId, 'person_role');

  for (let i = 0; i < phyObjs.length; i++) {
    const phyObj: IMetaDataPhysicalObject = phyObjs[i];
    let phyobj_rightsowner: any[] = phyObj.phyobj_rightsowner;
    let phyobj_rightsowner_person: any[] = phyObj.phyobj_rightsowner_person;
    let phyobj_rightsowner_institution: any[] = phyObj.phyobj_rightsowner_institution;
    let phyobj_person: any[] = phyObj.phyobj_person;
    let phyobj_person_existing: any[] = phyObj.phyobj_person_existing;
    let phyobj_institution: any[] = phyObj.phyobj_institution;
    let phyobj_institution_existing: any[] = phyObj.phyobj_institution_existing;

    const isPhyObjIdValid = ObjectId.isValid(phyObj._id);
    phyObj._id = isPhyObjIdValid ? new ObjectId(phyObj._id) : new ObjectId();
    currentPhyObjId = phyObj._id.toString();

    await handleRightsOwnerBase(
      phyobj_rightsowner_person, [phyobj_person_existing],
      'person_role', 'person');
    await handleRightsOwnerBase(
      phyobj_rightsowner_institution, [phyobj_institution_existing],
      'institution_role', 'institution');

    await handleRightsOwnerSelector(
      phyobj_rightsowner, phyobj_rightsowner_person,
      phyobj_rightsowner_institution, phyObj.phyobj_rightsownerSelector);

    await handleSimpleCases(phyobj_person, 'person');
    await handleSimpleCases(phyobj_institution, 'institution');

    if (phyobj_rightsowner_person[0]) {
      await handleRightsOwnerAndExisting(
        phyobj_person_existing, phyobj_person, 'person',
        phyobj_rightsowner_person[0], 'person_role');
    } else if (phyobj_rightsowner_institution[0]) {
      await handleRightsOwnerAndExisting(
        phyobj_institution_existing, phyobj_institution, 'institution',
        phyobj_rightsowner_institution[0]['_id'], 'institution_role');
    }

    await handleRightsOwnerAndExisting(
      phyobj_person_existing, phyobj_person, 'person',
      '', 'person_role');
    await handleRightsOwnerAndExisting(
      phyobj_institution_existing, phyobj_institution, 'institution',
      '', 'institution_role');

    phyobj_rightsowner =
      concatFix(phyobj_rightsowner, phyobj_rightsowner_institution, phyobj_rightsowner_person);
    phyobj_person_existing = concatFix(phyobj_person_existing, phyobj_person);
    phyobj_institution_existing = concatFix(phyobj_institution_existing, phyobj_institution);
    phyobj_rightsowner_institution = phyobj_rightsowner_person =
      phyobj_person = phyobj_institution = [];
    const finalPhy = {
      ...phyObj, phyobj_rightsowner, phyobj_rightsowner_person,
      phyobj_rightsowner_institution, phyobj_person, phyobj_person_existing,
      phyobj_institution, phyobj_institution_existing,
    };
    phyObjs[i] = await addAndGetId(finalPhy, 'physicalobject');
  }

  /**
   * Re-assignment:
   * When editing a finished object we want to have all persons/institutions that have been added
   * on the previous submit to be existing persons/institutions, otherwise they would fill up
   * the metadata form in the frontend
   * Also: remove everything without an _id (which is the remainings from tag-input)
   */
  digobj_person_existing = concatFix(digobj_person_existing, digobj_person);
  contact_person_existing = concatFix(contact_person_existing, contact_person);
  digobj_rightsowner =
    concatFix(digobj_rightsowner, digobj_rightsowner_institution, digobj_rightsowner_person);

  // Empty the arrays that contained newly created persons/institutions
  digobj_rightsowner_institution = digobj_rightsowner_person =
    contact_person = digobj_person = [];

  const finalObject = {
    ...digitalobject, digobj_rightsowner_person, digobj_rightsowner_institution,
    contact_person, contact_person_existing, digobj_person_existing,
    digobj_person, digobj_tags, phyObjs, digobj_rightsowner,
  };

  return finalObject;
};

export { saveAnnotation, saveCompilation, saveDigitalObject, saveModel };
