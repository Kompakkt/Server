import { Configuration } from 'src/configuration';
import { RootDirectory } from 'src/environment';
import { err, info } from 'src/logger';
import { basename, dirname } from 'node:path';
import { waitUntilFileExists } from './wait-until-file-exists';

export const COMPRESSION_ENCODINGS = {
  zstd: '.zst',
  brotli: '.br',
  gzip: '.gz',
} as const;

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

const compressGzip = async (path: string) => {
  const dir = dirname(path);
  const name = basename(path);
  console.log('gzip -6 -k', { dir, name });
  // We use pigz instead of gzip because it's faster
  return Bun.$`pigz -6 -k ${name}`.cwd(dir).quiet();
};

const COMPRESSION_METHODS = {
  brotli: compressBrotli,
  zstd: compressZstd,
  gzip: compressGzip,
} as const;

export const compressFile = async (path: string, type: keyof typeof COMPRESSION_ENCODINGS) => {
  const fullPath = path.startsWith(`${RootDirectory}/${UploadDirectory}`)
    ? path
    : `${RootDirectory}/${UploadDirectory}/${path}`;

  if (['.br', '.gz', '.zst'].some(ext => path.endsWith(ext))) {
    info(`File ${fullPath} already compressed`);
    return true;
  }

  const extension = COMPRESSION_ENCODINGS[type];
  const method = COMPRESSION_METHODS[type];

  const compressedFileExists = await Bun.file(`${fullPath}${extension}`).exists();
  if (compressedFileExists) {
    info(`File ${fullPath}${extension} already exists`);
    return true;
  }
  info(`Creating ${extension} compressed file ${fullPath}${extension}`);

  const result = await method(fullPath).catch(error => err(error));
  if (!result) return false;
  info(`Compressed file ${fullPath}${extension} created successfully`);
  await waitUntilFileExists(`${fullPath}${extension}`, 10_000);
  return true;
};
