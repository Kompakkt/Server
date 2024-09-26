import { Elysia, t } from 'elysia';
import { readdir, rmdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import slugify from 'slugify';
import type { IFile } from 'src/common';
import { Configuration } from 'src/configuration';
import { RootDirectory } from 'src/environment';
import { err } from 'src/logger';
import configServer from 'src/server.config';
import { ensure } from 'src/util/file-related-helpers';
import { authService } from './handlers/auth.service';

declare global {
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

// Prepare folder structure
const { UploadDirectory } = Configuration.Uploads;
const uploadDir = `${RootDirectory}/${UploadDirectory}/`;

const uploadRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .get(
    'uploads/*',
    async ({ params: { '*': path } }) => {
      console.log(path);
      const uploadDir = join(RootDirectory, Configuration.Uploads.UploadDirectory);
      const filePath = join(uploadDir, path.split('/uploads').at(-1)!);
      return Bun.file(filePath);
      //     http://localhost:3030/uploads/model/66f1524a93ae4c138e26f96f/DamagedHelmet.glb
    },
    {
      params: t.Object({
        '*': t.String(),
      }),
    },
  )
  .group(
    '/upload',
    {
      isLoggedIn: true,
    },
    group =>
      group
        .post(
          '/file',
          async ({ error, userdata, body: { file, checksum, token, type, relativePath } }) => {
            const destPath = join(
              uploadDir,
              `${type}`,
              `${token}/`,
              `${slug(relativePath)}`,
              file.name,
            );
            const success = await writeStreamToDisk(file.stream(), destPath);
            return success
              ? {
                  status: 'OK',
                  clientChecksum: checksum,
                  serverChecksum: await calculateMD5(file.stream()),
                }
              : error('Internal Server Error');
          },
          {
            body: t.Object({
              file: t.File(),
              relativePath: t.String(),
              token: t.String(),
              type: t.String(),
              checksum: t.String(),
            }),
          },
        )
        .post(
          '/finish',
          async ({ error, body: { uuid, type } }) => {
            const path = `${RootDirectory}/${UploadDirectory}/${type}/${uuid}`;
            const entries = await readdir(path, { recursive: true, withFileTypes: true }).catch(
              e => {
                err(e);
                return undefined;
              },
            );
            if (!entries) return error(404);

            const files = entries.filter(dirent => dirent.isFile());

            const filter = (() => {
              switch (type) {
                case 'entity':
                  return ['.obj', '.babylon', '.gltf', '.glb', '.stl'];
                default:
                  return [];
              }
            })();

            const filteredFiles = files.filter(dirent => {
              return filter.some(ext => dirent.name.endsWith(ext));
            });

            const finalFiles: IFile[] = (filteredFiles.length > 0 ? filteredFiles : files).map(
              dirent => {
                let _relativePath = dirent.parentPath.replace(RootDirectory, '');
                _relativePath =
                  _relativePath.charAt(0) === '/' ? _relativePath.slice(1) : _relativePath;

                return {
                  file_name: dirent.name,
                  file_link: join(_relativePath, dirent.name),
                  file_size: Bun.file(join(path, dirent.name)).size,
                  file_format: extname(dirent.name),
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
