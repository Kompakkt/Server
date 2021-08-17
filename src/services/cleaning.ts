import { Request, Response } from 'express';
import { remove } from 'fs-extra';
import klawSync from 'klaw-sync';
import { Configuration } from './configuration';
import { Logger } from './logger';
import { RootDirectory } from '../environment';
import { Entities, Accounts, Repo, query, isValidCollection } from './db';

const deleteFile = async (path: string) =>
  remove(`${RootDirectory}/${path}`)
    .then(() => {
      Logger.log('Removed file/folder', path);
      return true;
    })
    .catch(err => {
      Logger.log('Failed removing file/folder', path, err);
      return false;
    });

interface IConfirmRequest {
  confirm?: boolean;
}

const deleteUnusedPersonsAndInstitutions = async (req: Request<IConfirmRequest>, res: Response) => {
  const allPersons = await Repo.person.findAll();
  const allInstitutions = await Repo.institution.findAll();
  const allDigObjs = await Repo.digitalentity.findAll();
  const allPhyObjs = await Repo.physicalentity.findAll();

  const confirm = req.params.confirm;

  const total: any[] = [];

  // TODO: Delete Tags

  const fullJSON = `${JSON.stringify(allDigObjs)}${JSON.stringify(allPhyObjs)}`;
  for (const person of allPersons) {
    const _id = person._id.toString();
    const index = fullJSON.indexOf(_id);
    if (index !== -1) continue;
    if (!confirm) continue;
    const deleteResult = await Repo.person.deleteOne(query(person._id));
    if (deleteResult) {
      Logger.info(`Deleted unused person ${person}`);
      total.push({ person, result: deleteResult });
    }
  }
  for (const institution of allInstitutions) {
    const _id = institution._id.toString();
    const index = fullJSON.indexOf(_id);
    if (index !== -1) continue;
    if (!confirm) continue;
    const deleteResult = await Repo.institution.deleteOne(query(institution._id));
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
};

const deleteNullRefs = async (req: Request<IConfirmRequest>, res: Response) => {
  const allUsers = await Accounts.users.findAll();

  const confirm = req.params.confirm;

  const total: any[] = [];

  const checkReferences = async (array: any[], coll: string) => {
    const deletedReferences: any[] = [];
    if (!isValidCollection(coll)) return [];
    for (const _id of array) {
      const result = await Entities.resolve<any>(_id, coll);
      if (result !== null && Object.keys(result).length > 0) continue;
      deletedReferences.push({ coll, _id });
    }
    return deletedReferences;
  };

  const deleteUserNullRefs = async (user: any, nullrefs: any[]): Promise<boolean> => {
    for (const ref of nullrefs) {
      const index = user.data[ref.coll].indexOf(ref._id);
      user.data[ref.coll].splice(index, 1);
    }
    if (!confirm) return true;
    const updateResult = await Accounts.users.updateOne(query(user._id), {
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
    for (const coll in user.data) {
      if (user.data[coll] instanceof Array) {
        if (user.data[coll].length <= 0) continue;
        const nullRefs = await checkReferences(user.data[coll], coll);
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
};

const cleanUploadedFiles = async (req: Request<IConfirmRequest>, res: Response) => {
  const entities = await Repo.entity.findAll();
  // Get all file paths from entities and flatten the array
  const files = entities.flatMap(e => e.files.map(file => file.file_link));

  const confirm = req.params.confirm;

  const subfolders = ['model', 'video', 'audio', 'image'];

  const uploadPath = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}`;
  const existingFiles = subfolders.flatMap(folder =>
    klawSync(`${uploadPath}/${folder}`)
      .filter(item => !item.stats.isDirectory())
      .map(item => item.path.replace(`${RootDirectory}/`, '')),
  );

  const filesToDelete = existingFiles.filter(file => !files.includes(file));

  const results = new Array<boolean>();
  if (confirm) results.push(...await Promise.all(filesToDelete.map(deleteFile)));

  res.status(200).send({
    confirm,
    files,
    existingFiles,
    filesToDelete,
    deleted: results.filter(d => d),
    errors: results.filter(d => !d),
  });
};

const Cleaning = {
  deleteUnusedPersonsAndInstitutions,
  deleteNullRefs,
  cleanUploadedFiles,
};

export { Cleaning };
