import { Request, Response } from 'express';
import { Collection, Db } from 'mongodb';
import { unlink } from 'fs-extra';

import klawSync from 'klaw-sync';

import { Configuration } from './configuration';
import { Logger } from './logger';
import { Mongo, updateOne } from './mongo';
import { RootDirectory } from '../environment';
import { IMetaDataPerson, IMetaDataInstitution, IEntity } from '../interfaces';

const deleteFile = async (path: string) =>
  new Promise<void>((resolve, reject) =>
    unlink(`${RootDirectory}/${path}`, err => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    }),
  );

interface ICleaning {
  deleteUnusedPersonsAndInstitutions(
    request: Request,
    response: Response,
  ): Promise<any>;
  deleteNullRefs(request: Request, response: Response): Promise<any>;

  cleanPersonFields(request: Request, response: Response): Promise<any>;

  cleanInstitutionFields(request: Request, response: Response): Promise<any>;

  cleanUploadedFiles(request: Request, response: Response): Promise<any>;
}

const Cleaning: ICleaning = {
  deleteUnusedPersonsAndInstitutions: async (request, response) => {
    const ObjDB: Db = Mongo.getEntitiesRepository();
    const personCollection = ObjDB.collection('person');
    const instCollection = ObjDB.collection('institution');
    const digobjCollection = ObjDB.collection('digitalentity');
    const phyobjCollection = ObjDB.collection('physicalentity');
    const allPersons = await personCollection.find({}).toArray();
    const allInstitutions = await instCollection.find({}).toArray();
    const allDigObjs = await digobjCollection.find({}).toArray();
    const allPhyObjs = await phyobjCollection.find({}).toArray();

    const confirm = request.params.confirm || false;

    const total: any[] = [];

    // TODO: Delete Tags

    const fullJSON = `${JSON.stringify(allDigObjs)}${JSON.stringify(
      allPhyObjs,
    )}`;
    for (const person of allPersons) {
      const _id = person._id;
      const index = fullJSON.indexOf(_id);
      if (index !== -1) continue;
      if (!confirm) continue;
      const deleteResult = await personCollection.deleteOne({
        _id: person._id,
      });
      if (deleteResult.result.ok === 1) {
        Logger.info(`Deleted unused person ${person}`);
        total.push({ person, result: deleteResult.result });
      }
    }
    for (const institution of allInstitutions) {
      const _id = institution._id;
      const index = fullJSON.indexOf(_id);
      if (index !== -1) continue;
      if (!confirm) continue;
      const deleteResult = await instCollection.deleteOne({
        _id: institution._id,
      });
      if (deleteResult.result.ok === 1) {
        Logger.info(`Deleted unused institution ${institution}`);
        total.push({ institution, result: deleteResult.result });
      }
    }

    Logger.log(`Deleted ${total.length} unused persons and/or institutions`);
    response.send({
      status: 'ok',
      confirm,
      total,
      amount: total.length,
    });
  },
  deleteNullRefs: async (request, response) => {
    const AccDB: Db = Mongo.getAccountsRepository();
    const users: Collection = AccDB.collection('users');
    const allUsers = await users.find({}).toArray();

    const confirm = request.params.confirm || false;

    const total: any[] = [];

    const checkReferences = async (array: any[], field: string) => {
      const deletedReferences: any[] = [];
      for (const _id of array) {
        const result = await Mongo.resolve(_id, field);
        if (result !== null && Object.keys(result).length > 0) continue;
        deletedReferences.push({ field, _id });
      }
      return deletedReferences;
    };

    const deleteUserNullRefs = async (
      user: any,
      nullrefs: any[],
    ): Promise<boolean> => {
      for (const ref of nullrefs) {
        const index = user.data[ref.field].indexOf(ref._id);
        user.data[ref.field].splice(index, 1);
      }
      if (!confirm) return true;
      const updateResult = await users.updateOne(
        { _id: user._id },
        { $set: { data: user.data } },
      );
      if (updateResult.result.ok !== 1) {
        Logger.err(`Failed deleting missing references of user ${user._id}`);
        return false;
      }
      Logger.info(
        `Deleted ${nullrefs.length} missing references from user ${user._id}`,
      );
      return true;
    };

    const iterateOverUserData = async (user: any) => {
      for (const property in user.data) {
        if (!user.data.hasOwnProperty(property)) continue;
        if (user.data[property] instanceof Array) {
          if (user.data[property].length <= 0) continue;
          const nullRefs = await checkReferences(user.data[property], property);
          if (nullRefs.length === 0) continue;
          const success = await deleteUserNullRefs(user, nullRefs);
          if (success) total.push({ user: user.username, nullRefs });
        }
      }
    };

    for (const user of allUsers) {
      await iterateOverUserData(user);
    }
    response.send({ status: 'ok', confirm, total });
  },
  cleanPersonFields: async (request, response) => {
    const ObjDB: Db = Mongo.getEntitiesRepository();
    const personCollection = ObjDB.collection<IMetaDataPerson>('person');
    const cursor = personCollection.find({});

    const confirm = request.params.confirm || false;

    const canContinue = async () =>
      (await cursor.hasNext()) && !cursor.isClosed();

    let totalSaved = 0;
    const personsChanged = new Array<IMetaDataPerson>();

    while (await canContinue()) {
      const person = await cursor.next();
      if (!person) break;

      const sizeBefore = JSON.stringify(person).length;

      let changedPerson = false;
      for (const _id in person.institutions) {
        if (person.institutions[_id].length === 0) {
          delete person.institutions[_id];
          changedPerson = true;
        }
      }
      for (const _id in person.roles) {
        if (person.roles[_id].length === 0) {
          delete person.roles[_id];
          changedPerson = true;
        }
      }
      for (const _id in person.contact_references) {
        const ref = person.contact_references[_id];
        if (ref.mail === '' && ref.phonenumber === '') {
          delete person.contact_references[_id];
          changedPerson = true;
        }
      }

      const sizeAfter = JSON.stringify(person).length;

      if (changedPerson) {
        if (confirm) {
          const result = await updateOne(
            personCollection,
            { _id: person._id },
            { $set: person },
          );
          if (result.result.ok !== 1) {
            Logger.err('Failed updating cleaned person', person, result);
          }
        }
        personsChanged.push(person);
        totalSaved += sizeBefore - sizeAfter;
      }
    }

    Logger.log(
      `Cleaned ${personsChanged.length} persons and saved ${totalSaved} characters`,
    );

    response.send({ status: 'ok', confirm, personsChanged, totalSaved });
  },
  cleanInstitutionFields: async (request, response) => {
    const ObjDB: Db = Mongo.getEntitiesRepository();
    const instCollection = ObjDB.collection<IMetaDataInstitution>(
      'institution',
    );
    const cursor = instCollection.find({});

    const confirm = request.params.confirm || false;

    const canContinue = async () =>
      (await cursor.hasNext()) && !cursor.isClosed();

    const changedInsts = new Array<IMetaDataInstitution>();
    let totalSaved = 0;

    while (await canContinue()) {
      const inst = await cursor.next();
      if (!inst) continue;

      let changed = false;
      const sizeBefore = JSON.stringify(inst).length;

      for (const _id in inst.addresses) {
        const addr = inst.addresses[_id];
        delete addr.creation_date;

        if (Object.values(addr).join('').length === 0) {
          delete inst.addresses[_id];
          changed = true;
        }
      }

      for (const _id in inst.notes) {
        const note = inst.notes[_id];
        if (note.length === 0) {
          delete inst.notes[_id];
          changed = true;
        }
      }

      for (const _id in inst.roles) {
        const role = inst.roles[_id];
        if (role.length === 0) {
          delete inst.roles[_id];
          changed = true;
        }
      }

      const sizeAfter = JSON.stringify(inst).length;

      if (changed) {
        changedInsts.push(inst);
        totalSaved += sizeBefore - sizeAfter;

        if (confirm) {
          // TODO: update on server & fix entity-landing page
          const result = await updateOne(
            instCollection,
            { _id: inst._id },
            { $set: inst },
          );
          if (result.result.ok !== 1) {
            Logger.err('Failed updating cleaned inst', inst, result);
          }
        }
      }
    }

    response.send({ status: 'ok', confirm, changedInsts, totalSaved });
  },
  cleanUploadedFiles: async (request, response) => {
    const ObjDB: Db = Mongo.getEntitiesRepository();
    const entities = await ObjDB.collection<IEntity>('entity')
      .find({})
      .toArray();
    // Get all file paths from entities and flatten the array
    const files = ([] as string[]).concat(
      ...entities.map(entity => entity.files.map(file => file.file_link)),
    );

    const confirm = request.params.confirm || false;

    const subfolders = ['model', 'video', 'audio', 'image'];

    const uploadPath = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}`;
    const existingFiles = ([] as string[]).concat(
      ...subfolders.map(folder =>
        klawSync(`${uploadPath}/${folder}`)
          .filter(item => !item.stats.isDirectory())
          .map(item => item.path.replace(`${RootDirectory}/`, '')),
      ),
    );

    const filesToDelete = existingFiles.filter(file => !files.includes(file));

    if (confirm) {
      await Promise.all(filesToDelete.map(deleteFile));
    }

    response.send({
      status: 'ok',
      confirm,
      files,
      existingFiles,
      filesToDelete,
    });
  },
};

export { Cleaning };
