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
    const username = request.body.username;
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
            data: { compilations: [], annotations: [], models: [] },
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
    found.data.compilations = await Promise.all(found.data.compilations
      .map(async compilation => Mongo.resolve(compilation, 'compilation')));
    found.data.models = await Promise.all(found.data.models
      .map(async model => Mongo.resolve(model, 'model')));
    found.data.annotations = await Promise.all(found.data.annotations
      .map(async annotation => Mongo.resolve(annotation, 'annotation')));
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

    switch (service) {
      case 'europeana':
        // TODO: Put into Europeana service to make every service self sustained?
        const resultObject = {
          digobj_type: mapTypes(request.body.type),
          digobj_title: request.body.title,
          digobj_description: request.body.description,
          digobj_licence: request.body.license,
          digobj_externalLink: [{
            externalLink_description: 'Europeana URL',
            externalLink_value: request.body.page,
          }],
        };

        digobjCollection.insertOne(resultObject)
          .then((res: InsertOneWriteOpResult) => {
            const modelObject = {
              relatedDigitalObject: {
                _id: res.ops[0]._id,
              },
              name: resultObject.digobj_title,
              ranking: 0,
              files: undefined,
              finished: true,
              online: true,
              isExternal: true,
              externalService: 'europeana',
              processed: {
                low: resultObject.digobj_externalLink[0].externalLink_value,
                medium: resultObject.digobj_externalLink[0].externalLink_value,
                high: resultObject.digobj_externalLink[0].externalLink_value,
                raw: resultObject.digobj_externalLink[0].externalLink_value,
              },
              settings: {
                preview: (request.body._previewUrl)
                  ? request.body._previewUrl
                  : '/previews/noimage.png',
              },
            };
            modelCollection.insertOne(modelObject)
              .then(_res => {
                Mongo.insertCurrentUserData(request, _res.ops[0]._id, 'models')
                  .then(() => {
                    response.send({ status: 'ok', result: _res.ops[0] });
                    Logger.info('Added Europeana object', res.ops[0]._id);
                  })
                  .catch(err => {
                    Logger.err(err);
                    response.send({ status: 'error', message: 'Failed adding finalized object to user' });
                  });
              })
              .catch(err => {
                Logger.err(err);
                response.send({ status: 'error', message: 'Failed finalizing digitalobject' });
              });
          })
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
    Logger.info(request.body);

    const collection = this.DBObjectsRepository.collection('digitalobject');
    const resultObject = { ...request.body };

    /**
     * Handle re-submit for changing a finished DigitalObject
     */
    const isResObjIdValid = ObjectId.isValid(resultObject['_id']);
    resultObject['_id'] = isResObjIdValid
      ? new ObjectId(resultObject['_id']) : new ObjectId();
    Logger.info(`${isResObjIdValid ? 'Re-' : ''}Submitting DigitalObject ${resultObject['_id']}`);

    /**
     * Adds data {field} to a collection {collection}
     * and returns the {_id} of the created object.
     * If {field} already has an {_id} property the server
     * will assume the object already exists in the collection
     * and instead return the existing {_id}
     */
    const addAndGetId = async (field, add_to_coll) => {
      // Add new roles to person or institution
      field['roles'] = [];
      for (const prop of ['institution_role', 'person_role']) {
        if (!field[prop]) continue;
        if (field[prop] instanceof Array) {
          for (const role of field[prop]) {
            field['roles'].push({
              role,
              relatedDigitalObject: resultObject['_id'],
            });
          }
        } else {
          field['roles'].push({
            role: field[prop],
            relatedDigitalObject: resultObject['_id'],
          });
        }
      }
      Logger.info(`${field['person_role']}, ${field['institution_role']}, ${field['roles']}`);
      // By default, update/create the document
      // but if its an existing person/institution, push roles
      // TODO: Think about cases where person/institution would be updated otherwise
      const isIdValid = ObjectId.isValid(field['_id']);
      let updateQuery: any = { $set: field };
      if (['person', 'institution'].includes(add_to_coll) && isIdValid) {
        updateQuery = { $push: { roles: { $each: field['roles'] } } };
      }
      const _id = (isIdValid) ? new ObjectId(field['_id']) : new ObjectId();
      await this.DBObjectsRepository.collection(add_to_coll)
          .updateOne(
            { _id  },
            updateQuery,
            { upsert: true })
          .then(() => Logger.info(`addAndGetId: ${_id}`))
          .catch(e => Logger.err(e));
      return { _id };
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

    /**
     * Use addAndGetId function on all Arrays containing
     * data that need to be added to collections
     */

    resultObject['digobj_rightsowner_person'] = await Promise.all(
      resultObject['digobj_rightsowner_person'].map(async person => {
        return addAndGetId(await addNestedInstitution(person), 'person');
      }));

    resultObject['digobj_rightsowner_institution'] = await Promise.all(
      resultObject['digobj_rightsowner_institution']
        .map(async institution => addAndGetId(institution, 'institution')));

    if (resultObject['digobj_rightsowner'] instanceof Array) {
      for (const digOwner of resultObject['digobj_rightsowner']) {
        // for (let i = 0; i < resultObject['digobj_rightsowner'].length; i++) {
        if (digOwner['value']
          && digOwner['value'] === 'add_new_person') {
          // New Rightsowner Person
          const newRightsOwner = { ...resultObject['digobj_rightsowner_person'][0] };
          resultObject['digobj_rightsowner_person'][0] =
            await addAndGetId(newRightsOwner, 'person');
        } else if (digOwner['value']
          && digOwner['value'] === 'add_new_institution') {
          // New Rightsowner Institution
          const newRightsOwner = { ...resultObject['digobj_rightsowner_institution'][0] };
          resultObject['digobj_rightsowner_institution'][0] =
            await addAndGetId(newRightsOwner, 'institution');
        } else {
          // Existing Rightsowner Person or Institution
          const newRightsOwner = { ...digOwner };
          const personSelector = 1;
          const instSelector = 2;
          switch (parseInt(resultObject['digobj_rightsownerSelector'], 10)) {
            case personSelector:
              resultObject['digobj_rightsowner_person'][0] =
                await addAndGetId(await addNestedInstitution(newRightsOwner), 'person');
            case instSelector:
              resultObject['digobj_rightsowner_institution'][0] =
                await addAndGetId(newRightsOwner, 'institution');
            default:
          }
        }
      }
    }

    resultObject['contact_person'] = await Promise.all(
      resultObject['contact_person'].map(async person => addAndGetId(person, 'person')));

    if (resultObject['contact_person_existing'] instanceof Array) {
      for (const contactExisting of resultObject['contact_person_existing']) {
        if (contactExisting['value']
          && contactExisting['value'] === 'add_to_new_rightsowner_person') {
          // Contact Person is the same as Rightsowner Person
          const newContact = { ...resultObject['digobj_rightsowner_person'][0] };
          newContact['person_role'] = 'CONTACT_PERSON';
          resultObject['contact_person'].push(await addAndGetId(newContact, 'person'));
        } else if (ObjectId.isValid(contactExisting['_id'])) {
          // Contact Person is existing Person
          const newContact = {};
          newContact['person_role'] = 'CONTACT_PERSON';
          newContact['_id'] = contactExisting['_id'];
          resultObject['contact_person'].push(await addAndGetId(newContact, 'person'));
        }
      }
    }

    resultObject['digobj_person'] = await Promise.all(
      resultObject['digobj_person'].map(async person => {
        return addAndGetId(await addNestedInstitution(person), 'person');
      }));

    const digPersExisting = resultObject['digobj_person_existing'];
    if (digPersExisting instanceof Array) {
      for (let i = 0; i < digPersExisting.length; i++) {
        if (digPersExisting[i]['value']
          && digPersExisting[i]['value'] === 'add_to_new_rightsowner_person') {
          const newContact = { ...resultObject['digobj_rightsowner_person'][0] };
          newContact['person_role'] = digPersExisting[i]['person_role'];
          resultObject['digobj_person'].push(await addAndGetId(newContact, 'person'));
        } else if (ObjectId.isValid(digPersExisting[i]['_id'])) {
          const newContact = {};
          newContact['person_role'] = digPersExisting[i]['person_role'];
          newContact['_id'] = resultObject['contact_person_existing'][i]['_id'];
          resultObject['digobj_person'].push(await addAndGetId(newContact, 'person'));
        }
      }
    }
    resultObject['digobj_person_existing'] = digPersExisting;

    resultObject['phyObjs'] = await Promise.all(
      resultObject['phyObjs'].map(async phyObj => {
        // Rightsowner Person
        if (ObjectId.isValid(phyObj['phyobj_rightsowner']['_id'])) {
          const newPhyRightsOwnerPerson = {};
          newPhyRightsOwnerPerson['_id'] = phyObj['phyobj_rightsowner']['_id'];
          newPhyRightsOwnerPerson['person_role'] = 'RIGHTS_OWNER';
          phyObj['phyobj_rightsowner_person'] =
            await addAndGetId(await addNestedInstitution(newPhyRightsOwnerPerson), 'person');
        } else if (phyObj['phyobj_rightsowner_person'].length > 0
          && !phyObj['phyobj_rightsowner_person'][0]['_id']) {
          phyObj['phyobj_rightsowner_person'] = await Promise.all(
            phyObj['phyobj_rightsowner_person'].map(
              async phyObjRightsOwner =>
                addAndGetId(await addNestedInstitution(phyObjRightsOwner), 'person'),
            ));
        }

        // Rightsowner Institution
        let phyRightsInst = phyObj['phyobj_rightsowner_institution'];
        if (ObjectId.isValid(phyRightsInst['_id'])) {
          const newPhyRightsOwnerInstitution = {};
          newPhyRightsOwnerInstitution['_id'] = phyObj['phyobj_rightsowner']['_id'];
          newPhyRightsOwnerInstitution['institution_role'] = phyObj['institution_role'];
          phyRightsInst = await addAndGetId(newPhyRightsOwnerInstitution, 'institution');
        } else if (phyRightsInst.length > 0 && !phyRightsInst[0]['_id']) {
          phyRightsInst = await Promise.all(
            phyRightsInst.map(
              phyObjRightsOwner => addAndGetId(phyObjRightsOwner, 'institution'),
            ));
        }
        phyObj['phyobj_rightsowner_institution'] = phyRightsInst;

        // Person
        if (phyObj['phyobj_person'] && !phyObj['phyobj_person']['_id']) {
          phyObj['phyobj_person'] = await Promise.all(
            phyObj['phyobj_person'].map(
              async phyObjPerson => {
                return addAndGetId(await addNestedInstitution(phyObjPerson), 'person');
              }));
        }

        if (phyObj['phyobj_person_existing'] instanceof Array) {
          for (const phyPersExisting of phyObj['phyobj_person_existing']) {
            if (phyPersExisting['value']
              && phyPersExisting['value'] === 'add_to_new_rightsowner_person') {
              // Contact Person is the same as Rightsowner Person
              const newPerson = { ...phyObj['phyobj_rightsowner_person'][0] };
              newPerson['person_role'] = phyPersExisting['person_role'];
              phyObj['phyobj_person'].push(await addAndGetId(newPerson, 'person'));
            } else if (ObjectId.isValid(phyPersExisting['_id'])) {
              // Contact Person is existing Person
              const newPerson = {};
              newPerson['person_role'] = phyPersExisting['person_role'];
              newPerson['_id'] = phyPersExisting['_id'];
              phyObj['phyobj_person'].push(await addAndGetId(newPerson, 'person'));
            }
          }
        }

        // Institution
        if (phyObj['phyobj_institution'] && !phyObj['phyobj_institution']['_id']) {
          phyObj['phyobj_institution'] = await Promise.all(
            phyObj['phyobj_institution'].map(
              phyObjInstitution => addAndGetId(phyObjInstitution, 'institution'),
            ));
        }

        if (phyObj['phyobj_institution_existing'] instanceof Array) {
          for (const phyInstExisting of phyObj['phyobj_institution_existing']) {
            if (ObjectId.isValid(phyInstExisting['_id'])) {
              const newInst = {};
              newInst['institution_role'] = phyInstExisting['institution_role'];
              newInst['_id'] = phyInstExisting['_id'];
              phyObj['phyobj_institution'].push(await addAndGetId(newInst, 'institution'));
            } else if (phyInstExisting['value']
              && phyInstExisting['value'] === 'add_to_new_rightsowner_institution') {
              const newInst = { ...phyObj['phyobj_rightsowner_institution'][0] };
              newInst['institution_role'] = phyInstExisting['institution_role'];
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
    collection.updateOne({ _id: resultObject['_id'] }, { $set: resultObject }, { upsert: true })
    .then(() => Mongo.resolve(resultObject['_id'], 'digitalobject'))
    .then(data => {
      Logger.info(`Finished Object ${resultObject['_id']}`);
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

    const collection = this.DBObjectsRepository.collection(RequestCollection);
    const sessionID = request.sessionID;
    const ldap = this.AccountsRepository.collection('ldap');

    const addAndGetId = async (field, add_to_coll) => {
      return {
        _id: (field['_id'] !== undefined && field['_id'].length > 0) ?
          String(field['_id']) :
          await this.DBObjectsRepository.collection(add_to_coll)
            .insertOne(field)
            .then(result => {
              return String(result.ops[0]['_id']);
            }),
      };
    };

    const updateExisting = async object => {
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
          /* Compilations should have all their models
           * added to the model database and referenced by _id */
          resultObject['models'] =
            await Promise
              .all(resultObject['models'].map(async model => addAndGetId(model, 'model')));
        }
        if (resultObject['settings']) {
          /* Preview image URLs might have a corrupted address
           * because of Kompakkt runnning in an iframe
           * This removes the host address from the URL
           * so images will load correctly */
          resultObject['settings']['preview'] =
            `/previews/${resultObject['settings']['preview']
              .split('previews/')
              .slice(-1)[0]}`;
        }

        if (resultObject['_id']) {
          updateExisting(resultObject)
            .catch(e => Logger.err(e));
        } else {
          // Insert new + LDAP
          collection.insertOne(request.body, async (_, db_result) => {
            const userData = await ldap.findOne({ sessionID });
            switch (RequestCollection) {
              case 'model': userData.data.models.push(`${db_result.ops[0]['_id']}`);
              case 'annotation': userData.data.annotations.push(`${db_result.ops[0]['_id']}`);
              case 'compilation': userData.data.compilations.push(`${db_result.ops[0]['_id']}`);
              default:
            }
            const result = await ldap.updateOne({ sessionID }, { $set: { data: userData.data } });
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
    }
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
    const sessionID = request.sessionID;
    const ldap = this.AccountsRepository.collection('ldap');
    const found = await ldap.findOne({ sessionID });
    return JSON.stringify(found.data)
      .indexOf(identifier) !== -1;
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
          obj[property][i] = await resolveNestedInst(resolved);
        }
      }
    };
    const props = [
      ['digobj_rightsowner_person'], ['contact_person'], ['digobj_person'],
      ['digobj_rightsowner_institution', 'institution'], ['digobj_tags', 'tag']];

    for (const prop of props) {
      await resolveTopLevel(digitalObject, prop[0], (prop[1]) ? prop[1] : 'person');
    }
    const resolvedPhysicalObjects: any[] = [];
    for (let phyObj of digitalObject['phyObjs']) {
      phyObj = await Mongo.resolve(phyObj, 'physicalobject');
      await resolveTopLevel(phyObj, 'phyobj_rightsowner_person', 'person');
      await resolveTopLevel(phyObj, 'phyobj_rightsowner_institution', 'institution');
      await resolveTopLevel(phyObj, 'phyobj_person', 'person');
      await resolveTopLevel(phyObj, 'phyobj_institution', 'institution');
      resolvedPhysicalObjects.push(phyObj);
    }
    digitalObject['phyObjs'] = resolvedPhysicalObjects;
    return digitalObject;
  },
  getObjectFromCollection: (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const collection = this.DBObjectsRepository.collection(RequestCollection);
    const identifier = (ObjectId.isValid(request.params.identifier)) ?
      new ObjectId(request.params.identifier) : request.params.identifier;
    const password = (request.params.password) ? request.params.password : '';

    switch (RequestCollection) {
      case 'compilation':
        collection.findOne({ _id: identifier })
          .then(async (result: ICompilation) => {
            if (result) {
              if (result['password'] && result['password'].length > 0) {
                const _owner = await Mongo.isUserOwnerOfObject(request, identifier);
                if (!_owner) {
                  if (result['password'] !== password
                    || (password === '' && result['password'] !== '')) {
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
          })
          .catch(db_error => {
            Logger.err(db_error);
            response.send({ status: 'error' });
          });
        break;
      case 'digitalobject':
        collection.findOne({ _id: identifier })
          .then(async result => {
            response.send((result) ? await Mongo.resolveDigitalObject(result) : { status: 'error' });
          });
        break;
      default:
        collection.findOne({ _id: identifier }, (_, result) => {
          response.send(result ? result : { status: 'ok' });
        });
    }
  },
  getAllObjectsFromCollection: (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const collection = this.DBObjectsRepository.collection(RequestCollection);

    switch (RequestCollection) {
      case 'compilation':
        collection.find({})
          .toArray(async (_, resultCompilations) => {
            if (resultCompilations) {
              let compilations = resultCompilations;
              compilations = compilations.filter(compilation =>
                !compilation.password ||
                (compilation.password && compilation.password.length === 0));

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
            } else {
              response.send({ status: 'ok' });
            }
          });
        break;
      case 'model':
        collection.find({})
          .toArray((_, result) => {
            response.send(result.filter(model => model['finished'] && model['online']));
          });
        break;
      default:
        collection.find({})
          .toArray((_, result) => {
            response.send(result);
          });
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
      switch (RequestCollection) {
        case 'compilation':
          find_result.data.compilations =
            find_result.data.compilations.filter(id => id !== identifier.toString());
          break;
        case 'model':
          find_result.data.models =
            find_result.data.models.filter(id => id !== identifier.toString());
          break;
        case 'annotation':
          find_result.data.annotations =
            find_result.data.annotations.filter(id => id !== identifier.toString());
          break;
        default:
      }
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
    const found = await collection.find({});
    let allObjects = found.toArray();

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
