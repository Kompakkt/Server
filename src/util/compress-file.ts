import { Configuration } from 'src/configuration';
import { RootDirectory } from 'src/environment';
import { err, info } from 'src/logger';
import { basename, dirname } from 'node:path';

const { UploadDirectory } = Configuration.Uploads;

const compressBrotli = async (path: string) => {
  const dir = dirname(path);
  const name = basename(path);
  console.log('brotli', { dir, name });
  return Bun.$`brotli -4 ${name}`.cwd(dir).quiet();
};

const compressZstd = async (path: string) => {
  const dir = dirname(path);
  const name = basename(path);
  console.log('zstd', { dir, name });
  return Bun.$`zstd -1 ${name}`.cwd(dir).quiet();
};

export const compressFile = async (path: string, type: 'brotli' | 'zstd' | 'gzip') => {
  const fullPath = path.startsWith(`${RootDirectory}/${UploadDirectory}`)
    ? path
    : `${RootDirectory}/${UploadDirectory}/${path}`;

  if (['.br', '.gz', '.zst'].some(ext => path.endsWith(ext))) return true;

  const file = Bun.file(`${fullPath}`);
  switch (type) {
    case 'brotli':
      const brFile = Bun.file(`${fullPath}.br`);
      const brExists = await brFile.exists();
      if (!brExists) {
        info(`Creating brotli compressed file ${brFile.name}`);
        const result = await compressBrotli(fullPath).catch(error => err(error));
        if (!result) return false;
      }
      return true;
    case 'zstd':
      const zstFile = Bun.file(`${fullPath}.zst`);
      const zstExists = await zstFile.exists();
      if (!zstExists) {
        info(`Creating zstd compressed file ${zstFile.name}`);
        const result = await compressZstd(fullPath).catch(error => err(error));
        if (!result) return false;
      }
      return true;
    case 'gzip':
      const gzFile = Bun.file(`${fullPath}.gz`);
      const gzExists = await gzFile.exists();
      if (!gzExists) {
        const content = await file.bytes();
        info(`Creating gzip compressed file ${gzFile.name}`);
        try {
          const gzContent = Bun.gzipSync(content, { level: 6 });
          await gzFile.write(gzContent);
        } catch (error) {
          err(error);
          return false;
        }
      }
      return true;
    default:
      return false;
  }
};
