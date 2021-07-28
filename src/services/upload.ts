import { Request, Response } from 'express';
import { ensureDir, move, pathExists, unlink } from 'fs-extra';
import klawSync from 'klaw-sync';
import multer from 'multer';
import { basename, dirname, extname, join } from 'path';
import slugify from 'slugify';

import { RootDirectory } from '../environment';

import { Configuration } from './configuration';
import { Logger } from './logger';

const { TempDirectory, UploadDirectory } = Configuration.Uploads;

// Helper function
const slug = (text: string) => slugify(text, { remove: /[^\w\s$*_+~.()'"!\-:@/]/g });

// Prepare folder structure
const tempDir = `${RootDirectory}/${TempDirectory}`;
const uploadDir = `${RootDirectory}/${UploadDirectory}/`;
const subfolders = ['model', 'audio', 'video', 'image', 'previews', 'metadata_files'];

ensureDir(tempDir);
ensureDir(uploadDir);
subfolders.forEach(folder => ensureDir(`${uploadDir}${folder}`));

// Multer instance for file uploads
const Multer = multer({
  dest: tempDir,
});

const fileUploadRequestHandler = Multer.single('file');

// Request methods
const cancel = (req: Request, res: Response) => {
  const { uuid: token, type } = req.body as any;
  const destPath = join(uploadDir, `${type}`, `${token}/`);
  unlink(destPath)
    .then(() => {
      Logger.log('Removed folder', token, type);
      res.status(200).send({ status: 'OK' });
    })
    .catch(err => {
      Logger.log('Failed removing folder', token, type, err);
      res.status(500).send({ status: 'error', message: 'Failed deleting folder' });
    });
};

const send = (req: Request, res: Response) => {
  const { file } = req as any;
  const { type, token, relativePath } = req.body as any;
  // TODO: Checksum
  const tempPath = `${file.destination}/${file.filename}`;
  const relPath = relativePath || file.originalname;
  const folderOrFilePath = slug(relPath);
  const destPath = join(uploadDir, `${type}`, `${token}/`, `${folderOrFilePath}`);

  ensureDir(dirname(destPath))
    .then(() => move(tempPath, destPath))
    .then(() => res.status(200).send({ status: 'OK' }))
    .catch(err => {
      Logger.err(err);
      res.status(500).send({ status: 'error', message: 'Upload req failed' });
    });
};

const finish = async (req: Request, res: Response) => {
  Logger.info(req.body);
  const Token = req.body.uuid;
  const Type = req.body.type;
  if (!Token || !Type) {
    Logger.err(`Upload cancel req failed. Token: ${Token}, Type: ${Type}`);
    return res.status(400).send({ status: 'error', message: 'Missing type or token' });
  }
  const path = `${RootDirectory}/${UploadDirectory}/${Type}/${Token}`;

  return pathExists(path)
    .catch(err => {
      Logger.err(err);
      res.status(500).send({ status: 'error', message: 'Filepath not found' });
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

      const responseFile = {
        file_name: '',
        file_link: '',
        file_size: 0,
        file_format: '',
      };

      const prepareResponseFiles = (fileArray: ReadonlyArray<klawSync.Item>) => {
        return fileArray
          .map(file => {
            const result = { ...responseFile };
            result.file_format = extname(file.path);
            let _relativePath = file.path.replace(RootDirectory, '');
            _relativePath =
              _relativePath.charAt(0) === '/' ? _relativePath.substr(1) : _relativePath;

            result.file_link = `${_relativePath}`;
            result.file_name = `${basename(file.path)}`;
            result.file_size = parseInt(`${file.stats.size}`, 10);
            return result;
          })
          .sort((a, b) => a.file_size - b.file_size);
      };

      const responseFiles = prepareResponseFiles(
        filteredFiles.length > 0 ? filteredFiles : foundFiles,
      );
      Logger.info(responseFiles);
      res.status(200).send({ status: 'OK', files: responseFiles });
    })
    .catch(err => {
      Logger.err(err);
      res.status(500).send({ status: 'error', message: 'Unknown error' });
    });
};

// Exports
const Upload = {
  fileUploadRequestHandler,
  send,
  cancel,
  finish,
};

export { Upload };
export default Upload;
