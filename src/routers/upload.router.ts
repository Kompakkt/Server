import archiver from 'archiver';
import { fetch } from 'bun';
import { Elysia, t } from 'elysia';
import { ObjectId } from 'mongodb';
import type { Dirent } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { exists, readdir, realpath, rm, rmdir, stat, symlink } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import slugify from 'slugify';
import type { IEntity, IFile } from 'src/common';
import { Configuration } from 'src/configuration';
import { RootDirectory } from 'src/environment';
import { err, info, log, warn } from 'src/logger';
import { entityCollection } from 'src/mongo';
import configServer from 'src/server.config';
import { unique } from 'src/util/array-helpers';
import { ensure } from 'src/util/file-related-helpers';
import { typedObjectEntries } from 'src/util/typed-object-entries';
import { waitUntilFileExists } from 'src/util/wait-until-file-exists';
import { authService } from './handlers/auth.service';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { RouterTags } from './tags';
import { parseHttpRangeHeaders } from 'src/util/parse-http-range-headers';

// TODO: Do we still need this polyfill in Bun?
declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/naming-convention
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

const calculateMD5 = (readableStream: ReadableStream<Uint8Array>): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const hash = new Bun.CryptoHasher('md5');

    (async () => {
      try {
        for await (const chunk of readableStream) {
          hash.update(chunk);
        }
        resolve(hash.digest('hex'));
      } catch (error) {
        reject(error);
      }
    })();
  });
};

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
      case 'splat':
        return ['.splat', '.spz', '.spx', '.ply'];
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

/**
 * Kompressor will either store the processed file in the same directory, or in an "out" subdirectory.
 * This function scans both locations and returns a combined list.
 */
const globKompressorResults = async (glob: Bun.Glob, path: string) => {
  const globResult = await Array.fromAsync(glob.scan({ cwd: path })).catch(() => []);
  const globResultWithOutDir = await Array.fromAsync(glob.scan({ cwd: join(path, 'out') }))
    .catch(() => [])
    .then(arr => arr.map(file => join('out', file)));
  return [...globResult, ...globResultWithOutDir];
};

const GLOBS_BY_MEDIA_TYPE: Record<string, Bun.Glob | undefined> = {
  cloud: new Bun.Glob('*.copc.laz'),
  model: new Bun.Glob('*.compressed.glb'),
  splat: new Bun.Glob('*.spz'),
};

const getProcessedFiles = async (paths: string[], mediaType: string) => {
  log('getProcessedFiles', { paths, mediaType });
  const processedFiles = new Set<string>();

  if (mediaType === 'entity') mediaType = 'model';
  const glob = GLOBS_BY_MEDIA_TYPE[mediaType];
  if (!glob) return [];

  for (const path of paths) {
    const globResult = await globKompressorResults(glob, path);
    for (const file of globResult) processedFiles.add(file);
  }

  return Array.from(processedFiles);
};

