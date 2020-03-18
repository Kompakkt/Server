import { Request, Response } from 'express';
import { ensureDir, move, pathExists, statSync } from 'fs-extra';
import klawSync from 'klaw-sync';
import multer from 'multer';
import { basename, dirname, extname, join } from 'path';
import slugify from 'slugify';

import { RootDirectory } from '../environment';

import { Configuration } from './configuration';
import { Logger } from './logger';

interface IUpload {
  Multer: any;
  AddMetadata(req: Request, res: Response): void;
  CancelMetadata(req: Request, res: Response): void;
  UploadRequest(req: Request, res: Response): void;
  UploadCancel(req: Request, res: Response): void;
  UploadFinish(req: Request, res: Response): void;
}

const tempDir = `${RootDirectory}/${Configuration.Uploads.TempDirectory}`;
const uploadDir = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/`;
const subfolders = [
  'model',
  'audio',
  'video',
  'image',
  'previews',
  'metadata_files',
];

ensureDir(tempDir);
ensureDir(uploadDir);
subfolders.forEach(folder => ensureDir(`${uploadDir}${folder}`));

const slug = (text: string) =>
  slugify(text, { remove: /[^\w\s$*_+~.()'"!\-:@/]/g });

const Upload: IUpload = {
  Multer: multer({
    dest: tempDir,
  }),
  AddMetadata: (req, res) => {
    const token = req.headers['semirandomtoken'];
    const metaDataKey = req.headers['metadatakey'];
    const tempPath = `${req['file'].path}`;
    let newPath = uploadDir;
    newPath += `${token}/`;
    newPath += `${metaDataKey}/`;
    // Filename gets a prefix of the metadata input field selected
    const filename = `${req.headers['prefix']}-${req['file'].originalname}`;
    newPath += filename;

    ensureDir(dirname(newPath))
      .then(() => move(tempPath, newPath))
      .then(_ => {
        const resEntity = {
          metadata_file: filename,
          metadata_entity: req.headers['metadatakey'],
          metadata_link: `entities/${token}/${metaDataKey}/${filename}`,
          metadata_format: `${extname(newPath)}`,
          metadata_size: `${statSync(newPath).size} bytes`,
        };
        res.status(200).send(resEntity);
      })
      .catch(err => {
        Logger.err(err);
        return res.status(500).send('Failed ensuring file directory');
      });
  },
  CancelMetadata: () => {
    // TODO: Either remove on it's own via req or delete with the rest of the upload cancel
  },
  UploadRequest: (req, res) => {
    // TODO: Checksum
    // TODO: Do this without headers?
    const tempPath = `${req['file'].destination}/${req['file'].filename}`;
    const relPath = req.headers['relpath'] as string | undefined;
    console.log(relPath);
    const folderOrFilePath =
      relPath && relPath.length > 0
        ? slug(relPath)
        : slug(req['file'].originalname);
    const destPath = join(
      uploadDir,
      `${req.headers['filetype']}`,
      `${req.headers['semirandomtoken']}/`,
      `${folderOrFilePath}`,
    );

    ensureDir(dirname(destPath))
      .then(() => move(tempPath, destPath))
      .then(() => res.status(200).end())
      .catch(err => {
        Logger.err(err);
        res.status(500).send('Upload req failed');
      });
  },
  // TODO: Deprecate and move to Cleaning service
  UploadCancel: (_, res) => {
    res.status(200).end();
  },
  UploadFinish: async (req, res) => {
    Logger.info(req.body);
    const Token = req.body.uuid;
    const Type = req.body.type;
    if (!Token || !Type) {
      Logger.err(`Upload cancel req failed. Token: ${Token}, Type: ${Type}`);
      return res.status(400).send('Missing type or token');
    }
    const path = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/${Type}/${Token}`;

    return pathExists(path)
      .catch(err => {
        Logger.err(err);
        res.status(500).send('Filepath not found');
      })
      .then(async () => {
        const foundFiles = klawSync(path).filter(item => item.stats.isFile());

        // TODO: Add more filters
        const filter: string[] = [];
        switch (Type) {
          case 'entity':
            filter.push('.obj', '.babylon', '.gltf', '.stl');
            break;
          default:
        }

        const filteredFiles = foundFiles.filter(file => {
          return filter.indexOf(extname(file.path)) !== -1;
        });

        const ResponseFile = {
          file_name: '',
          file_link: '',
          file_size: 0,
          file_format: '',
        };

        const prepareResponseFiles = (
          fileArray: ReadonlyArray<klawSync.Item>,
        ) => {
          return fileArray
            .map(file => {
              const result = { ...ResponseFile };
              result.file_format = extname(file.path);
              let _relativePath = file.path.replace(RootDirectory, '');
              _relativePath =
                _relativePath.charAt(0) === '/'
                  ? _relativePath.substr(1)
                  : _relativePath;

              result.file_link = `${_relativePath}`;
              result.file_name = `${basename(file.path)}`;
              result.file_size = parseInt(`${file.stats.size}`, 10);
              return result;
            })
            .sort((a, b) => a.file_size - b.file_size);
        };

        const ResponseFiles = prepareResponseFiles(
          filteredFiles.length > 0 ? filteredFiles : foundFiles,
        );
        Logger.info(ResponseFiles);
        res.status(200).send(ResponseFiles);
      })
      .catch(err => {
        Logger.err(err);
        res.status(500).send('Unknown error');
      });
  },
};

export { Upload };
