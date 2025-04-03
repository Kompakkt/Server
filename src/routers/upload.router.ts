import { readdir, rmdir, stat, symlink, realpath, exists, watch } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { Elysia, t } from 'elysia';
import slugify from 'slugify';
import type { IFile } from 'src/common';
import { Configuration } from 'src/configuration';
import { RootDirectory } from 'src/environment';
import { err, info, log } from 'src/logger';
import { md5Cache } from 'src/redis';
import configServer from 'src/server.config';
import { ensure } from 'src/util/file-related-helpers';
import { authService } from './handlers/auth.service';
import { compressFile, COMPRESSION_ENCODINGS } from 'src/util/compress-file';
import { fetch } from 'bun';
import { unique } from 'src/util/array-helpers';
import type { Dirent } from 'node:fs';
import { typedObjectEntries } from 'src/util/typed-object-entries';
import { waitUntilFileExists } from 'src/util/wait-until-file-exists';

declare global {
  // biome-ignore lint: Any is expected here
  interface ReadableStream<R = any> {
    [Symbol.asyncIterator](): AsyncIterableIterator<R>;
  }
}

ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
  const reader = this.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
};

type KompressorStateResponse = {
  progress: number;
  finished: boolean;
  state: 'DONE' | 'PROCESSING' | 'ERROR' | 'QUEUED';
  message: string;
};

type KompressorQueueResponse = {
  status: 'OK' | 'ERROR';
  message: string;
  id: string;
};

