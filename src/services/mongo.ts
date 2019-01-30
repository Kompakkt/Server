/**
 * Imported external configuration
 * MongoClient is the main way to connect to a MongoDB server
 * ObjectId is the type & constructor of a MongoDB unique identifier
 */
import { MongoClient, ObjectId } from 'mongodb';
import { Configuration } from './configuration';

/**
 * Imported for detailed logging
 */
import { Verbose, RootDirectory } from '../environment';
import { inspect as InspectObject } from 'util';

import * as base64img from 'base64-img';
import * as PNGtoJPEG from 'png-to-jpeg';
import { readFile, writeFileSync, readFileSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import * as imagemin from 'imagemin';
import * as mozjpeg from 'imagemin-mozjpeg';
import * as pngquant from 'imagemin-pngquant';

/** Interfaces */
import { Compilation } from '../interfaces/compilation.interface';
import { Model } from '../interfaces/model.interface';

/**
 * Object containing variables which define an established connection
 * to a MongoDB Server specified in Configuration
 * @type {Object}
 */
const Mongo = {
  Client: undefined,
  Connection: undefined,
  DBObjectsRepository: undefined,
  AccountsRepository: undefined,
  /**
   * Initialize a MongoDB Client
   * uses hostname and port defined in Configuration file
   * Make sure our predefined collections exist in the Database
   * Save the most used Database as a variable
   * to reduce the amount of calls needed
   */
  init: async () => {
    // TODO: First connection
    this.Client = new MongoClient(`mongodb://${Configuration.Mongo.Hostname}:${Configuration.Mongo.Port}/`, {
      useNewUrlParser: true,
      reconnectTries: Number.POSITIVE_INFINITY,
      reconnectInterval: 1000,
    });
    this.Connection = await this.Client.connect();
    this.DBObjectsRepository = await this.Client.db(Configuration.Mongo.Databases.ObjectsRepository.Name);
    this.AccountsRepository = await this.Client.db(Configuration.Mongo.Databases.Accounts.Name);
    Configuration.Mongo.Databases.ObjectsRepository.Collections.forEach(collection => {
      this.DBObjectsRepository.createCollection(collection.toLowerCase());
    });
  },
  /**
   * Checks if MongoDB is still connected
   * used as Middleware
   */
  isMongoDBConnected: async (request, response, next) => {
    const isConnected = await this.Client.isConnected();
    if (isConnected) {
      next();
    } else {
      console.warn('Incoming request while not connected to MongoDB');
      response.send({ message: 'Cannot connect to Database. Contact sysadmin' });
    }
  },
  /**
   * Fix cases where an ObjectId is sent but it is not detected as one
   * used as Middleware
   */
  fixObjectId: async (request, response, next) => {
    if (request) {
      if (request.body && request.body['_id'] && ObjectId.isValid(request.body['_id'])) {
        request.body['_id'] = ObjectId(request.body['_id']);
      }
    }
    next();
  },
  /**
   * Adds a new LDAP user or updates LDAP user sessionID
   */
  addToAccounts: async (request, response) => {
    const user = request.user;
    const username = request.body.username;
    const sessionID = request.sessionID;
    const ldap = this.AccountsRepository.collection('ldap');
    const found = await ldap.find({ username: username }).toArray();
    switch (found.length) {
      // TODO: Pack this into config somehow...
      case 0:
        // No Account with this LDAP username
        // Create new
        ldap.insertOne(
          {
            username: username,
            sessionID: sessionID,
            fullname: user['cn'],
            prename: user['givenName'],
            surname: user['sn'],
            status: user['UniColognePersonStatus'],
            mail: user['mail'],
            data: { compilations: [], annotations: [], models: [] }
          }, (ins_err, ins_res) => {
            if (ins_err) {
              response.send({ status: 'error' });
              console.error(ins_res);
            } else {
              console.log(ins_res.ops);
              response.send({ status: 'ok', data: ins_res.ops[0].data });
            }
          });
        break;
      case 1:
        // Account found
        // Update session ID
        ldap.updateOne({ username: username },
          {
            $set:
            {
              sessionID: sessionID,
              fullname: user['cn'],
              prename: user['givenName'],
              surname: user['sn'],
              status: user['UniColognePersonStatus'],
              mail: user['mail']
            }
          }, (up_err, up_res) => {
            if (up_err) {
              response.send({ status: 'error' });
              console.error(up_err);
            } else {
              ldap.findOne({ sessionID: sessionID, username: username }, (f_err, f_res) => {
                if (f_err) {
                  response.send({ status: 'error' });
                  console.error(f_err);
                } else {
                  response.send({ status: 'ok', data: f_res.data });
                }
              });
            }
          });
        break;
      default:
        // Too many Accountst
        console.error('Multiple Accounts found for LDAP username ' + username);
        response.send({ status: 'error' });
        break;
    }
  },
  /**
   * Get ObjectRepository data for current user
   */
  getLinkedData: async (request, response) => {
    const sessionID = request.sessionID;
    const ldap = this.AccountsRepository.collection('ldap');
    const found = await ldap.findOne({ sessionID: sessionID });
    if (!found || !found.data) {
      response.send({ status: 'ok' });
      return;
    }
    found.data.compilations = await Promise.all(found.data.compilations
      .map(async compilation => await Mongo.resolve(compilation, 'compilation')));
    found.data.models = await Promise.all(found.data.models
      .map(async model => await Mongo.resolve(model, 'model')));
    found.data.annotations = await Promise.all(found.data.annotations
      .map(async annotation => await Mongo.resolve(annotation, 'annotation')));
    response.send({ status: 'ok', data: found.data });
  },
  /**
   * Gets LDAP user to confirm validity of sessionID
   */
  checkAccount: async (request, response, next) => {
    const sessionID = request.sessionID = (request.cookies['connect.sid']) ?
      request.cookies['connect.sid'].substr(2, 36) : request.sessionID;
    const ldap = this.AccountsRepository.collection('ldap');
    const found = await ldap.find({ sessionID: sessionID }).toArray();
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
        ldap.updateMany({ sessionID: sessionID }, { $set: { sessionID: null } }, (up_err, up_res) => {
          console.log('Invalidated multiple sessionIDs due to being the same');
          response.send({ message: 'Invalid session' });
        });
        break;
    }
  },
  /**
   * When the user submits the metadataform this function
   * adds the missing data to defined collections
   */
  submit: async (request, response) => {
    if (Verbose) {
      console.log('VERBOSE: Handling submit request');
      console.log(InspectObject(request.body));
    }

    const collection = this.DBObjectsRepository.collection('digitalobject');
    const resultObject = { ...request.body };

    /**
     * Handle re-submit for changing a finished DigitalObject
     */
    if (resultObject['_id']) {
      console.log(`Re-submitting DigitalObject ${resultObject['_id']}`);
      collection.deleteOne({ _id: resultObject['_id'] });
    } else {
      resultObject['_id'] = ObjectId();
      console.log(`Generated DigitalObject ID ${resultObject['_id']}`);
    }

    /**
     * Adds data {field} to a collection {collection}
     * and returns the {_id} of the created object.
     * If {field} already has an {_id} property the server
     * will assume the object already exists in the collection
     * and instead return the existing {_id}
     */
    const addAndGetId = async (field, add_to_coll) => {
      switch (add_to_coll) {
        case 'person':
        case 'institution':
          // Add new roles to person or institution
          field['roles'] = [];
          if (field['institution_role']) {
            if (field['institution_role'] instanceof Array) {
              for (let i = 0; i < field['institution_role'].length; i++) {
                field['roles'].push({
                  role: field['institution_role'][i],
                  relatedDigitalObject: resultObject['_id']
                });
              }
            } else {
              field['roles'].push({
                role: field['institution_role'],
                relatedDigitalObject: resultObject['_id']
              });
            }
          }
          if (field['person_role']) {
            if (field['person_role'] instanceof Array) {
              for (let i = 0; i < field['person_role'].length; i++) {
                field['roles'].push({
                  role: field['person_role'][i],
                  relatedDigitalObject: resultObject['_id']
                });
              }
            } else {
              field['roles'].push({
                role: field['person_role'],
                relatedDigitalObject: resultObject['_id']
              });
            }
          }
          console.log(field['person_role'], field['institution_role'], field['roles']);

          return {
            '_id': (field['_id'] !== undefined && field['_id'].length > 0) ?
              await this.DBObjectsRepository.collection(add_to_coll)
                .updateOne({ _id: ObjectId(field['_id']) }, { $push: { roles: { $each: field['roles'] } } }).then(result => {
                  return String(field['_id']);
                }) :
              await this.DBObjectsRepository.collection(add_to_coll).insertOne(field).then(result => {
                return String(result.ops[0]['_id']);
              })
          };
          break;
        default:
          return {
            '_id': (field['_id'] !== undefined && field['_id'].length > 0) ?
              String(field['_id']) :
              await this.DBObjectsRepository.collection(add_to_coll).insertOne(field).then(result => {
                return String(result.ops[0]['_id']);
              })
          };
          break;
      }
    };

    /**
     * Use addAndGetId function on all Arrays containing
     * data that need to be added to collections
     */

    resultObject['digobj_rightsowner_person'] = await Promise.all(
      resultObject['digobj_rightsowner_person'].map(async person => {
        if (person['person_institution'][0]
          && person['person_institution'][0]['value'] === 'add_new_institution') {
          const institution = person['person_institution_data'].pop();
          const newInst = await addAndGetId(institution, 'institution');
          person['person_institution_data'][0] = newInst;
        }
        return addAndGetId(person, 'person');
      }));

    resultObject['digobj_rightsowner_institution'] = await Promise.all(
      resultObject['digobj_rightsowner_institution']
      .map(async institution => addAndGetId(institution, 'institution')));

    if (resultObject['digobj_rightsowner']
      && ObjectId.isValid(resultObject['digobj_rightsowner']['_id'])) {
      const newRightsOwner = {};
      newRightsOwner['_id'] = resultObject['digobj_rightsowner'];
      if (resultObject['digobj_rightsownerSelector'] === '1' || parseInt(resultObject['digobj_rightsownerSelector'], 10) === 1) {
        newRightsOwner['person_role'] = 'RIGHTS_OWNER';
        resultObject['digobj_rightsowner_person'][0] = await addAndGetId(newRightsOwner, 'person');
      } else if (resultObject['digobj_rightsownerSelector'] === '2' || parseInt(resultObject['digobj_rightsownerSelector'], 10) === 2) {
        newRightsOwner['institution_role'] = 'RIGHTS_OWNER';
        resultObject['digobj_rightsowner_institution'][0] = await addAndGetId(newRightsOwner, 'institution');
      }
    }

    resultObject['contact_person'] = await Promise.all(
      resultObject['contact_person'].map(async person => addAndGetId(person, 'person')));

    if (resultObject['contact_person_existing'] instanceof Array) {
      for (let i = 0; i < resultObject['contact_person_existing'].length; i++) {
        if (resultObject['contact_person_existing'][i]['value']
          && resultObject['contact_person_existing'][i]['value'] === 'add_to_new_rightsowner_person') {
          // Contact Person is the same as Rightsowner Person
          const newContact = { ...resultObject['digobj_rightsowner_person'][0] };
          newContact['person_role'] = 'CONTACT_PERSON';
          resultObject['contact_person'].push(await addAndGetId(newContact, 'person'));
        } else if (ObjectId.isValid(resultObject['contact_person_existing'][i]['_id'])) {
          // Contact Person is existing Person
          const newContact = {};
          newContact['person_role'] = 'CONTACT_PERSON';
          newContact['_id'] = resultObject['contact_person_existing'][i]['_id'];
          resultObject['contact_person'].push(await addAndGetId(newContact, 'person'));
        }
      }
    }

    resultObject['digobj_person'] = await Promise.all(
      resultObject['digobj_person'].map(async person => {
        if (person['person_institution'][0]
          && person['person_institution'][0]['value'] === 'add_new_institution') {
          const institution = person['person_institution_data'].pop();
          const newInst = await addAndGetId(institution, 'institution');
          person['person_institution_data'][0] = newInst;
        }
        return addAndGetId(person, 'person');
      }));

    if (resultObject['digobj_person_existing'] instanceof Array) {
      for (let i = 0; i < resultObject['digobj_person_existing'].length; i++) {
        if (resultObject['digobj_person_existing'][i]['value']
          && resultObject['digobj_person_existing'][i]['value'] === 'add_to_new_rightsowner_person') {
          const newContact = { ...resultObject['digobj_rightsowner_person'][0] };
          newContact['person_role'] = resultObject['digobj_person_existing'][i]['person_role'];
          resultObject['digobj_person'].push(await addAndGetId(newContact, 'person'));
        } else if (ObjectId.isValid(resultObject['digobj_person_existing'][i]['_id'])) {
          const newContact = {};
          newContact['person_role'] = resultObject['digobj_person_existing'][i]['person_role'];
          newContact['_id'] = resultObject['contact_person_existing'][i]['_id'];
          resultObject['digobj_person'].push(await addAndGetId(newContact, 'person'));
        }
      }
    }

    resultObject['phyObjs'] = await Promise.all(
      resultObject['phyObjs'].map(async phyObj => {
        // Rightsowner Person
        if (ObjectId.isValid(phyObj['phyobj_rightsowner']['_id'])) {
          const newPhyRightsOwnerPerson = {};
          newPhyRightsOwnerPerson['_id'] = phyObj['phyobj_rightsowner']['_id'];
          newPhyRightsOwnerPerson['person_role'] = 'RIGHTS_OWNER';
          phyObj['phyobj_rightsowner_person'] = await addAndGetId(newPhyRightsOwnerPerson, 'person');
        } else if (phyObj['phyobj_rightsowner_person'].length > 0 && !phyObj['phyobj_rightsowner_person'][0]['_id']) {
          phyObj['phyobj_rightsowner_person'] = await Promise.all(
            phyObj['phyobj_rightsowner_person'].map(
              phyObjRightsOwner => addAndGetId(phyObjRightsOwner, 'person')
            ));
        }

        // Rightsowner Institution
        if (ObjectId.isValid(phyObj['phyobj_rightsowner_institution']['_id'])) {
          const newPhyRightsOwnerInstitution = {};
          newPhyRightsOwnerInstitution['_id'] = phyObj['phyobj_rightsowner']['_id'];
          newPhyRightsOwnerInstitution['institution_role'] = phyObj['institution_role'];
          phyObj['phyobj_rightsowner_institution'] = await addAndGetId(newPhyRightsOwnerInstitution, 'institution');
        } else if (phyObj['phyobj_rightsowner_institution'].length > 0 && !phyObj['phyobj_rightsowner_institution'][0]['_id']) {
          phyObj['phyobj_rightsowner_institution'] = await Promise.all(
            phyObj['phyobj_rightsowner_institution'].map(
              phyObjRightsOwner => addAndGetId(phyObjRightsOwner, 'institution')
            ));
        }

        // Person
        if (phyObj['phyobj_person'] && !phyObj['phyobj_person']['_id']) {
          phyObj['phyobj_person'] = await Promise.all(
            phyObj['phyobj_person'].map(
              async (phyObjPerson) => {
                if (phyObjPerson['person_institution'] && phyObjPerson['person_institution'][0]
                  && phyObjPerson['person_institution'][0]['value'] === 'add_new_institution') {
                  const institution = phyObjPerson['person_institution_data'].pop();
                  const newInst = await addAndGetId(institution, 'institution');
                  phyObjPerson['person_institution_data'][0] = newInst;
                }
                return addAndGetId(phyObjPerson, 'person');
              }));
        }

        if (phyObj['phyobj_person_existing'] instanceof Array) {
          for (let i = 0; i < phyObj['phyobj_person_existing'].length; i++) {
            if (phyObj['phyobj_person_existing'][i]['value']
              && phyObj['phyobj_person_existing'][i]['value'] === 'add_to_new_rightsowner_person') {
              // Contact Person is the same as Rightsowner Person
              const newPerson = { ...phyObj['phyobj_rightsowner_person'][0] };
              newPerson['person_role'] = phyObj['phyobj_person_existing'][i]['person_role'];
              phyObj['phyobj_person'].push(await addAndGetId(newPerson, 'person'));
            } else if (ObjectId.isValid(phyObj['phyobj_person_existing'][i]['_id'])) {
              // Contact Person is existing Person
              const newPerson = {};
              newPerson['person_role'] = phyObj['phyobj_person_existing'][i]['person_role'];
              newPerson['_id'] = phyObj['phyobj_person_existing'][i]['_id'];
              phyObj['phyobj_person'].push(await addAndGetId(newPerson, 'person'));
            }
          }
        }

        // Institution
        if (phyObj['phyobj_institution'] && !phyObj['phyobj_institution']['_id']) {
          phyObj['phyobj_institution'] = await Promise.all(
            phyObj['phyobj_institution'].map(
              phyObjInstitution => addAndGetId(phyObjInstitution, 'institution')
            ));
        }

        if (phyObj['phyobj_institution_existing'] instanceof Array) {
          for (let i = 0; i < phyObj['phyobj_institution_existing'].length; i++) {
            if (ObjectId.isValid(phyObj['phyobj_institution_existing'][i]['_id'])) {
              const newInst = {};
              newInst['institution_role'] = phyObj['phyobj_institution_existing'][i]['institution_role'];
              newInst['_id'] = phyObj['phyobj_institution_existing'][i]['_id'];
              phyObj['phyobj_institution'].push(await addAndGetId(newInst, 'institution'));
            } else if (phyObj['phyobj_institution_existing'][i]['value']
                && phyObj['phyobj_institution_existing'][i]['value'] === 'add_to_new_rightsowner_institution') {
              const newInst = {...phyObj['phyobj_rightsowner_institution'][0]};
              newInst['institution_role'] = phyObj['phyobj_institution_existing'][i]['institution_role'];
              newInst['_id'] = phyObj['phyobj_rightsowner_institution'][0]['_id'];
              phyObj['phyobj_institution'].push(await addAndGetId(newInst, 'institution'));
            }
          }
        }

        return addAndGetId(phyObj, 'physicalobject');
      }));

    if (resultObject['digobj_tags'] && resultObject['digobj_tags'].length > 0) {
      resultObject['digobj_tags'] = await Promise.all(
        resultObject['digobj_tags'].map(async tag => addAndGetId(tag, 'tag')));
    }

    console.log(resultObject);

    collection.insertOne(resultObject, (db_error, db_result) => {
      if (db_error) {
        console.error(db_error);
        response.send('Failed to add');
      }
      if (Verbose) {
        console.log(`VERBOSE: Finished Object ${db_result.ops[0]['_id']}`);
      }
      response.send(db_result.ops[0]);
    });
  },
  /**
   * Express HTTP POST request
   * Handles a single document that needs to be added
   * to our Database
   * request.body is any JavaScript Object
   * On success, sends a response containing the added Object
   */
  addToObjectCollection: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    if (Verbose) {
      console.log('VERBOSE: Adding to the following collection ' + RequestCollection);
    }

    const collection = this.DBObjectsRepository.collection(RequestCollection);
    const sessionID = request.sessionID;
    const ldap = this.AccountsRepository.collection('ldap');

    const addAndGetId = async (field, add_to_coll) => {
      return {
        '_id': (field['_id'] !== undefined && field['_id'].length > 0) ?
          String(field['_id']) :
          await this.DBObjectsRepository.collection(add_to_coll).insertOne(field).then(result => {
            return String(result.ops[0]['_id']);
          })
      };
    };

    switch (RequestCollection) {
      case 'compilation':
      case 'model':
      case 'annotation':
        const resultObject = request.body;
        if (resultObject['models']) {
          resultObject['models'] = await Promise.all(resultObject['models'].map(async model => addAndGetId(model, 'model')));
        }
        if (resultObject['settings']) {
          resultObject['settings']['preview'] = `/previews/${resultObject['settings']['preview'].split('previews/').slice(-1)[0]}`;
        }
        if (resultObject['_id']) {
          // Update existing
          const found = await collection.findOne({ _id: resultObject['_id'] });
          collection.updateOne({ _id: resultObject['_id'] }, { $set: resultObject }, (up_error, up_result) => {
            if (up_error) {
              console.error(`Failed to update ${RequestCollection} instance`);
              response.send({ status: 'error' });
            } else {
              console.log(`Updated ${resultObject['_id']}`);
              response.send({ status: 'ok' });
            }
          });
        } else {
          // Insert new + LDAP
          collection.insertOne(request.body, async (db_error, db_result) => {
            const userData = await ldap.findOne({ sessionID: sessionID });
            switch (RequestCollection) {
              case 'model': userData.data.models.push(`${db_result.ops[0]['_id']}`); break;
              case 'annotation': userData.data.annotations.push(`${db_result.ops[0]['_id']}`); break;
              case 'compilation': userData.data.compilations.push(`${db_result.ops[0]['_id']}`); break;
            }
            const result = await ldap.updateOne({ sessionID: sessionID }, { $set: { data: userData.data } });
            if (result.result.ok === 1) {
              response.send(db_result.ops[0]);
            } else {
              response.send({ status: 'error' });
            }
            if (Verbose) {
              console.log(`VERBOSE: Success! Added new ${RequestCollection} ${db_result.ops[0]['_id']}`);
            }
          });
        }
        break;
      default:
        collection.insertOne(request.body, (db_error, result) => {
          response.send(result.ops);

          if (Verbose) {
            if (result.ops[0] && result.ops[0]['_id']) {
              console.log(`VERBOSE: Success! Added to ${RequestCollection} with ID ${result.ops[0]['_id']}`);
            }
          }
        });
        break;
    }
  },
  /**
   * Express HTTP POST request
   * Finds a model by it's ObjectId and
   * updates it's preview screenshot
   */
  updateSettings: async (request, response) => {
    const preview = request.body.preview;
    const cameraPositionInitial = request.body.cameraPositionInitial;
    const background = request.body.background;
    const lights = request.body.lights;
    const identifier = (ObjectId.isValid(request.params.identifier)) ?
      ObjectId(request.params.identifier) : request.params.identifier;
    const collection = this.DBObjectsRepository.collection('model');

    // Base64 to Buffer to optimized PNG
    // TODO: Convert to progressive JPEG?
    // TODO: Real Error handling?
    let finalImagePath = '';
    try {
      if (preview.indexOf('data:image') !== -1) {
        const tempBuff = Buffer.from(preview.replace(/^data:image\/(png|gif|jpeg);base64,/, ''), 'base64');
        await imagemin.buffer(tempBuff, { plugins: [ pngquant.default({
          speed: 1,
          strip: true,
          dithering: 1
        }) ] }).then(res => {
          ensureDirSync(`${RootDirectory}/${Configuration.Uploads.UploadDirectory}/previews/`);
          writeFileSync(`${RootDirectory}/${Configuration.Uploads.UploadDirectory}/previews/${identifier}.png`, res);
          finalImagePath = `/previews/${identifier}.png`;
        }).catch(e => console.error(e));
      } else {
        finalImagePath = `/previews/${preview.split('previews/')[1]}`;
      }
    } catch (e) {
      console.error(e);
      response.send({ status: 'error' });
    }

    // Overwrite old settings
    const settings = {
      preview: finalImagePath,
      cameraPositionInitial: cameraPositionInitial,
      background: background,
      lights: lights
    };
    const result = await collection.updateOne({ '_id': identifier },
      { $set: { settings: settings } });
    response.send((result.result.ok === 1) ? { status: 'ok', settings: settings } : { status: 'error' });
  },
  /**
   * Check if current user is owner of password protected document
   */
  isOwner: async (request, identifier) => {
    const sessionID = request.sessionID;
    const ldap = this.AccountsRepository.collection('ldap');
    const found = await ldap.findOne({ sessionID: sessionID });
    return JSON.stringify(found.data).indexOf(identifier) !== -1;
  },
  /**
   * Simple resolving by collection name and Id
   */
  resolve: async (obj, collection_name) => {
    if (Verbose) {
      console.log(`Resolving ${collection_name} ${(obj['_id']) ? obj['_id'] : obj}`);
    }
    const resolve_collection = this.DBObjectsRepository.collection(collection_name);
    const id = (obj['_id']) ? obj['_id'] : obj;
    return await resolve_collection.findOne({ '_id': (ObjectId.isValid(id)) ? ObjectId(id) : id })
      .then((resolve_result) => resolve_result);
  },
  /**
   * Heavy nested resolving for DigitalObject
   */
  resolveDigitalObject: async (digitalObject) => {
    const resolveTopLevel = async (obj, property, field) => {
      for (let i = 0; i < obj[property].length; i++) {
        obj[property][i] =
          await resolveNestedInst(await Mongo.resolve(obj[property][i], field));
      }
    };
    const resolveNestedInst = async (obj) => {
      if (obj['person_institution'] && obj['person_institution'] === 'Neue Institution hinzufügen') {
        for (let j = 0; j < obj['person_institution_data'].length; j++) {
          obj['person_institution_data'][j] =
            await Mongo.resolve(obj['person_institution_data'][j], 'institution');
        }
      }
      return obj;
    };
    const props = [['digobj_rightsowner_person', 'person'], ['contact_person', 'person'], ['digobj_person', 'person'],
    ['digobj_rightsowner_institution', 'institution'], ['digobj_tags', 'tag']];
    for (let i = 0; i < props.length; i++) {
      await resolveTopLevel(digitalObject, props[i][0], props[i][1]);
    }
    for (let i = 0; i < digitalObject['phyObjs'].length; i++) {
      digitalObject['phyObjs'][i] = await Mongo.resolve(digitalObject['phyObjs'][i], 'physicalobject');
      await resolveTopLevel(digitalObject['phyObjs'][i], 'phyobj_rightsowner_person', 'person');
      await resolveTopLevel(digitalObject['phyObjs'][i], 'phyobj_rightsowner_institution', 'institution');
      await resolveTopLevel(digitalObject['phyObjs'][i], 'phyobj_person', 'person');
      await resolveTopLevel(digitalObject['phyObjs'][i], 'phyobj_institution', 'institution');
    }
    return digitalObject;
  },
  /**
   * Express HTTP GET request
   * Finds any document in any collection by its MongoDB identifier
   * On success, sends a response containing the Object
   * TODO: Handle No Objects found?
   */
  getFromObjectCollection: (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const collection = this.DBObjectsRepository.collection(RequestCollection);
    const identifier = (ObjectId.isValid(request.params.identifier)) ?
      ObjectId(request.params.identifier) : request.params.identifier;
    const password = (request.params.password) ? request.params.password : '';

    switch (RequestCollection) {
      case 'compilation':
        collection.findOne({ '_id': identifier }).then(async (result: Compilation) => {
          if (result) {
            if (result['password'] && result['password'].length > 0) {
              const _owner = await Mongo.isOwner(request, identifier);
              if (!_owner) { if (result['password'] !== password || (password === '' && result['password'] !== '')) {
                response.send({ status: 'ok', message: 'Password protected compilation' });
                return;
              }}
            }

            for (let i = 0; i < result.models.length; i++) {
              result.models[i] = await Mongo.resolve(result.models[i]._id, 'model');
            }

            response.send(result);
          } else {
            response.send({ status: 'ok' });
          }
        }).catch((db_error) => {
          console.error(db_error);
          response.send({ status: 'error' });
        });
        break;
      case 'digitalobject':
        collection.findOne({ '_id': identifier }).then(async (result) => {
          response.send((result) ? await Mongo.resolveDigitalObject(result) : { status: 'error' });
        });
        break;
      default:
        collection.findOne({ '_id': identifier }, (db_error, result) => {
          response.send(result ? result : { status: 'ok' });
        });
        break;
    }
  },
  /**
   * Express HTTP GET request
   * Finds all documents in any collection
   * On success, sends a response containing an Array
   * of all Objects in the specified collection
   * TODO: Handle No Objects found?
   */
  getAllFromObjectCollection: (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const collection = this.DBObjectsRepository.collection(RequestCollection);

    switch (RequestCollection) {
      case 'compilation':
        collection.find({}).toArray(async (db_error, compilations) => {
          if (compilations) {
            compilations = compilations.filter(compilation =>
              !compilation.password || (compilation.password && compilation.password.length === 0));

            // Resolve models. forEach and map seem to be broken
            for (let i = 0; i < compilations.length; i++) {
              for (let j = 0; j < compilations[i].models.length; j++) {
                compilations[i].models[j] = await Mongo.resolve(compilations[i].models[j]._id, 'model');
              }
              compilations[i].models = compilations[i].models.filter(model => model && model.finished && model.online);
            }

            response.send(compilations);
          } else {
            response.send({ status: 'ok' });
          }
        });
        break;
      case 'model':
        collection.find({}).toArray((db_error, result) => {
          response.send(result.filter(model => model['finished'] && model['online']));
        });
        break;
      default:
        collection.find({}).toArray((db_error, result) => {
          response.send(result);
        });
        break;
    }
  },
  /**
   * Remove document from collection by ID
   */
  removeObjectFromObjectCollection: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const collection = this.DBObjectsRepository.collection(RequestCollection);
    const sessionID = request.sessionID;
    const ldap = this.AccountsRepository.collection('ldap');

    const identifier = (ObjectId.isValid(request.params.identifier)) ?
      ObjectId(request.params.identifier) : request.params.identifier;

    const delete_result = await collection.deleteOne({ '_id': identifier });
    if (delete_result.result.ok === 1 && delete_result.result.n === 1) {
      const find_result = await ldap.findOne({ sessionID: sessionID });
      switch (RequestCollection) {
        case 'compilations':
          find_result.data.compilations = find_result.data.compilations.filter(id => id !== request.params.identifier);
          break;
        case 'models':
          find_result.data.models = find_result.data.models.filter(id => id !== request.params.identifier);
          break;
        case 'annotations':
          find_result.data.annotations = find_result.data.annotations.filter(id => id !== request.params.identifier);
          break;
        default: break;
      }
      const update_result = await ldap.updateOne({ sessionID: sessionID }, { $set: { data: find_result.data } });
      if (update_result.result.ok === 1) {
        console.log(`Deleted ${RequestCollection} ${request.params.identifier}`);
        response.send({ status: 'ok' });
      } else {
        console.log(`Failed deleting ${RequestCollection} ${request.params.identifier}`);
        response.send({ status: 'error' });
      }
    } else {
      console.log(`Failed deleting ${RequestCollection} ${request.params.identifier}`);
      console.log(delete_result);
      response.send({ status: 'error' });
    }
  },
  /**
   * Search
   */
  searchObjectWithFilter: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const collection = this.DBObjectsRepository.collection(RequestCollection);
    const filter = (request.body.filter) ? request.body.filter.map(_ => _.toLowerCase()) : [''];
    let allObjects = await collection.find({}).toArray();

    const getNestedValues = (obj) => {
      let result = [];
      for (const key of Object.keys(obj)) {
        const prop = obj[key];
        if (obj.hasOwnProperty(key) && prop) {
          if (typeof (prop) === 'object' && !Array.isArray(prop)) {
            result = result.concat(getNestedValues(prop));
          } else if (typeof (prop) === 'object' && Array.isArray(prop)) {
            for (let i = 0; i < prop.length; i++) {
              result = result.concat(getNestedValues(prop[i]));
            }
          } else if (typeof (prop) === 'string') {
            result.push(prop);
          }
        }
      }
      return result;
    };

    const filterResults = (objs) => {
      const result = [];
      for (let i = 0; i < objs.length; i++) {
        const asText = getNestedValues(objs[i]).join('').toLowerCase();
        for (let j = 0; j < filter.length; j++) {
          if (asText.indexOf(filter[j]) === -1) {
            break;
          }
          if (j === filter.length - 1) {
            result.push(objs[i]._id);
          }
        }
      }
      return result;
    };

    switch (RequestCollection) {
      case 'digitalobject':
        await Promise.all(allObjects.map(async digObj => await Mongo.resolveDigitalObject(digObj)));
        break;
      case 'model':
        allObjects = allObjects.filter(model =>
          model && model.finished && model.online
          && model.relatedDigitalObject && model.relatedDigitalObject['_id']);
        for (let i = 0; i < allObjects.length; i++) {
          if (allObjects[i].relatedDigitalObject['_id']) {
            const tempDigObj = await Mongo.resolve(allObjects[i].relatedDigitalObject, 'digitalobject');
            allObjects[i].relatedDigitalObject = await Mongo.resolveDigitalObject(tempDigObj);
            allObjects[i].settings.preview = '';
          }
        }
        break;
      default:
        break;
    }

    response.send(filterResults(allObjects));
  }
};

/**
 * Initialization
 */
Mongo.init();

export { Mongo };
