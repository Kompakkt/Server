import { Configuration } from './configuration';
import { RootDirectory } from '../environment';
import { Logger } from './logger';

import { ensureDirSync, moveSync, pathExistsSync, removeSync, move, statSync } from 'fs-extra';
import { dirname, extname, basename } from 'path';
import * as klawSync from 'klaw-sync';
import * as multer from 'multer';

const Upload = {
  Multer: multer({
    dest: `${RootDirectory}/${Configuration.Uploads.TempDirectory}`,
    onFileUploadStart: function(file) {
      Logger.info(file.originalname + ' is starting ...');
    },
    onFileUploadComplete: function(file) {
      Logger.info(file.fieldname + ' uploaded to  ' + file.path);
    }
  }),
  AddMetadata: (request, response) => {
    const tempPath = `${request['file'].path}`;
    let newPath = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/`;
    newPath += `${request.headers['semirandomtoken']}/`;
    newPath += `${request.headers['metadatakey']}/`;
    // Filename gets a prefix of the metadata input field selected
    const filename = `${request.headers['prefix']}-${request['file'].originalname}`;
    newPath += filename;

    ensureDirSync(dirname(newPath));
    move(tempPath, newPath).then(_ => {
      const responseObject = {
        metadata_file: filename,
        metadata_object: request.headers['metadatakey'],
        metadata_link: `models/${request.headers['semirandomtoken']}/${request.headers['metadatakey']}/${filename}`,
        metadata_format: `${extname(newPath)}`,
        metadata_size: `${statSync(newPath).size} bytes`
      };
      response.end(JSON.stringify(responseObject));
    }).catch(() => response.end(`File already exists`));
  },
  CancelMetadata: () => {
    // TODO: Either remove on it's own via request or delete with the rest of the upload cancel
  },
  UploadRequest: (request, response) => {
    // TODO: Checksum
    const tempPath = `${request['file'].destination}/${request['file'].filename}`;
    let newPath = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/`;
    newPath += `${request.headers['semirandomtoken']}/`;
    newPath += `${request.headers['relpath']}`;

    ensureDirSync(dirname(newPath));
    moveSync(tempPath, newPath);
    response.end('Uploaded');
  },
  UploadCancel: (request, response) => {
    const Token = request.body.uuid;
    const path = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/${Token}`;

    Logger.info(`Cancelling upload request ${Token}`);

    if (!pathExistsSync(path)) {
      response.json({ message: 'Path with this token does not exist' });
    } else {
      removeSync(path);
      response.json({ message: 'Successfully cancelled upload' });
    }
  },
  UploadFinish: async (request, response) => {
    Logger.info(request.body);
    const Token = request.body.uuid;
    const Type = request.body.type;
    const path = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/${Token}`;

    if (!pathExistsSync(path)) {
      response.json([]).end('Upload not finished');
    } else {
      const foundFiles = klawSync(path);

      // TODO: remove nested top directories until a file is top-level
      // TODO: Add more type cases for image, audio, video
      if (Type === 'model') {
        const modelExt = [
          '.ply',
          '.obj',
          '.babylon'
        ];

        const modelFiles = await foundFiles.filter(file => {
          return modelExt.indexOf(extname(file.path)) !== -1;
        }); // .map(file => file.path.substr(file.path.indexOf('models/')));

        const ResponseFile = {
          file_name: '',
          file_link: '',
          file_size: 0,
          file_format: ''
        };
        if (modelFiles.length > 0) {
          const ResponseFiles = modelFiles.map(modelFile => {
            const result = { ...ResponseFile };
            result.file_format = extname(modelFile.path);
            let _relativePath = modelFile.path.replace(RootDirectory, '');
            _relativePath = (_relativePath.charAt(0) === '/') ? _relativePath.substr(1) : _relativePath;
            result.file_link = `${_relativePath}`;
            result.file_name = `${basename(modelFile.path)}`;
            result.file_size = parseInt(`${modelFile.stats.size}`, 10);
            return result;
          }).sort((a, b) => a.file_size - b.file_size);

          Logger.info(ResponseFiles);

          response.json(ResponseFiles);
        } else {
          response.json(foundFiles);
        }
      } else {
        const resultFiles = await foundFiles.map(file => file.path.substr(file.path.indexOf('uploads/')));
        response.json(resultFiles);
      }
      response.end('Done!');
    }
  }
};

export { Upload };
