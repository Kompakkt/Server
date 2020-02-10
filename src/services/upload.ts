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
  AddMetadata(request: Request, response: Response): void;
  CancelMetadata(request: Request, response: Response): void;
  UploadRequest(request: Request, response: Response): void;
  UploadCancel(request: Request, response: Response): void;
  UploadFinish(request: Request, response: Response): void;
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
  AddMetadata: (request, response) => {
    const token = request.headers['semirandomtoken'];
    const metaDataKey = request.headers['metadatakey'];
    const tempPath = `${request['file'].path}`;
    let newPath = uploadDir;
    newPath += `${token}/`;
    newPath += `${metaDataKey}/`;
    // Filename gets a prefix of the metadata input field selected
    const filename = `${request.headers['prefix']}-${request['file'].originalname}`;
    newPath += filename;

    ensureDir(dirname(newPath))
      .then(() => move(tempPath, newPath))
      .then(_ => {
        const responseEntity = {
          metadata_file: filename,
          metadata_entity: request.headers['metadatakey'],
          metadata_link: `entities/${token}/${metaDataKey}/${filename}`,
          metadata_format: `${extname(newPath)}`,
          metadata_size: `${statSync(newPath).size} bytes`,
        };
        response.send(JSON.stringify(responseEntity));
      })
      .catch(err => {
        Logger.err(err);
        return response.send({
          status: 'error',
          message: 'Failed ensuring file directory',
        });
      });
  },
  CancelMetadata: () => {
    // TODO: Either remove on it's own via request or delete with the rest of the upload cancel
  },
  UploadRequest: (request, response) => {
    // TODO: Checksum
    // TODO: Do this without headers?
    const tempPath = `${request['file'].destination}/${request['file'].filename}`;
    const relPath = request.headers['relpath'] as string | undefined;
    console.log(relPath);
    const folderOrFilePath =
      relPath && relPath.length > 0
        ? slug(relPath)
        : slug(request['file'].originalname);
    const destPath = join(
      uploadDir,
      `${request.headers['filetype']}`,
      `${request.headers['semirandomtoken']}/`,
      `${folderOrFilePath}`,
    );

    ensureDir(dirname(destPath))
      .then(() => move(tempPath, destPath))
      .then(() => response.send({ status: 'ok', message: 'Upload success' }))
      .catch(err => {
        Logger.err(err);
        response.send({ status: 'error', message: 'Upload request failed' });
      });
  },
  // TODO: Deprecate and move to Cleaning service
  UploadCancel: (_, response) => {
    response.send({
      status: 'ok',
      message: 'Successfully cancelled upload',
    });
  },
  UploadFinish: async (request, response) => {
    Logger.info(request.body);
    const Token = request.body.uuid;
    const Type = request.body.type;
    if (!Token || !Type) {
      Logger.err(
        `Upload cancel request failed. Token: ${Token}, Type: ${Type}`,
      );
      response.send({ status: 'error', message: 'Missing type or token' });
      return;
    }
    const path = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/${Type}/${Token}`;

    pathExists(path)
      .catch(err => {
        Logger.err(err);
        response.send({ status: 'error', message: 'Filepath not found' });
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
        response.send({ status: 'ok', files: ResponseFiles });
      })
      .catch(err => {
        Logger.err(err);
        response.send({ status: 'error', message: 'Unknown error' });
      });
  },
};

export { Upload };
