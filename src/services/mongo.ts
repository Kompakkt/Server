import * as flatten from 'flatten';
import { writeFileSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import * as imagemin from 'imagemin';
import * as pngquant from 'imagemin-pngquant';
import { Collection, InsertOneWriteOpResult, MongoClient, ObjectId } from 'mongodb';

import { RootDirectory } from '../environment';
import { ICompilation } from '../interfaces/compilation.interface';

import { Configuration } from './configuration';
import { Logger } from './logger';
// import { Model } from '../interfaces/model.interface';

const MongoConf = Configuration.Mongo;
const UploadConf = Configuration.Uploads;

const Mongo = {
  Client: undefined,
  Connection: undefined,
  DBObjectsRepository: undefined,
  AccountsRepository: undefined,
  init: async () => {
    const MongoURL = `mongodb://${MongoConf.Hostname}:${MongoConf.Port}/`;
    this.Client = new MongoClient(MongoURL, {
      useNewUrlParser: true,
      reconnectTries: Number.POSITIVE_INFINITY,
      reconnectInterval: 1000,
    });
    await this.Client.connect(async (error, client) => {
      if (error) {
        Logger.err(`Couldn't connect to MongoDB. Make sure it is running and check your configuration`);
        process.exit(1);
      }
      this.Connection = client;
      this.DBObjectsRepository = await this.Client.db(MongoConf.Databases.ObjectsRepository.Name);
      this.AccountsRepository = await this.Client.db(MongoConf.Databases.Accounts.Name);
      MongoConf.Databases.ObjectsRepository.Collections.forEach(collection => {
        this.DBObjectsRepository.createCollection(collection.toLowerCase());
      });
    });

  },
  isMongoDBConnected: async (_, response, next) => {
    const isConnected = await this.Client.isConnected();
    if (isConnected) {
      next();
    } else {
      Logger.warn('Incoming request while not connected to MongoDB');
      response.send({ message: 'Cannot connect to Database. Contact sysadmin' });
    }
  },
  getAccountsRepository: () => this.AccountsRepository,
  getObjectsRepository: () => this.DBObjectsRepository,
  /**
   * Fix cases where an ObjectId is sent but it is not detected as one
   * used as Middleware
   */
  fixObjectId: async (request, _, next) => {
    if (request) {
      if (request.body && request.body['_id'] && ObjectId.isValid(request.body['_id'])) {
        request.body['_id'] = new ObjectId(request.body['_id']);
      }
    }
    next();
  },
  getUnusedObjectId: async (_, response) => {
    response.send(new ObjectId());
  },
  invalidateSession: async (request, response) => {
    const sessionID = request.sessionID;
    const ldap = this.AccountsRepository.collection('ldap');
    ldap.updateMany({ sessionID }, { $set: { sessionID: '' } }, () => {
      Logger.log('Logged out');
      response.send({ status: 'ok', message: 'Logged out' });
    });
  },
  addToAccounts: async (request, response) => {
    const user = request.user;
    const username = request.body.username.toLowerCase();
    const sessionID = request.sessionID;
    const ldap = this.AccountsRepository.collection('ldap');
    let found = await ldap.find({ username })
      .toArray();

    switch (found.length) {
      // TODO: Pack this into config somehow...
      case 0:
        // No Account with this LDAP username
        // Create new
        ldap.insertOne(
          {
            username,
            sessionID,
            fullname: user['cn'],
            prename: user['givenName'],
            surname: user['sn'],
            rank: user['UniColognePersonStatus'],
            mail: user['mail'],
            data: {},
            role: user['UniColognePersonStatus'],
          },
          (ins_err, ins_res) => {
            if (ins_err) {
              response.send({ status: 'error' });
              Logger.err(ins_res);
            } else {
              Logger.info(ins_res.ops);
              response.send({ status: 'ok', ...ins_res.ops[0] });
            }
          });
        break;
      case 1:
        // Account found
        // Update session ID
        found = found[0];
        ldap.updateOne(
          { username },
          {
            $set: {
              sessionID,
              fullname: user['cn'],
              prename: user['givenName'],
              surname: user['sn'],
              rank: user['UniColognePersonStatus'],
              mail: user['mail'],
              role: (found['role'])
                ? ((found['role'] === '')
                  ? user['UniColognePersonStatus']
                  : found['role'])
                : user['UniColognePersonStatus'],
            },
          },
          (up_err, _) => {
            if (up_err) {
              response.send({ status: 'error' });
              Logger.err(up_err);
            } else {
              ldap.findOne({ sessionID, username }, (f_err, f_res) => {
                if (f_err) {
                  response.send({ status: 'error' });
                  Logger.err(f_err);
                } else {
                  response.send({ status: 'ok', ...f_res });
                }
              });
            }
          });
        break;
      default:
        // Too many Accounts
        Logger.warn(`Multiple Accounts found for LDAP username ${username}`);
        response.send({ status: 'error' });
    }
  },
  insertCurrentUserData: async (request, identifier, collection) => {
    const sessionID = request.sessionID;
    const ldapCollection: Collection = this.AccountsRepository.collection('ldap');
    const userData = await ldapCollection.findOne({ sessionID });

    userData.data[collection] = (userData.data[collection])
      ? userData.data[collection] : [];
    userData.data[collection].push(identifier);

    return ldapCollection.updateOne(
      { sessionID },
      { $set: { data: userData.data } });
  },
  getCurrentUserData: async (request, response) => {
    const sessionID = request.sessionID;
    const ldap = this.AccountsRepository.collection('ldap');
    const found = await ldap.findOne({ sessionID });
    if (!found || !found.data) {
      response.send({ status: 'ok' });
      return;
    }
    for (const property in found.data) {
      if (!found.data.hasOwnProperty(property)) continue;
      found.data[property] = await Promise.all(
        found.data[property].map(async obj => Mongo.resolve(obj, property)));
    }
    response.send({ status: 'ok', ...found });
  },
  validateLoginSession: async (request, response, next) => {
    const sessionID = request.sessionID = (request.cookies['connect.sid']) ?
      request.cookies['connect.sid'].substr(2, 36) : request.sessionID;

    const ldap = this.AccountsRepository.collection('ldap');
    const found = await ldap.find({ sessionID })
      .toArray();

    switch (found.length) {
      case 0:
        // Invalid sessionID
        response.send({ message: 'Invalid session' });
        break;
      case 1:
        // Valid sessionID
        next();
        break;
      default:
        // Multiple sessionID. Invalidate all
        ldap.updateMany({ sessionID }, { $set: { sessionID: '' } }, () => {
          Logger.log('Invalidated multiple sessionIDs due to being the same');
          response.send({ message: 'Invalid session' });
        });
    }
  },
  submitService: async (request, response) => {
    const digobjCollection: Collection = this.DBObjectsRepository.collection('digitalobject');
    const modelCollection: Collection = this.DBObjectsRepository.collection('model');

    const service: string = request.params.service;
    if (!service) response.send({ status: 'error', message: 'Incorrect request' });

    const mapTypes = (resType: string) => {
      let type = resType;
      type = type.toLowerCase();
      switch (type) {
        case 'sound': type = 'audio'; break;
        case 'picture': type = 'image'; break;
        case '3d': type = 'model'; break;
        default:
      }
      return type;
    };

    // After adding a digitalobject inside of a model,
    // attach data to the current user
    const insertFinalModelToCurrentUser = (modelResult: InsertOneWriteOpResult) => {
      Mongo.insertCurrentUserData(request, modelResult.ops[0]._id, 'model')
        .then(() => {
          response.send({ status: 'ok', result: modelResult.ops[0] });
          Logger.info('Added Europeana object', modelResult.ops[0]._id);
        })
        .catch(err => {
          Logger.err(err);
          response.send({ status: 'error', message: 'Failed adding finalized object to user' });
        });
    };

    // After adding a digitalobject, add digitalobject
    // to a model and push the model
    const pushModel = (digobjResult: InsertOneWriteOpResult) => {
      const resultObject = digobjResult.ops[0];
      const modelObject = {
        relatedDigitalObject: {
          _id: resultObject._id,
        },
        name: resultObject.digobj_title,
        ranking: 0,
        files: undefined,
        finished: true,
        online: true,
        mediaType: mapTypes(request.body.type),
        dataSource: {
          isExternal: true,
          service,
        },
        processed: {
          low: request.body._fileUrl,
          medium: request.body._fileUrl,
          high: request.body._fileUrl,
          raw: request.body._fileUrl,
        },
        settings: {
          preview: (request.body._previewUrl)
            ? request.body._previewUrl
            : '/previews/noimage.png',
        },
      };
      modelCollection.insertOne(modelObject)
        .then(insertFinalModelToCurrentUser)
        .catch(err => {
          Logger.err(err);
          response.send({ status: 'error', message: 'Failed finalizing digitalobject' });
        });
    };

    switch (service) {
      case 'europeana':
        // TODO: Put into Europeana service to make every service self sustained?
        const EuropeanaObject = {
          digobj_type: mapTypes(request.body.type),
          digobj_title: request.body.title,
          digobj_description: request.body.description,
          digobj_licence: request.body.license,
          digobj_externalLink: [{
            externalLink_description: 'Europeana URL',
            externalLink_value: request.body.page,
          }],
        };

        digobjCollection.insertOne(EuropeanaObject)
          .then(pushModel)
          .catch(err => {
            Logger.err(err);
            response.send({ status: 'error', message: `Couldn't add as digitalobject` });
          });

        break;
      default:
        response.send({ status: 'error', message: `Service ${service} not configured` });
    }
  },
  /**
   * When the user submits the metadataform this function
   * adds the missing data to defined collections
   */
  submit: async (request, response) => {
    Logger.info('Handling submit request');

    const collection: Collection = this.DBObjectsRepository.collection('digitalobject');
    const resultObject = { ...request.body };

    /**
     * Handle re-submit for changing a finished DigitalObject
     */
    const isResObjIdValid = ObjectId.isValid(resultObject['_id']);
    resultObject['_id'] = isResObjIdValid
      ? new ObjectId(resultObject['_id']) : new ObjectId();
    Logger.info(`${isResObjIdValid ? 'Re-' : ''}Submitting DigitalObject ${resultObject['_id']}`);

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
      const coll: Collection = this.DBObjectsRepository.collection(add_to_coll);
      const isPersonOrInstitution = ['person', 'institution'].includes(add_to_coll);
      const _digId = (currentPhyObjId !== '') ? currentPhyObjId : resultObject['_id'];
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
    let digobj_rightsowner: any[] = resultObject['digobj_rightsowner'];
    let digobj_rightsowner_person: any[] = resultObject['digobj_rightsowner_person'];
    let digobj_rightsowner_institution: any[] = resultObject['digobj_rightsowner_institution'];
    // Can be multiple
    let contact_person: any[] = resultObject['contact_person'];
    let contact_person_existing: any[] = resultObject['contact_person_existing'];
    let digobj_person: any[] = resultObject['digobj_person'];
    let digobj_person_existing: any[] = resultObject['digobj_person_existing'];
    const digobj_tags: any[] = resultObject['digobj_tags'];
    const phyObjs: any[] = resultObject['phyObjs'];

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
      digobj_rightsowner_institution, resultObject['digobj_rightsownerSelector']);

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
      const phyObj: any[] = phyObjs[i];
      let phyobj_rightsowner: any[] = phyObj['phyobj_rightsowner'];
      let phyobj_rightsowner_person: any[] = phyObj['phyobj_rightsowner_person'];
      let phyobj_rightsowner_institution: any[] = phyObj['phyobj_rightsowner_institution'];
      let phyobj_person: any[] = phyObj['phyobj_person'];
      let phyobj_person_existing: any[] = phyObj['phyobj_person_existing'];
      let phyobj_institution: any[] = phyObj['phyobj_institution'];
      let phyobj_institution_existing: any[] = phyObj['phyobj_institution_existing'];

      const isPhyObjIdValid = ObjectId.isValid(phyObj['_id']);
      phyObj['_id'] = isPhyObjIdValid ? new ObjectId(phyObj['_id']) : new ObjectId();
      currentPhyObjId = phyObj['_id'];

      await handleRightsOwnerBase(
        phyobj_rightsowner_person, [phyobj_person_existing],
        'person_role', 'person');
      await handleRightsOwnerBase(
        phyobj_rightsowner_institution, [phyobj_institution_existing],
        'institution_role', 'institution');

      await handleRightsOwnerSelector(
        phyobj_rightsowner, phyobj_rightsowner_person,
        phyobj_rightsowner_institution, phyObj['phyobj_rightsownerSelector']);

      await handleSimpleCases(phyobj_person, 'person');
      await handleSimpleCases(phyobj_institution, 'institution');

      if (phyobj_rightsowner_person[0]) {
        await handleRightsOwnerAndExisting(
          phyobj_person_existing, phyobj_person, 'person',
          phyobj_rightsowner_person[0]['_id'], 'person_role');
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
      ...resultObject, digobj_rightsowner_person, digobj_rightsowner_institution,
      contact_person, contact_person_existing, digobj_person_existing,
      digobj_person, digobj_tags, phyObjs, digobj_rightsowner,
    };

    collection.updateOne({ _id: finalObject['_id'] }, { $set: finalObject }, { upsert: true })
      .then(() => Mongo.resolve(finalObject['_id'], 'digitalobject'))
      .then(data => {
        Logger.info(`Finished Object ${finalObject['_id']}`);
        response.send({ status: 'ok', data });
      })
      .catch(e => {
        Logger.err(e);
        response.send({ status: 'error', message: 'Failed to add' });
      });
  },
  addObjectToCollection: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    Logger.info(`Adding to the following collection: ${RequestCollection}`);

    const collection: Collection = this.DBObjectsRepository.collection(RequestCollection);
    const sessionID = request.sessionID;
    const ldap: Collection = this.AccountsRepository.collection('ldap');

    const resultObject = request.body;
    const userData = await ldap.findOne({ sessionID });

    const isValidObjectId = ObjectId.isValid(resultObject['_id']);
    const doesObjectExist = await Mongo.resolve(resultObject['_id'], RequestCollection);
    /* If the object already exists we need to
     * check for owner and for admin status */
    if (isValidObjectId && doesObjectExist) {
      const isOwner = await Mongo.isUserOwnerOfObject(request, resultObject['_id']);
      if (!isOwner) {
        response.send({ status: 'error', message: 'Permission denied' });
        return;
      }
    }

    switch (RequestCollection) {
      case 'compilation':
        resultObject['annotationList'] = (resultObject['annotationList'])
          ? resultObject['annotationList'] : [];
        resultObject['relatedOwner'] = {
          _id: userData._id,
          username: userData.username,
          fullname: userData.fullname,
        };
        // Compilations should have all their models referenced by _id
        resultObject['models'] =
          resultObject['models'].map(model => {
            return { _id: new ObjectId(model['_id']) };
          });
        break;
      case 'model':
        /* Preview image URLs might have a corrupted address
   * because of Kompakkt runnning in an iframe
   * This removes the host address from the URL
   * so images will load correctly */
        if (resultObject['settings'] && resultObject['settings']['preview']) {
          resultObject['settings']['preview'] = `/previews/${resultObject['settings']['preview']
            .split('previews/')
            .slice(-1)[0]}`;
        }
        break;
      case 'annotation':
        // Check if anything was missing for safety
        const source = resultObject['target']['source'];
        if (!source) {
          response.send({ status: 'error', message: 'Missing source' });
          return;
        }

        const relatedModelId: string | undefined = source['relatedModel'];
        const relatedCompId: string | undefined = source['relatedCompilation'];
        // Check if === undefined because otherwise this quits on empty string
        if (relatedModelId === undefined || relatedCompId === undefined) {
          response.send({ status: 'error', message: 'Related model or compilation undefined' });
          return;
        }

        const isModel = ObjectId.isValid(relatedModelId);
        const isCompilation = ObjectId.isValid(relatedCompId);

        if (!isModel) {
          response.send({ status: 'error', message: 'Invalid related model id' });
          return;
        }

        if (isModel && !isCompilation) {
          const isOwner =
            await Mongo.isUserOwnerOfObject(request, relatedModelId);
          if (!isOwner) {
            response.send({ status: 'error', message: 'Permission denied' });
            return;
          }
        }

        // Update data inside of annotation
        resultObject['generated'] = (resultObject['generated'])
          ? resultObject['generated'] : new Date().toISOString();
        resultObject['lastModifiedBy'] = new Date().toISOString();

        const updateAnnotationList = async (id: string, add_to_coll: string) => {
          const obj = await Mongo.resolve(id, add_to_coll);
          // Create annotationList if missing
          obj['annotationList'] = (obj['annotationList'])
            ? obj['annotationList'] : [];

          const doesAnnotationExist = obj['annotationList']
            .find(annotation => annotation.toString() === resultObject['_id'].toString());
          if (doesAnnotationExist) return true;

          // Add annotation to list if it doesn't exist
          const _newId = new ObjectId(resultObject['_id']);
          obj['annotationList'].push(_newId);
          const coll: Collection = this.DBObjectsRepository.collection(add_to_coll);
          const listUpdateResult = await coll
            .updateOne(
              { _id: new ObjectId(id) },
              { $set: { annotationList: obj['annotationList'] } });

          if (listUpdateResult.result.ok !== 1) {
            Logger.err(`Failed updating annotationList of ${add_to_coll} ${id}`);
            response.send({ status: 'error' });
            return false;
          }
          return true;
        };

        const success = (!isCompilation)
          // Annotation is default annotation
          ? await updateAnnotationList(relatedModelId, 'model')
          // Annotation belongs to compilation
          : await updateAnnotationList(relatedCompId, 'compilation');

        if (!success) {
          Logger.err(`Failed updating annotationList`);
          response.send({ status: 'error' });
          return;
        }
        break;
      default:
    }

    const _id = isValidObjectId
      ? new ObjectId(resultObject['_id'])
      : new ObjectId();

    const updateResult = await collection
      .updateOne({ _id }, { $set: resultObject }, { upsert: true });

    if (updateResult.result.ok !== 1) {
      Logger.err(`Failed updating ${RequestCollection} ${_id}`);
      response.send({ status: 'error' });
      return;
    }

    userData.data[`${RequestCollection}`] = (userData.data[`${RequestCollection}`])
      ? userData.data[`${RequestCollection}`]
      : [];
    const isUserAlreadyOwner = userData.data[`${RequestCollection}`]
      .find(obj => obj.toString() === _id.toString());

    if (!isUserAlreadyOwner) {
      userData.data[`${RequestCollection}`].push(_id);
      const ldapUpdateResult =
        await ldap.updateOne({ sessionID }, { $set: { data: userData.data } });
      if (ldapUpdateResult.result.ok !== 1) {
        Logger.err(`Failed adding ${_id} to LDAP User ${RequestCollection}`);
        response.send({ status: 'error' });
        return;
      }
    }

    const resultId = (updateResult.upsertedId) ? updateResult.upsertedId._id : _id;
    response.send({ status: 'ok', ...await Mongo.resolve(resultId, RequestCollection) });
    Logger.info(`Success! Updated ${RequestCollection} ${_id}`);
  },
  updateModelSettings: async (request, response) => {
    const preview = request.body.preview;
    const identifier = (ObjectId.isValid(request.params.identifier)) ?
      new ObjectId(request.params.identifier) : request.params.identifier;
    const collection = this.DBObjectsRepository.collection('model');

    // Base64 to Buffer to optimized PNG
    // TODO: Convert to progressive JPEG?
    // TODO: Real Error handling?
    let finalImagePath = '';
    try {
      if (preview.indexOf('data:image') !== -1) {
        const replaced = preview.replace(/^data:image\/(png|gif|jpeg);base64,/, '');
        const tempBuff = Buffer.from(replaced, 'base64');
        await imagemin.buffer(tempBuff, {
          plugins: [pngquant.default({
            speed: 1,
            strip: true,
            dithering: 1,
          })],
        })
          .then(res => {
            ensureDirSync(`${RootDirectory}/${UploadConf.UploadDirectory}/previews/`);
            writeFileSync(
              `${RootDirectory}/${UploadConf.UploadDirectory}/previews/${identifier}.png`,
              res);

            finalImagePath = `/previews/${identifier}.png`;
          })
          .catch(e => Logger.err(e));
      } else {
        finalImagePath = `/previews/${preview.split('previews/')[1]}`;
      }
    } catch (e) {
      Logger.err(e);
      response.send({ status: 'error' });
    }

    // Overwrite old settings
    const settings = { ...request.body, preview: finalImagePath };
    const result = await collection.updateOne(
      { _id: identifier },
      { $set: { settings } });
    response.send((result.result.ok === 1) ? { status: 'ok', settings } : { status: 'error' });
  },
  isUserOwnerOfObject: async (request, identifier) => {
    const _id = ObjectId.isValid(identifier)
      ? new ObjectId(identifier) : identifier;
    const sessionID = request.sessionID;
    const ldap = this.AccountsRepository.collection('ldap');
    const found = await ldap.findOne({ sessionID });
    return JSON.stringify(found.data)
      .indexOf(_id) !== -1;
  },
  isUserAdmin: async request => {
    const sessionID = request.sessionID;
    const ldap = this.AccountsRepository.collection('ldap');
    const found = await ldap.findOne({ sessionID });
    return found.role === 'A';
  },
  /**
   * Simple resolving by collection name and Id
   */
  resolve: async (obj, collection_name) => {
    Logger.info(`Resolving ${collection_name} ${(obj['_id']) ? obj['_id'] : obj}`);
    const resolve_collection = this.DBObjectsRepository.collection(collection_name);
    const id = (obj['_id']) ? obj['_id'] : obj;
    return resolve_collection.findOne({ _id: (ObjectId.isValid(id)) ? new ObjectId(id) : id })
      .then(resolve_result => resolve_result);
  },
  /**
   * Heavy nested resolving for DigitalObject
   */
  resolveDigitalObject: async digitalObject => {
    let currentId = digitalObject._id;
    const resolveNestedInst = async obj => {
      if (obj['person_institution_data']) {
        for (let j = 0; j < obj['person_institution_data'].length; j++) {
          // TODO: Find out why institution is missing an _id
          // Issue probably related to physical object
          if (!obj['person_institution_data'][j]['_id']) {
            Logger.err(`Nested institution is missing _id for some reason`);
            Logger.err(obj['person_institution_data']);
            Logger.err(digitalObject);
            continue;
          }
          obj['person_institution_data'][j] =
            await Mongo.resolve(obj['person_institution_data'][j]['_id'], 'institution');
        }
      }
      return obj;
    };
    const resolveTopLevel = async (obj, property, field) => {
      if (obj[property] && obj[property].length && obj[property] instanceof Array) {
        for (let i = 0; i < obj[property].length; i++) {
          const resolved = await Mongo.resolve(obj[property][i], field);
          if (!resolved) continue;
          obj[property][i] = await resolveNestedInst(resolved);
          if (obj[property][i]['roles'] && obj[property][i]['roles'][currentId]) {
            const old = obj[property][i]['roles'][currentId];
            obj[property][i]['roles'] = {};
            obj[property][i]['roles'][currentId] = old;
          }
        }
      }
    };
    const props = [
      ['digobj_rightsowner'], ['digobj_person_existing'], ['contact_person_existing'],
      ['digobj_rightsowner', 'institution'], ['digobj_tags', 'tag']];

    for (const prop of props) {
      await resolveTopLevel(digitalObject, prop[0], (prop[1]) ? prop[1] : 'person');
    }

    if (digitalObject['phyObjs']) {
      const resolvedPhysicalObjects: any[] = [];
      for (let phyObj of digitalObject['phyObjs']) {
        currentId = phyObj._id;
        phyObj = await Mongo.resolve(phyObj, 'physicalobject');
        const phyProps = [
          ['phyobj_rightsowner'], ['phyobj_rightsowner', 'institution'],
          ['phyobj_person_existing'], ['phyobj_institution_existing', 'institution']];
        for (const phyProp of phyProps) {
          await resolveTopLevel(phyObj, phyProp[0], (phyProp[1]) ? phyProp[1] : 'person');
        }
        resolvedPhysicalObjects.push(phyObj);
      }
      digitalObject['phyObjs'] = resolvedPhysicalObjects;
    }

    return digitalObject;
  },
  getObjectFromCollection: (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const collection = this.DBObjectsRepository.collection(RequestCollection);
    const _id = (ObjectId.isValid(request.params.identifier)) ?
      new ObjectId(request.params.identifier) : request.params.identifier;
    const password = (request.params.password) ? request.params.password : '';

    switch (RequestCollection) {
      case 'compilation':
        collection.findOne({ _id })
          .then(async (compilation: ICompilation) => {
            if (!compilation) {
              response.send({ status: 'error' });
              return;
            }
            const _pw = compilation['password'];
            const isPasswordProtected = (_pw && _pw.length > 0);
            const isUserOwner = await Mongo.isUserOwnerOfObject(request, _id);
            const isPasswordCorrect = (_pw && _pw === password);

            for (let i = 0; i < compilation.models.length; i++) {
              compilation.models[i] = await Mongo.resolve(compilation.models[i]._id, 'model');
            }

            if (!isPasswordProtected || isUserOwner || isPasswordCorrect) {
              response.send({ status: 'ok', ...compilation });
              return;
            }

            response.send({ status: 'ok', message: 'Password protected compilation' });
          })
          .catch(db_error => {
            Logger.err(db_error);
            response.send({ status: 'error' });
          });
        break;
      case 'digitalobject':
        collection.findOne({ _id })
          .then(async result => {
            response.send((result)
              ? { status: 'ok', ...await Mongo.resolveDigitalObject(result) }
              : { status: 'error' });
          });
        break;
      default:
        collection.findOne({ _id }, (_, result) => {
          response.send(result ? result : { status: 'ok' });
        });
    }
  },
  getAllObjectsFromCollection: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const collection: Collection = this.DBObjectsRepository.collection(RequestCollection);
    const results = await collection.find({})
      .toArray();

    switch (RequestCollection) {
      case 'compilation':
        let compilations = results;
        const isPasswordProtected = compilation =>
          (!compilation.password || (compilation.password && compilation.password.length === 0));
        compilations = compilations.filter(isPasswordProtected);

        // Resolve models. forEach and map seem to be broken
        for (const compilation of compilations) {
          const resolvedModels: any[] = [];
          for (const model of compilation.models) {
            resolvedModels.push(await Mongo.resolve(model._id, 'model'));
          }
          compilation.models = resolvedModels.filter(model =>
            model && model.finished && model.online);
        }

        response.send(compilations);
        break;
      case 'model':
        const finishedAndOnline = results.filter(model => model['finished'] && model['online']);
        response.send(finishedAndOnline);
        break;
      default:
        response.send(results);
    }
  },
  removeObjectFromCollection: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const collection = this.DBObjectsRepository.collection(RequestCollection);
    const sessionID = request.sessionID;
    const ldap = this.AccountsRepository.collection('ldap');

    const identifier = (ObjectId.isValid(request.params.identifier)) ?
      new ObjectId(request.params.identifier) : request.params.identifier;

    const find_result = await ldap.findOne({ sessionID });

    if ((!find_result.username || !request.body.username)
      || (request.body.username !== find_result.username)) {
      Logger.err(`Object removal failed due to username & session not matching`);
      response.send({
        status: 'error',
        message: 'Input username does not match username with current sessionID',
      });
      return;
    }

    // Flatten account.data so its an array of ObjectId.toString()
    const UserRelatedObjects =
      Array.prototype.concat(...Object.values(find_result.data))
        .map(id => id.toString());

    if (!UserRelatedObjects.find(obj => obj === identifier.toString())) {
      Logger.err(`Object removal failed because Object does not belong to user`);
      response.send({
        status: 'error',
        message: 'Object with identifier does not belong to account with this sessionID',
      });
      return;
    }
    const delete_result = await collection.deleteOne({ _id: identifier });
    if (delete_result.result.ok === 1 && delete_result.result.n === 1) {
      find_result.data[RequestCollection] =
        find_result.data[RequestCollection].filter(id => id !== identifier.toString());

      const update_result =
        await ldap.updateOne({ sessionID }, { $set: { data: find_result.data } });

      if (update_result.result.ok === 1) {
        Logger.info(`Deleted ${RequestCollection} ${request.params.identifier}`);
        response.send({ status: 'ok' });
      } else {
        Logger.warn(`Failed deleting ${RequestCollection} ${request.params.identifier}`);
        response.send({ status: 'error' });
      }
    } else {
      Logger.warn(`Failed deleting ${RequestCollection} ${request.params.identifier}`);
      Logger.warn(delete_result);
      response.send({ status: 'error' });
    }
  },
  searchObjectWithFilter: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const collection = this.DBObjectsRepository.collection(RequestCollection);
    const filter = (request.body.filter) ? request.body.filter.map(_ => _.toLowerCase()) : [''];
    let allObjects = await collection.find({})
      .toArray();

    const getNestedValues = obj => {
      let result: string[] = [];
      for (const key of Object.keys(obj)) {
        const prop = obj[key];
        if (obj.hasOwnProperty(key) && prop) {
          if (typeof (prop) === 'object' && !Array.isArray(prop)) {
            result = result.concat(getNestedValues(prop));
          } else if (typeof (prop) === 'object' && Array.isArray(prop)) {
            for (const p of prop) {
              result = result.concat(getNestedValues(p));
            }
          } else if (typeof (prop) === 'string') {
            result.push(prop);
          }
        }
      }
      return result;
    };

    const filterResults = objs => {
      const result: any[] = [];
      for (const obj of objs) {
        const asText = getNestedValues(obj)
          .join('')
          .toLowerCase();
        for (let j = 0; j < filter.length; j++) {
          if (asText.indexOf(filter[j]) === -1) {
            break;
          }
          if (j === filter.length - 1) {
            result.push(obj._id);
          }
        }
      }
      return result;
    };

    switch (RequestCollection) {
      case 'digitalobject':
        await Promise.all(allObjects.map(async digObj => Mongo.resolveDigitalObject(digObj)));
        break;
      case 'model':
        allObjects = allObjects.filter(model =>
          model && model.finished && model.online
          && model.relatedDigitalObject && model.relatedDigitalObject['_id']);
        for (const obj of allObjects) {
          if (obj.relatedDigitalObject['_id']) {
            const tempDigObj =
              await Mongo.resolve(obj.relatedDigitalObject, 'digitalobject');
            obj.relatedDigitalObject = await Mongo.resolveDigitalObject(tempDigObj);
            obj.settings.preview = '';
          }
        }
        break;
      default:
    }

    response.send(filterResults(allObjects));
  },
};

Mongo.init()
  .catch(e => Logger.err(e));

export { Mongo };
