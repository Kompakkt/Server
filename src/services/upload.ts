import { ensureDir, move, pathExists, readFile, removeSync, statSync, writeFile } from 'fs-extra';
import * as klawSync from 'klaw-sync';
import * as multer from 'multer';
import { basename, dirname, extname, join } from 'path';
import slugify from 'slugify';

import { RootDirectory } from '../environment';

import { Configuration } from './configuration';
import { Logger } from './logger';

const Upload = {
  Multer: multer({
    dest: `${RootDirectory}/${Configuration.Uploads.TempDirectory}`,
  }),
  AddMetadata: (request, response) => {
    const token = request.headers['semirandomtoken'];
    const metaDataKey = request.headers['metadatakey'];
    const tempPath = `${request['file'].path}`;
    let newPath = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/`;
    newPath += `${token}/`;
    newPath += `${metaDataKey}/`;
    // Filename gets a prefix of the metadata input field selected
    const filename = `${request.headers['prefix']}-${request['file'].originalname}`;
    newPath += filename;

    ensureDir(dirname(newPath))
      .then(() => move(tempPath, newPath))
      .then(_ => {
        const responseObject = {
          metadata_file: filename,
          metadata_object: request.headers['metadatakey'],
          metadata_link: `models/${token}/${metaDataKey}/${filename}`,
          metadata_format: `${extname(newPath)}`,
          metadata_size: `${statSync(newPath).size} bytes`,
        };
        response.send(JSON.stringify(responseObject));
      })
      .catch(err => {
        Logger.err(err);
        return response
          .send({ status: 'error', message: 'Failed ensuring file directory' });
      });
  },
  CancelMetadata: () => {
    // TODO: Either remove on it's own via request or delete with the rest of the upload cancel
  },
  UploadRequest: (request, response) => {
    // TODO: Checksum
    // TODO: Do this without headers?
    const tempPath = `${request['file'].destination}/${request['file'].filename}`;
    const folderOrFilePath = (request.headers['relpath'].length > 0)
      ? request.headers['relpath']
      : slugify(request['file'].originalname);
    const destPath =
      join(
        `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/`,
        `${request.headers['filetype']}`,
        `${request.headers['semirandomtoken']}/`,
        `${folderOrFilePath}`);

    ensureDir(dirname(destPath))
      .then(() => move(tempPath, destPath))
      .then(() => response.send({ status: 'ok', message: 'Upload success' }))
      .catch(err => {
        Logger.err(err);
        response.send({ status: 'error', message: 'Upload request failed' });
      });
  },
  UploadCancel: (request, response) => {
    const Token = request.body.uuid;
    const Type = request.body.type;
    if (!Token || !Type) {
      Logger.err(`Upload cancel request failed. Token: ${Token}, Type: ${Type}`);
      response.send({ status: 'error' });
      return;
    }
    const path = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/${Type}/${Token}`;

    Logger.info(`Cancelling upload request ${Token}`);

    pathExists(path)
      .then(() => removeSync(path))
      .then(() => response.send({ status: 'ok', message: 'Successfully cancelled upload' }))
      .catch(err => {
        Logger.err(err);
        response.send({ status: 'error', message: 'Failed cancelling upload' });
      });
  },
  UploadFinish: async (request, response) => {
    Logger.info(request.body);
    const Token = request.body.uuid;
    const Type = request.body.type;
    if (!Token || !Type) {
      Logger.err(`Upload cancel request failed. Token: ${Token}, Type: ${Type}`);
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
        const foundFiles = klawSync(path);
        /* Babylon seems to have trouble displaying
         * OBJs with Specular materials, so we fix this*/

        await Promise.all(foundFiles
          .filter(file => extname(file.path)
            .includes('.mtl'))
          .map(item =>
            readFile(item.path)
              .then(content => {
                content.toString()
                  .split('\n')
                  .map(line => {
                    if (!line.includes('Ks')) return line;
                    return 'Ks 0.000000 0.000000 0.000000';
                  })
                  .join('\n');
                return content;
              })
              .then(content => {
                writeFile(item.path, content);
              })
              .catch(err => Logger.err(err))));

        // TODO: Add more filters
        const filter: string[] = [];
        switch (Type) {
          case 'model': filter.push('.obj', '.babylon', '.gltf', '.stl'); break;
          default:
        }

        const filteredFiles = foundFiles.filter(file => {
          return filter.indexOf(extname(file.path)) !== -1;
        }); // .map(file => file.path.substr(file.path.indexOf('models/')));

        const ResponseFile = {
          file_name: '',
          file_link: '',
          file_size: 0,
          file_format: '',
        };

        const prepareResponseFiles = (fileArray: ReadonlyArray<klawSync.Item>) => {
          return fileArray.map(file => {
            const result = { ...ResponseFile };
            result.file_format = extname(file.path);
            let _relativePath = file.path.replace(RootDirectory, '');
            _relativePath = (_relativePath.charAt(0) === '/')
              ? _relativePath.substr(1) : _relativePath;

            result.file_link = `${_relativePath}`;
            result.file_name = `${basename(file.path)}`;
            result.file_size = parseInt(`${file.stats.size}`, 10);
            return result;
          })
            .sort((a, b) => a.file_size - b.file_size);
        };

        const ResponseFiles = prepareResponseFiles((filteredFiles.length > 0)
          ? filteredFiles : foundFiles);
        Logger.info(ResponseFiles);
        response.send({ status: 'ok', files: ResponseFiles });
      });
  },
};

export { Upload };