// Helper functions
const slug = (text: string) => slugify(text, { remove: /[^\w\s$*_+~.()'"!\-:@/]/g });

const calculateMD5 = (readableStream: ReadableStream<Uint8Array>) =>
  new Promise<string>(async resolve => {
    const hash = new Bun.CryptoHasher('md5');
    for await (const chunk of readableStream) {
      hash.update(chunk);
    }
    resolve(hash.digest('hex'));
  });

const writeStreamToDisk = async (readableStream: ReadableStream<Uint8Array>, destPath: string) => {
  try {
    await ensure(destPath);
    const fileWriter = Bun.file(destPath).writer();
    for await (const chunk of readableStream) {
      fileWriter.write(chunk);
    }
    fileWriter.end();
  } catch (e) {
    err(e);
    return false;
  }
  return true;
};

const fullPathFromDirent = (dirent: Dirent) => dirent.parentPath + '/' + dirent.name;

const getUploadedFiles = async ({
  path,
  type,
}: {
  path: string;
  type: string;
}): Promise<{ files: string[]; ids: string[] }> => {
  const entries = await readdir(path, {
    recursive: true,
    withFileTypes: true,
  }).catch(e => {
    err(e);
    return undefined;
  });
  if (!entries) return { files: [], ids: [] };

  const filesPromise = entries
    .filter(dirent => dirent.isFile() || dirent.isSymbolicLink())
    .filter(
      file =>
        !file.name.endsWith('.zst') && !file.name.endsWith('.br') && !file.name.endsWith('.gz'),
    )
    .map(dirent => fullPathFromDirent(dirent))
    .map(async file => await realpath(file));

  const files = await Promise.all(filesPromise);

  const filter = (() => {
    switch (type) {
      case 'entity':
      case 'model':
        return ['.obj', '.babylon', '.gltf', '.glb', '.stl'];
      case 'cloud':
        return ['.las', '.laz', '.json'];
      default:
        return [];
    }
  })();

  const ignoredSubdirectories = ['ept-data', 'ept-hierarchy', 'ept-sources'];

  const filteredFiles = files
    .filter(file => !ignoredSubdirectories.some(dir => file.includes(dir)))
    .filter(file =>
      filter.length > 0 ? filter.some(ext => file.toLowerCase().endsWith(ext)) : true,
    );

  const ids = filteredFiles.map(
    file => file.replace(`${RootDirectory}/${UploadDirectory}/${type}/`, '').split('/').at(0)!,
  );

  return { files: filteredFiles, ids: unique(ids) };
};

const getProcessedFiles = async (paths: string[], mediaType: string, shouldWait = false) => {
  console.log('getProcessedFiles', { paths, mediaType });
  const processedFiles = new Set<string>();

  for (const path of paths) {
    if (mediaType === 'cloud') {
      const eptJsonPath = `${path}/out/ept.json`;
      const eptJsonExists = await waitUntilFileExists(eptJsonPath, shouldWait ? 10_000 : 0);

      console.log({ eptJsonPath, eptJsonExists });

      if (eptJsonExists) {
        processedFiles.add(eptJsonPath);
      }
    }

    if (mediaType === 'model' || mediaType === 'entity') {
      const glbGlob = new Bun.Glob(`*.compressed.glb`);
      const globResult = await Array.fromAsync(glbGlob.scan({ cwd: path }));
      for (const file of globResult) {
        processedFiles.add(file);
      }
    }
  }

  return Array.from(processedFiles);
};

const PRECOMPRESSED_TYPES = ['.glb', '.laz', '.zip'];

// Prepare folder structure
const { UploadDirectory } = Configuration.Uploads;
const uploadDir = `${RootDirectory}/${UploadDirectory}/`;

const uploadRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .get(
    'uploads/*',
    async ({ params: { '*': path }, set, headers, error }) => {
      const uploadDir = join(RootDirectory, Configuration.Uploads.UploadDirectory);

      const requestedPath = path.split('/uploads').at(-1)!;
      const decodedPath = requestedPath
        .split('/')
        .map(part => decodeURIComponent(part))
        .filter(Boolean);

      const filePath = join(uploadDir, ...decodedPath);
      // Security check - Ensure the file path is within the upload directory
      if (!filePath.startsWith(uploadDir)) {
        return error(403, 'Forbidden');
      }
      // Security check - Ensure the file exists
      if (!(await Bun.file(filePath).exists())) {
        return error(404, 'Not Found');
      }

      const realPath = await realpath(filePath);
      const realFile = Bun.file(realPath);

      const isCompressed = PRECOMPRESSED_TYPES.some(type => realPath.toLowerCase().endsWith(type));
      info({
        isCompressed,
        realPath,
        size: realFile.size,
        encodings: headers['accept-encoding'],
      });
      if (realFile.size <= 65_536 || isCompressed) {
        return realFile;
      }

      const supportedEncodings = headers['accept-encoding']?.split(',').map(e => e.trim()) ?? [];

      for (const [encoding, extension] of typedObjectEntries(COMPRESSION_ENCODINGS)) {
        if (!supportedEncodings.includes(encoding)) continue;
        const compressedFile = () => Bun.file(`${realPath}${extension}`);
        if (!(await compressedFile().exists())) {
          const result = await compressFile(realPath, encoding).catch(error => {
            err(`Failed compressing new file ${realPath}`, error);
            return false;
          });
          if (!result) break;
        }
        set.headers['content-encoding'] = encoding;
        set.headers['content-type'] = realFile.type;
        return compressedFile();
      }

      return realFile;
    },
    {
      params: t.Object({
        '*': t.String(),
      }),
    },
  )
  .group('/upload', { isLoggedIn: true }, group =>
    group
      .post(
        '/file',
        async ({ error, userdata, body: { file, checksum, token, type, relativePath } }) => {
          const serverChecksum = await calculateMD5(file.stream());
          const destPath = join(
            uploadDir,
            `${type}`,
            `${token}/`,
            `${slug(relativePath)}`,
            file.name,
          );

          const existing = await md5Cache.get<string>(serverChecksum);
          if (existing) {
            // Create symlink
            info(
              `File already exists, creating symlink from ${join(uploadDir, existing)} to ${destPath}`,
            );
            await ensure(destPath);
            await symlink(join(uploadDir, existing), destPath).catch(e => {
              err(e);
            });

            return {
              status: 'OK',
              clientChecksum: checksum,
              serverChecksum,
              usingExisting: true,
            };
          }

          const success = await writeStreamToDisk(file.stream(), destPath);

          return success
            ? {
                status: 'OK',
                clientChecksum: checksum,
                serverChecksum,
                usingExisting: false,
              }
            : error('Internal Server Error');
        },
        {
          body: t.Object({
            file: t.File({
              maxSize: '4096m',
            }),
            relativePath: t.String(),
            token: t.String(),
            type: t.String(),
            checksum: t.String(),
          }),
        },
      )
      .post(
        '/process/start',
        async ({ error, body: { uuid, type } }) => {
          const { Enabled, Hostname, Port } = Configuration.Kompressor;
          if (!Enabled) {
            return {
              status: 'OK',
              uuid,
              type,
              requiresProcessing: false,
            };
          }

          const path = `${RootDirectory}/${UploadDirectory}/${type}/${uuid}`;
          const { files, ids } = await getUploadedFiles({ type, path });
          log(`Processing started for ${type}/${uuid}`, files);
          if (files.length === 0) return error(404, 'No files found');
          if (ids.length <= 0) return error(404, 'No files found');

          const hasBeenProcessed = await getProcessedFiles(
            ids.map(id => `${RootDirectory}/${UploadDirectory}/${type}/${id}`),
            type,
          ).then(result => result.length > 0);

          const hasObjFiles = files.some(file => file.toLowerCase().endsWith('.obj'));
          const hasLasFiles = files.some(
            file => file.toLowerCase().endsWith('.las') || file.toLowerCase().endsWith('.laz'),
          );

          if ((!hasObjFiles && !hasLasFiles) || hasBeenProcessed) {
            return {
              status: 'OK',
              uuid,
              type,
              requiresProcessing: false,
            };
          }

          const queueResponse = await fetch(
            `http://${Hostname}:${Port}/process/${type}/${ids.at(0)!}`,
          ).then(response => response.json() as Promise<KompressorQueueResponse>);

          return {
            status: queueResponse.status,
            uuid,
            type,
            requiresProcessing: true,
          };
        },
        {
          body: t.Object({
            uuid: t.String(),
            type: t.String(),
          }),
        },
      )
      .post(
        '/process/info',
        async ({ error, body: { uuid, type } }) => {
          const { Enabled, Hostname, Port } = Configuration.Kompressor;
          if (!Enabled) {
            return {
              status: 'OK',
              uuid,
              type,
              requiresProcessing: false,
            };
          }

          const path = `${RootDirectory}/${UploadDirectory}/${type}/${uuid}`;
          const { ids } = await getUploadedFiles({ type, path });

          const response = await fetch(`http://${Hostname}:${Port}/progress/${ids.at(0)!}`);
          const info = (await response.json()) as KompressorStateResponse;
          return {
            status: 'OK',
            uuid,
            type,
            progress: info.progress,
          };
        },
        {
          body: t.Object({
            uuid: t.String(),
            type: t.String(),
          }),
        },
      )
      .post(
        '/finish',
        async ({ error, body: { uuid, type } }) => {
          const path = `${RootDirectory}/${UploadDirectory}/${type}/${uuid}`;
          const { files, ids } = await getUploadedFiles({ type, path });
          if (files.length === 0) return error(404, 'No files found');

          const processedFiles = await getProcessedFiles(
            ids.map(id => `${RootDirectory}/${UploadDirectory}/${type}/${id}`),
            type,
            true,
          );

          console.log(processedFiles, files);

          const finalFiles: IFile[] = (processedFiles.length > 0 ? processedFiles : files).map(
            file => {
              let relPath = dirname(file).replace(RootDirectory, '');
              relPath = relPath.charAt(0) === '/' ? relPath.slice(1) : relPath;

              return {
                file_name: basename(file),
                file_link: join(relPath, basename(file)),
                file_size: Bun.file(file).size,
                file_format: extname(file),
              } satisfies IFile;
            },
          );

          return { status: 'OK', files: finalFiles };
        },
        {
          body: t.Object({
            uuid: t.String(),
            type: t.String(),
          }),
        },
      )
      .post(
        '/cancel',
        async ({ error, body: { uuid, type } }) => {
          const path = `${RootDirectory}/${UploadDirectory}/${type}/${uuid}`;
          const pathStat = await stat(path).catch(e => {
            err(e);
            return undefined;
          });

          if (!pathStat || !pathStat.isDirectory()) return error(404);

          await rmdir(path, { recursive: true }).catch(e => {
            err(e);
          });

          return { status: 'OK' };
        },
        {
          body: t.Object({
            uuid: t.String(),
            type: t.String(),
          }),
        },
      ),
  );

export default uploadRouter;
