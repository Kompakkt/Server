import { Request, Response } from 'express';
import { ensureDir, move, pathExists } from 'fs-extra';
import klawSync from 'klaw-sync';
import multer from 'multer';
import { basename, dirname, extname, join } from 'path';
import slugify from 'slugify';

import { RootDirectory } from '../environment';

import { Configuration } from './configuration';
import { Logger } from './logger';

interface IUpload {
  Multer: any;
  UploadRequest(req: Request, res: Response): void;
  UploadFinish(req: Request, res: Response): void;
}

const { TempDirectory, UploadDirectory } = Configuration.Uploads;

const tempDir = `${RootDirectory}/${TempDirectory}`;
const uploadDir = `${RootDirectory}/${UploadDirectory}/`;
const subfolders = ['model', 'audio', 'video', 'image', 'previews', 'metadata_files'];

ensureDir(tempDir);
ensureDir(uploadDir);
subfolders.forEach(folder => ensureDir(`${uploadDir}${folder}`));

const slug = (text: string) => slugify(text, { remove: /[^\w\s$*_+~.()'"!\-:@/]/g });

const Upload: IUpload = {
  Multer: multer({
    dest: tempDir,
  }),
  UploadRequest: (req, res) => {
    const { file } = req as any;
    const { type, token, relativePath } = req.body as any;
    // TODO: Checksum
    const tempPath = `${file.destination}/${file.filename}`;
    const relPath = relativePath || file.originalname;
    const folderOrFilePath = slug(relPath);
    const destPath = join(uploadDir, `${type}`, `${token}/`, `${folderOrFilePath}`);

    ensureDir(dirname(destPath))
      .then(() => move(tempPath, destPath))
      .then(() => res.status(200).end())
      .catch(err => {
        Logger.err(err);
        res.status(500).send('Upload req failed');
      });
  },
  UploadFinish: async (req, res) => {
    Logger.info(req.body);
    const Token = req.body.uuid;
    const Type = req.body.type;
    if (!Token || !Type) {
      Logger.err(`Upload cancel req failed. Token: ${Token}, Type: ${Type}`);
      return res.status(400).send('Missing type or token');
    }
    const path = `${RootDirectory}/${UploadDirectory}/${Type}/${Token}`;

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

        const prepareResponseFiles = (fileArray: ReadonlyArray<klawSync.Item>) => {
          return fileArray
            .map(file => {
              const result = { ...ResponseFile };
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