enum DownloadType {
  'raw' = 'raw',
  'processed' = 'processed',
}
const getDownloadOptions = async (entity: ServerDocument<IEntity>) => {
  const dirnames = Array.from(new Set(entity.files.map(file => dirname(file.file_link))));
  const uniquePaths = new Set<string>();
  const rawFiles = new Set<string>();

  if (dirnames.every(d => d.includes('/out'))) {
    const dirnamesWithoutOut = Array.from(new Set(dirnames.map(d => d.split('/out').at(0)!)));
    dirnames.push(...dirnamesWithoutOut);
  }

  for (const dir of dirnames) {
    const entries = await readdir(join(RootDirectory, dir), {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        continue;
      }
      const path = entry.isSymbolicLink()
        ? await realpath(join(entry.parentPath, entry.name))
        : join(entry.parentPath, entry.name);

      uniquePaths.add(dirname(path));

      if (
        path.endsWith('.compressed.glb') ||
        path.endsWith('_processed.zip') ||
        path.endsWith('_raw.zip') ||
        path.endsWith('_log.txt') ||
        path.includes('/out')
      ) {
        continue;
      }

      rawFiles.add(path);
    }
  }

  const processedFiles = await Promise.all(
    Array.from(uniquePaths).map(async path => {
      const processed = await getProcessedFiles([path], entity.mediaType);
      return processed.map(file => join(path, file));
    }),
  ).then(arrs => arrs.flat());

  const rawFilesArr = Array.from(rawFiles).map(file => file.replace(RootDirectory, ''));
  const processedFilesArr = processedFiles.map(file => file.replace(RootDirectory, ''));

  // Find the most likely working directory for zipping.
  // There should not be more than one directory anyways, so maybe this is not needed.
  const getCwd = (arr: string[]) => {
    const possibleCwds = arr
      .map(file => join(RootDirectory, file))
      .map(file => {
        const index = file.split('/').findIndex(p => ObjectId.isValid(p));
        return file
          .split('/')
          .slice(0, index + 1)
          .join('/');
      });
    const counts = possibleCwds.reduce(
      (acc, cwd) => {
        acc[cwd] = (acc[cwd] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const maxCount = Math.max(...Object.values(counts));
    return Object.keys(counts).find(cwd => counts[cwd] === maxCount);
  };

  const rawCwd = getCwd(rawFilesArr);
  const processedCwd = getCwd(processedFilesArr);

  return {
    mediaType: entity.mediaType,
    rawFiles: rawFilesArr,
    uniquePaths: Array.from(uniquePaths).map(path => path.replace(RootDirectory, '')),
    processedFiles: processedFilesArr,
    hasCompressedFiles: processedFiles.length > 0,
    cwds: {
      raw: rawCwd,
      processed: processedCwd,
    } as Record<DownloadType, string>,
  };
};

const PRECOMPRESSED_TYPES = [
  '.glb',
  '.laz',
  '.zip',
  '.splat',
  '.spz',
  '.webp',
  '.jpg',
  '.jpeg',
  '.png',
  '.mtl',
];

// Prepare folder structure
const { UploadDirectory } = Configuration.Uploads;
const uploadDir = `${RootDirectory}/${UploadDirectory}/`;

const uploadRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .get(
    'uploads/*',
    async ({ request: { url }, set, headers, status }) => {
      const uploadDir = join(RootDirectory, Configuration.Uploads.UploadDirectory);

      const requestedPath = url.split('/uploads').at(-1)!;
      const decodedPath = requestedPath
        .split('/')
        .map(part => decodeURIComponent(part))
        .filter(Boolean);

      const filePath = join(uploadDir, ...decodedPath);
      // Security check - Ensure the file path is within the upload directory
      if (!filePath.startsWith(uploadDir)) {
        return status(403, 'Forbidden');
      }
      // Security check - Ensure the file exists
      if (!(await Bun.file(filePath).exists())) {
        return status(404, 'Not Found');
      }

      const realPath = await realpath(filePath);
      const realFile = Bun.file(realPath);

      const hasRangeHeader = !!headers['range'];
      if (realPath.endsWith('.copc.laz') && !hasRangeHeader) {
        // Force read headers for COPC files
        headers['range'] = 'bytes=0-549';
      }

      const isCompressed = PRECOMPRESSED_TYPES.some(type => realPath.toLowerCase().endsWith(type));
      info({
        isCompressed,
        realPath,
        size: realFile.size,
        encodings: headers['accept-encoding'],
      });

      const ranges = parseHttpRangeHeaders(headers['range'] ?? '', realFile.size);
      if (!ranges) return realFile;

      if (ranges.length === 1) {
        const range = ranges[0];
        return realFile.slice(range.start, range.end + 1);
      }

      return status(416, 'Range Not Satisfiable');
    },
    {
      headers: t.Object({
        'range': t.Optional(
          t.String({
            description: 'The Range header for partial content requests, e.g., "bytes=0-1023"',
          }),
        ),
        'accept-encoding': t.Optional(
          t.String({
            description: 'The Accept-Encoding header indicating supported compression methods',
          }),
        ),
      }),
      detail: {
        description: 'Serve uploaded files with on-the-fly compression',
        tags: [RouterTags.Upload],
      },
    },
  )
  .get(
    '/download/options/:entityId',
    async ({ status, params: { entityId } }) => {
      const entity = await entityCollection.findOne({ _id: new ObjectId(entityId) });
      if (!entity) return status(404, 'Entity not found');
      if (!entity.options?.allowDownload)
        return status(403, 'Download not allowed for this entity');

      const { cwds, rawFiles, processedFiles, hasCompressedFiles } =
        await getDownloadOptions(entity);
      const rawZipName = `${entityId}_${DownloadType.raw}.zip`;
      const processedZipName = `${entityId}_${DownloadType.processed}.zip`;

      const zipStats = await (async () => {
        const stats: Record<DownloadType, number> = {
          [DownloadType.raw]: 0,
          [DownloadType.processed]: 0,
        };
        if (cwds.raw) {
          const file = Bun.file(join(cwds.raw, rawZipName));
          if (await file.exists()) {
            stats[DownloadType.raw] = file.size;
          }
        }
        if (cwds.processed) {
          const file = Bun.file(join(cwds.processed, processedZipName));
          if (await file.exists()) {
            stats[DownloadType.processed] = file.size;
          }
        }
        return stats;
      })();

      const rawSize = rawFiles.reduce((acc, file) => {
        const filePath = join(RootDirectory, file);
        return acc + (Bun.file(filePath).size || 0);
      }, 0);

      let processedSize = processedFiles.reduce((acc, file) => {
        const filePath = join(RootDirectory, file);
        return acc + (Bun.file(filePath).size || 0);
      }, 0);

      const rawFileTypes = Array.from(new Set(rawFiles.map(file => extname(file).toLowerCase())));
      const processedFileTypes = Array.from(
        new Set(processedFiles.map(file => extname(file).toLowerCase())),
      );

      if (entity.mediaType === 'cloud') {
        processedFileTypes.splice(0, processedFileTypes.length);
        processedFileTypes.push('ept.json', '.laz');

        const duOutput = await Bun.$`du -bs .`.cwd(join(cwds.processed, 'out')).text();
        const sizeMatch = duOutput.match(/^(\d+)\s/);
        if (sizeMatch) {
          processedSize = parseInt(sizeMatch[1], 10);
        } else {
          warn(`Failed to parse du output: ${duOutput}`);
        }
      }

      return {
        zipStats,
        rawSize,
        processedSize,
        hasCompressedFiles,
        rawFileTypes,
        processedFileTypes,
      };
    },
    {
      params: t.Object({
        entityId: t.String(),
      }),
    },
  )
  .get(
    '/download/prepare/:entityId/:type',
    async function* ({ status, params: { entityId, type }, set }) {
      const entity = await entityCollection.findOne({ _id: new ObjectId(entityId) });
      if (!entity) return status(404, 'Entity not found');
      if (!entity.options?.allowDownload)
        return status(403, 'Download not allowed for this entity');

      const { rawFiles, processedFiles, cwds } = await getDownloadOptions(entity);

      const fileArr = type === DownloadType.raw ? rawFiles : processedFiles;
      const cwd = cwds[type];
      if (!cwd) {
        warn(`No valid working directory found for entity ${entityId} of type ${type}`);
        return status(404, 'No valid working directory found');
      }

      const zipName = `${entityId}_${type}.zip`;
      if (await Bun.file(join(cwd, zipName)).exists()) {
        yield '1\n';
        return;
      }

      // Create archive using archiver
      const zipPath = join(cwd, zipName);
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 5 } });

      // Track progress
      let lastSentProgress = 0;
      let lastSentTime = 0;
      const progressThreshold = 0.1; // 10% progress threshold
      const timeThreshold = 200; // 200 milliseconds time threshold

      // Create a promise that resolves when archiving is complete
      const archiveComplete = new Promise<void>((resolve, reject) => {
        output.on('close', resolve);
        archive.on('error', reject);
      });

      // Create an async generator for progress updates
      const progressUpdates: number[] = [];
      let archiveDone = false;

      archive.on('progress', progress => {
        const currentProgress =
          progress.entries.total > 0 ? progress.entries.processed / progress.entries.total : 0;
        const now = Date.now();

        const progressChanged = currentProgress - lastSentProgress >= progressThreshold;
        const timeElapsed = now - lastSentTime >= timeThreshold;

        if (progressChanged || timeElapsed) {
          lastSentProgress = currentProgress;
          lastSentTime = now;
          progressUpdates.push(currentProgress);
        }
      });

      archive.pipe(output);

      if (entity.mediaType === 'cloud' && type === 'processed') {
        // Special case: zip the whole /out directory
        archive.directory(join(cwd, 'out'), false);
      } else {
        // Add files from the file list
        for (const file of fileArr) {
          const absolutePath = join(RootDirectory, file);
          const relativePath = absolutePath.replace(cwd + '/', '');
          archive.file(absolutePath, { name: relativePath });
        }
      }

      archive.finalize();

      // Yield progress updates while archiving
      while (!archiveDone) {
        // Wait a bit for progress updates
        await new Promise(resolve => setTimeout(resolve, 100));

        // Yield any accumulated progress updates
        while (progressUpdates.length > 0) {
          const progress = progressUpdates.shift()!;
          yield `${progress}\n`;
        }

        // Check if archive is complete
        const result = await Promise.race([
          archiveComplete.then(() => 'done' as const),
          new Promise<'pending'>(resolve => setTimeout(() => resolve('pending'), 50)),
        ]);

        if (result === 'done') {
          archiveDone = true;
        }
      }

      yield '1\n';
      return;
    },
    {
      params: t.Object({
        entityId: t.String(),
        type: t.Enum(DownloadType),
      }),
    },
  )
  .get(
    '/download/:entityId/:type',
    async ({ status, params: { entityId, type }, set }) => {
      const entity = await entityCollection.findOne({ _id: new ObjectId(entityId) });
      if (!entity) return status(404, 'Entity not found');
      if (!entity.options?.allowDownload)
        return status(403, 'Download not allowed for this entity');

      const { cwds } = await getDownloadOptions(entity);

      const cwd = cwds[type];
      if (!cwd) {
        warn(`No valid working directory found for entity ${entityId} of type ${type}`);
        return status(404, 'No valid working directory found');
      }

      const zipName = `${entityId}_${type}.zip`;
      return Bun.file(join(cwd, zipName));
    },
    {
      params: t.Object({
        entityId: t.String(),
        type: t.Enum(DownloadType),
      }),
    },
  )

  .group('/upload', { isLoggedIn: true }, group =>
    group
      .post('/chunk/init', async () => {
        const uploadId = new ObjectId().toString();
        const tempDir = join(uploadDir, 'chunks', uploadId);
        await ensure(tempDir);
        return { status: 'OK', uploadId };
      })
      .post(
        '/chunk/upload',
        async ({ body: { chunk, uploadId, index }, status }) => {
          const tempDir = join(uploadDir, 'chunks', uploadId);
          await ensure(tempDir);
          const chunkPath = join(tempDir, `chunk_${index.toString().padStart(4, '0')}`);
          const writeSuccess = await Bun.write(chunkPath, chunk)
            .then(() => true)
            .catch(e => {
              err(e);
              return false;
            });
          if (!writeSuccess) {
            return status(500, 'Failed to write chunk to disk');
          }
          return { status: 'OK' };
        },
        {
          body: t.Object({
            chunk: t.File({ maxSize: '4m' }),
            uploadId: t.String(),
            index: t.Numeric(),
          }),
        },
      )
      .post(
        '/chunk/finish',
        async ({ status, body: { uploadId, filename, token, type, relativePath } }) => {
          try {
            const tempDir = join(uploadDir, 'chunks', uploadId);
            if (!(await exists(tempDir))) {
              return status(400, 'Invalid uploadId');
            }
            const basePath = join(uploadDir, type, token);
            const sluggedRelativePath = slug(relativePath).trim();
            const destPath =
              sluggedRelativePath.length > 0
                ? join(basePath, slug(relativePath))
                : join(basePath, filename);

            await ensure(destPath);

            const chunkGlob = new Bun.Glob('chunk_*');
            const chunkEntries = await Array.fromAsync(chunkGlob.scan({ cwd: tempDir }));

            const fileWriter = Bun.file(destPath).writer();

            try {
              // Iterate through all expected chunks in order
              for (let i = 0; i < chunkEntries.length; i++) {
                const chunkPath = join(tempDir, `chunk_${i.toString().padStart(4, '0')}`);
                const chunkFile = Bun.file(chunkPath);

                if (!(await chunkFile.exists())) {
                  throw new Error(`Missing chunk file: ${chunkPath}`);
                }

                const chunkStream = chunkFile.stream();
                for await (const chunk of chunkStream) {
                  fileWriter.write(chunk);
                }
              }

              fileWriter.end();

              // Calculate MD5 of the final file if needed
              const serverChecksum = await calculateMD5(Bun.file(destPath).stream());

              // Cleanup temp directory
              await rm(tempDir, { recursive: true, force: true });

              return { status: 'OK', path: destPath, serverChecksum };
            } catch (e) {
              fileWriter.end();
              err(e);
              return status(500, 'Failed to assemble file');
            }
          } catch (e) {
            err(e);
            return status(500, 'Internal server error during chunk finish');
          }
        },
        {
          body: t.Object({
            uploadId: t.String(),
            filename: t.String(),
            relativePath: t.String(),
            token: t.String(),
            type: t.String(),
          }),
        },
      )
      .post(
        '/file',
        async ({ status, body: { file, token, type, relativePath } }) => {
          const serverChecksum = await calculateMD5(file.stream());
          const basePath = join(uploadDir, type, token);
          const sluggedRelativePath = slug(relativePath).trim();
          const destPath =
            sluggedRelativePath.length > 0
              ? join(basePath, slug(relativePath))
              : join(basePath, file.name);

          const success = await writeStreamToDisk(file.stream(), destPath);
          return success ? { status: 'OK', serverChecksum } : status('Internal Server Error');
        },
        {
          body: t.Object({
            file: t.File({ maxSize: '4096m' }),
            relativePath: t.String(),
            token: t.String(),
            type: t.String(),
          }),
        },
      )
      .post(
        '/process/start',
        async ({ status, body: { uuid, type } }) => {
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
          if (files.length === 0) return status(404, 'No files found');
          if (ids.length <= 0) return status(404, 'No files found');

          const hasBeenProcessed = await getProcessedFiles(
            ids.map(id => `${RootDirectory}/${UploadDirectory}/${type}/${id}`),
            type,
          ).then(result => result.length > 0);

          const unprocessedFileTypes: Record<string, string[]> = {
            model: ['.obj'],
            cloud: ['.las', '.laz'],
            splat: ['.splat', '.spx', '.ply'],
          };

          const hasUnprocessedFiles = files.some(file =>
            unprocessedFileTypes[type]?.some(ext => file.toLowerCase().endsWith(ext)),
          );

          if (!hasUnprocessedFiles || hasBeenProcessed) {
            return {
              status: 'OK',
              uuid,
              type,
              requiresProcessing: false,
            };
          }

          try {
            const queueResponse = await fetch(
              `http://${Hostname}:${Port}/process/${type}/${ids.at(0)!}`,
            ).then(response => response.json() as Promise<KompressorQueueResponse>);

            return {
              status: queueResponse.status,
              uuid,
              type,
              requiresProcessing: true,
            };
          } catch (error) {
            err(`Failed processing with kompressor: ${error}`);
            info(
              Bun.inspect({
                hasUnprocessedFiles,
                files,
                ids,
                type,
                config: Configuration.Kompressor,
              }),
            );

            return status(500, 'Failed to start processing with kompressor');
          }
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
        async ({ body: { uuid, type } }) => {
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
        async ({ status, body: { uuid, type } }) => {
          const path = `${RootDirectory}/${UploadDirectory}/${type}/${uuid}`;
          const { files, ids } = await getUploadedFiles({ type, path });
          if (files.length === 0) return status(404, 'No files found');

          const processedFiles = await getProcessedFiles(
            ids.map(id => `${RootDirectory}/${UploadDirectory}/${type}/${id}`),
            type,
          );

          log({ processedFiles, files });

          const finalFiles: IFile[] = (processedFiles.length > 0 ? processedFiles : files).map(
            file => {
              let relPath = dirname(file).replace(RootDirectory, '');
              relPath = relPath.charAt(0) === '/' ? relPath.slice(1) : relPath;
              if (!relPath.startsWith(`${UploadDirectory}/${type}/${uuid}`)) {
                relPath = join(UploadDirectory, type, uuid, relPath);
              }

              return {
                file_name: basename(file),
                file_link: join(relPath, basename(file)),
                file_size: Bun.file(join(RootDirectory, relPath, basename(file))).size,
                file_format: extname(file),
              } satisfies IFile;
            },
          );

          log({ finalFiles });

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
        async ({ status, body: { uuid, type } }) => {
          const path = `${RootDirectory}/${UploadDirectory}/${type}/${uuid}`;
          const pathStat = await stat(path).catch(e => {
            err(e);
            return undefined;
          });

          if (!pathStat || !pathStat.isDirectory()) return status(404);

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
