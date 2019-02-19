import { MongoClient, ObjectId } from 'mongodb';
import { Configuration } from './configuration';

import { RootDirectory } from '../environment';
import { Logger } from './logger';

import { writeFileSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import * as imagemin from 'imagemin';
import * as pngquant from 'imagemin-pngquant';

// TODO: Use interfaces
import { Compilation } from '../interfaces/compilation.interface';
// import { Model } from '../interfaces/model.interface';

const Mongo = {
  Client: undefined,
  Connection: undefined,
  DBObjectsRepository: undefined,
  AccountsRepository: undefined,
  init: async () => {
    this.Client = new MongoClient(`mongodb://${Configuration.Mongo.Hostname}:${Configuration.Mongo.Port}/`, {
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
      this.DBObjectsRepository = await this.Client.db(Configuration.Mongo.Databases.ObjectsRepository.Name);
      this.AccountsRepository = await this.Client.db(Configuration.Mongo.Databases.Accounts.Name);
      Configuration.Mongo.Databases.ObjectsRepository.Collections.forEach(collection => {
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
  /**
   * Fix cases where an ObjectId is sent but it is not detected as one
   * used as Middleware
   */
  fixObjectId: async (request, _, next) => {
    if (request) {
      if (request.body && request.body['_id'] && ObjectId.isValid(request.body['_id'])) {
        request.body['_id'] = ObjectId(request.body['_id']);
      }
    }
    next();
  },
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
              Logger.err(ins_res);
            } else {
              Logger.info(ins_res.ops);
              response.send({ status: 'ok', data: ins_res.ops[0].data, _id: ins_res.ops[0]._id, fullname: ins_res.ops[0].fullname });
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
          }, (up_err, _) => {
            if (up_err) {
              response.send({ status: 'error' });
              Logger.err(up_err);
            } else {
              ldap.findOne({ sessionID: sessionID, username: username }, (f_err, f_res) => {
                if (f_err) {
                  response.send({ status: 'error' });
                  Logger.err(f_err);
                } else {
                  response.send({ status: 'ok', data: f_res.data, _id: f_res._id, fullname: f_res.fullname });
                }
              });
            }
          });
        break;
      default:
        // Too many Accounts
        Logger.warn('Multiple Accounts found for LDAP username ' + username);
        response.send({ status: 'error' });
        break;
    }
  },
  getCurrentUserData: async (request, response) => {
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
    response.send({ status: 'ok', data: found.data, _id: found._id,
        fullname: found.fullname, username: found.username, rank: found.status });
  },
  validateLoginSession: async (request, response, next) => {
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
        ldap.updateMany({ sessionID: sessionID }, { $set: { sessionID: null } }, () => {
          Logger.log('Invalidated multiple sessionIDs due to being the same');
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
    Logger.info('Handling submit request');
    Logger.info(request.body);

    const collection = this.DBObjectsRepository.collection('digitalobject');
    const resultObject = { ...request.body };

    /**
     * Handle re-submit for changing a finished DigitalObject
     */
    if (resultObject['_id']) {
      Logger.info(`Re-submitting DigitalObject ${resultObject['_id']}`);
      collection.deleteOne({ _id: resultObject['_id'] });
    } else {
      resultObject['_id'] = ObjectId();
      Logger.info(`Generated DigitalObject ID ${resultObject['_id']}`);
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
          Logger.info(`${field['person_role']}, ${field['institution_role']}, ${field['roles']}`);

          return {
            '_id': (field['_id'] !== undefined && field['_id'].length > 0) ?
              await this.DBObjectsRepository.collection(add_to_coll)
                .updateOne({ _id: ObjectId(field['_id']) }, { $push: { roles: { $each: field['roles'] } } }).then(() => {
                  return String(field['_id']);
                }) :
              await this.DBObjectsRepository.collection(add_to_coll).insertOne(field).then(result => {
                return String(result.ops[0]['_id']);
              })
          };
        default:
          return {
            '_id': (field['_id'] !== undefined && field['_id'].length > 0) ?
              String(field['_id']) :
              await this.DBObjectsRepository.collection(add_to_coll).insertOne(field).then(result => {
                return String(result.ops[0]['_id']);
              })
          };
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

    if (resultObject['digobj_rightsowner'] instanceof Array) {
      for (let i = 0; i < resultObject['digobj_rightsowner'].length; i++) {
        if (resultObject['digobj_rightsowner'][i]['value']
          && resultObject['digobj_rightsowner'][i]['value'] === 'add_new_person') {
          // New Rightsowner Person
          const newRightsOwner = { ...resultObject['digobj_rightsowner_person'][0] };
          resultObject['digobj_rightsowner_person'][0] = await addAndGetId(newRightsOwner, 'person');
        } else if (resultObject['digobj_rightsowner'][i]['value']
          && resultObject['digobj_rightsowner'][i]['value'] === 'add_new_institution') {
          // New Rightsowner Institution
          const newRightsOwner = { ...resultObject['digobj_rightsowner_institution'][0] };
          resultObject['digobj_rightsowner_institution'][0] = await addAndGetId(newRightsOwner, 'institution');
        } else {
          // Existing Rightsowner Person or Institution
          const newRightsOwner = { ...resultObject['digobj_rightsowner'][i] };
          if (resultObject['digobj_rightsownerSelector'] === '1' || parseInt(resultObject['digobj_rightsownerSelector'], 10) === 1) {
            resultObject['digobj_rightsowner_person'][0] = await addAndGetId(newRightsOwner, 'person');
          } else if (resultObject['digobj_rightsownerSelector'] === '2' || parseInt(resultObject['digobj_rightsownerSelector'], 10) === 2) {
            resultObject['digobj_rightsowner_institution'][0] = await addAndGetId(newRightsOwner, 'institution');
          }
        }
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
        for (let i = 0; i < person['person_institution'].length; i++) {
          if (person['person_institution'][i]['value'] === 'add_new_institution') {
            const institution = person['person_institution_data'].pop();
            const newInst = await addAndGetId(institution, 'institution');
            person['person_institution_data'][0] = newInst;
          }
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
              const newInst = { ...phyObj['phyobj_rightsowner_institution'][0] };
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

    Logger.info(resultObject);

    collection.insertOne(resultObject, (db_error, db_result) => {
      if (db_error) {
        Logger.err(db_error);
        response.send('Failed to add');
      }
      Logger.info(`Finished Object ${db_result.ops[0]['_id']}`);
      response.send(db_result.ops[0]);
    });
  },
  addObjectToCollection: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    Logger.info('Adding to the following collection: ' + RequestCollection);

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

    const updateExisting = async (object) => {
      const found = await collection.findOne({ _id: object['_id'] });
      if (!found) {
        response.send({ status: 'error' });
        Logger.warn(`Tried to update non-existant object with id ${object['_id']}`);
      }
      collection.updateOne({ _id: object['_id'] }, { $set: object }, (up_error, _) => {
        if (up_error) {
          Logger.err(`Failed to update ${RequestCollection} instance`);
          response.send({ status: 'error' });
        } else {
          Logger.info(`Updated ${object['_id']}`);
          response.send({ status: 'ok' });
        }
      });
    };

    switch (RequestCollection) {
      case 'compilation':
      case 'model':
      case 'annotation':
        const resultObject = request.body;
        if (resultObject['models']) {
          // Compilations should have all their models added to the model database and referenced by _id
          resultObject['models'] = await Promise.all(resultObject['models'].map(async model => addAndGetId(model, 'model')));
        }
        if (resultObject['settings']) {
          // Preview image URLs might have a corrupted address because of Kompakkt runnning in an iframe
          // This removes the host address from the URL so images will load correctly
          resultObject['settings']['preview'] = `/previews/${resultObject['settings']['preview'].split('previews/').slice(-1)[0]}`;
        }

        if (resultObject['_id']) {
          updateExisting(resultObject);
        } else {
          // Insert new + LDAP
          collection.insertOne(request.body, async (_, db_result) => {
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
            Logger.info(`Success! Added new ${RequestCollection} ${db_result.ops[0]['_id']}`);
          });
        }
        break;
      default:
        collection.insertOne(request.body, (_, result) => {
          response.send(result.ops);

          if (result.ops[0] && result.ops[0]['_id']) {
            Logger.info(`Success! Added to ${RequestCollection} with ID ${result.ops[0]['_id']}`);
          }
        });
        break;
    }
  },
  updateModelSettings: async (request, response) => {
    const preview = request.body.preview;
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
        await imagemin.buffer(tempBuff, {
          plugins: [pngquant.default({
            speed: 1,
            strip: true,
            dithering: 1
          })]
        }).then(res => {
          ensureDirSync(`${RootDirectory}/${Configuration.Uploads.UploadDirectory}/previews/`);
          writeFileSync(`${RootDirectory}/${Configuration.Uploads.UploadDirectory}/previews/${identifier}.png`, res);
          finalImagePath = `/previews/${identifier}.png`;
        }).catch(e => Logger.err(e));
      } else {
        finalImagePath = `/previews/${preview.split('previews/')[1]}`;
      }
    } catch (e) {
      Logger.err(e);
      response.send({ status: 'error' });
    }

    // Overwrite old settings
    const settings = { ...request.body, preview: finalImagePath };
    const result = await collection.updateOne({ '_id': identifier },
      { $set: { settings: settings } });
    response.send((result.result.ok === 1) ? { status: 'ok', settings: settings } : { status: 'error' });
  },
  isUserOwnerOfObject: async (request, identifier) => {
    const sessionID = request.sessionID;
    const ldap = this.AccountsRepository.collection('ldap');
    const found = await ldap.findOne({ sessionID: sessionID });
    return JSON.stringify(found.data).indexOf(identifier) !== -1;
  },
  /**
   * Simple resolving by collection name and Id
   */
  resolve: async (obj, collection_name) => {
    Logger.info(`Resolving ${collection_name} ${(obj['_id']) ? obj['_id'] : obj}`);
    const resolve_collection = this.DBObjectsRepository.collection(collection_name);
    const id = (obj['_id']) ? obj['_id'] : obj;
    return await resolve_collection.findOne({ '_id': (ObjectId.isValid(id)) ? ObjectId(id) : id })
      .then((resolve_result) => resolve_result);
  },
  /**
   * Heavy nested resolving for DigitalObject
   */
  resolveDigitalObject: async (digitalObject) => {
    const resolveNestedInst = async (obj) => {
      if (obj['person_institution_data']) {
        for (let j = 0; j < obj['person_institution_data'].length; j++) {
          obj['person_institution_data'][j] =
            await Mongo.resolve(obj['person_institution_data'][j]['_id'], 'institution');
        }
      }
      return obj;
    };
    const resolveTopLevel = async (obj, property, field) => {
      for (let i = 0; i < obj[property].length; i++) {
        obj[property][i] =
          await resolveNestedInst(await Mongo.resolve(obj[property][i], field));
      }
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
  getObjectFromCollection: (request, response) => {
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
              const _owner = await Mongo.isUserOwnerOfObject(request, identifier);
              if (!_owner) {
                if (result['password'] !== password || (password === '' && result['password'] !== '')) {
                  response.send({ status: 'ok', message: 'Password protected compilation' });
                  return;
                }
              }
            }

            for (let i = 0; i < result.models.length; i++) {
              result.models[i] = await Mongo.resolve(result.models[i]._id, 'model');
            }

            response.send(result);
          } else {
            response.send({ status: 'ok' });
          }
        }).catch((db_error) => {
          Logger.err(db_error);
          response.send({ status: 'error' });
        });
        break;
      case 'digitalobject':
        collection.findOne({ '_id': identifier }).then(async (result) => {
          response.send((result) ? await Mongo.resolveDigitalObject(result) : { status: 'error' });
        });
        break;
      default:
        collection.findOne({ '_id': identifier }, (_, result) => {
          response.send(result ? result : { status: 'ok' });
        });
        break;
    }
  },
  getAllObjectsFromCollection: (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const collection = this.DBObjectsRepository.collection(RequestCollection);

    switch (RequestCollection) {
      case 'compilation':
        collection.find({}).toArray(async (_, compilations) => {
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
        collection.find({}).toArray((_, result) => {
          response.send(result.filter(model => model['finished'] && model['online']));
        });
        break;
      default:
        collection.find({}).toArray((_, result) => {
          response.send(result);
        });
        break;
    }
  },
  removeObjectFromCollection: async (request, response) => {
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
        case 'compilation':
          find_result.data.compilations = find_result.data.compilations.filter(id => id !== identifier.toString());
          break;
        case 'model':
          find_result.data.models = find_result.data.models.filter(id => id !== identifier.toString());
          break;
        case 'annotation':
          find_result.data.annotations = find_result.data.annotations.filter(id => id !== identifier.toString());
          break;
        default: break;
      }
      const update_result = await ldap.updateOne({ sessionID: sessionID }, { $set: { data: find_result.data } });
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
    let allObjects = await collection.find({}).toArray();

    const getNestedValues = (obj) => {
      let result: string[] = [];
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
      const result: any[] = [];
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

Mongo.init();

export { Mongo };
