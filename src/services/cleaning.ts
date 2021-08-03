import { Request, Response } from 'express';
import { unlink } from 'fs-extra';

import klawSync from 'klaw-sync';

import { Configuration } from './configuration';
import { Logger } from './logger';
import {
  Mongo,
  deleteOne,
  users,
  updateOne,
  getAllItemsOfCollection,
  getCollection,
} from './mongo';
import { RootDirectory } from '../environment';
import { IEntity } from '../common/interfaces';

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
  deleteUnusedPersonsAndInstitutions(req: Request, res: Response): Promise<any>;
  deleteNullRefs(req: Request, res: Response): Promise<any>;
  cleanUploadedFiles(req: Request, res: Response): Promise<any>;
}

const Cleaning: ICleaning = {
  deleteUnusedPersonsAndInstitutions: async (req, res) => {
    const personCollection = getCollection('person');
    const instCollection = getCollection('institution');
    const allPersons = await getAllItemsOfCollection('person');
    const allInstitutions = await getAllItemsOfCollection('institution');
    const allDigObjs = await getAllItemsOfCollection('digitalentity');
    const allPhyObjs = await getAllItemsOfCollection('physicalentity');

    const confirm = req.params.confirm || false;

    const total: any[] = [];

    // TODO: Delete Tags

    const fullJSON = `${JSON.stringify(allDigObjs)}${JSON.stringify(allPhyObjs)}`;
    for (const person of allPersons) {
      const _id = person._id;
      const index = fullJSON.indexOf(_id);
      if (index !== -1) continue;
      if (!confirm) continue;
      const deleteResult = await deleteOne(personCollection, Mongo.query(person._id));
      if (deleteResult) {
        Logger.info(`Deleted unused person ${person}`);
        total.push({ person, result: deleteResult });
      }
    }
    for (const institution of allInstitutions) {
      const _id = institution._id;
      const index = fullJSON.indexOf(_id);
      if (index !== -1) continue;
      if (!confirm) continue;
      const deleteResult = await deleteOne(instCollection, Mongo.query(institution._id));
      if (deleteResult) {
        Logger.info(`Deleted unused institution ${institution}`);
        total.push({ institution, result: deleteResult });
      }
    }

    Logger.log(`Deleted ${total.length} unused persons and/or institutions`);
    res.status(200).send({
      confirm,
      total,
      amount: total.length,
    });
  },
  deleteNullRefs: async (req, res) => {
    const allUsers = await users().find({}).toArray();

    const confirm = req.params.confirm || false;

    const total: any[] = [];

    const checkReferences = async (array: any[], field: string) => {
      const deletedReferences: any[] = [];
      for (const _id of array) {
        const result = await Mongo.resolve<any>(_id, field);
        if (result !== null && Object.keys(result).length > 0) continue;
        deletedReferences.push({ field, _id });
      }
      return deletedReferences;
    };

    const deleteUserNullRefs = async (user: any, nullrefs: any[]): Promise<boolean> => {
      for (const ref of nullrefs) {
        const index = user.data[ref.field].indexOf(ref._id);
        user.data[ref.field].splice(index, 1);
      }
      if (!confirm) return true;
      const updateResult = await updateOne(users(), Mongo.query(user._id), {
        $set: { data: user.data },
      });
      if (!updateResult) {
        Logger.err(`Failed deleting missing references of user ${user._id}`);
        return false;
      }
      Logger.info(`Deleted ${nullrefs.length} missing references from user ${user._id}`);
      return true;
    };

    const iterateOverUserData = async (user: any) => {
      for (const property in user.data) {
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
    res.status(200).send({ confirm, total });
  },
  cleanUploadedFiles: async (req, res) => {
    const entities = await getAllItemsOfCollection<IEntity>('entity');
    // Get all file paths from entities and flatten the array
    const files = ([] as string[]).concat(
      ...entities.map(entity => entity.files.map(file => file.file_link)),
    );

    const confirm = req.params.confirm || false;

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

    res.status(200).send({
      confirm,
      files,
      existingFiles,
      filesToDelete,
    });
  },
};

export { Cleaning };
