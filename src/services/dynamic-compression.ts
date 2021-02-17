import { Request, Response } from 'express';
import { exists, move, readFile, writeFile } from 'fs-extra';
import { join } from 'path';
import { brotliCompress, constants, gzip } from 'zlib';

const wrapperExists = async (filename: string) =>
  new Promise<boolean>((resolve, _) => exists(filename, resolve));

const wrapperReadFile = async (filename: string) =>
  new Promise<Buffer>((resolve, reject) =>
    readFile(filename, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    }),
  ).catch(err => {
    console.error(err);
    return undefined;
  });

const getBrotli = async (file: Buffer) =>
  new Promise<Buffer | undefined>((resolve, reject) =>
    brotliCompress(
      file,
      {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 4,
        },
      },
      (err, res) => (err ? reject(undefined) : resolve(res)),
    ),
  );

const getGZip = async (file: Buffer) =>
  new Promise<Buffer | undefined>((resolve, reject) =>
    gzip(file, { level: 6 }, (err, res) => (err ? reject(undefined) : resolve(res))),
  );

const saveCompressed = async (file: Buffer, filename: string) => {
  const tempName = `${filename}.tmp`;
  return writeFile(tempName, file)
    .then(() => {
      return move(tempName, filename);
    })
    .then(() => {
      console.log('Moved temp compressed file to real compressed file');
    })
    .catch(err => {
      console.log('Failed saving compressed file', err);
    });
};

export const serveFile = (directory: string) => async (req: Request, res: Response) => {
  const filename = join(directory, req.path);
  const acceptedEncodings = req.headers['accept-encoding'] as string | undefined;

  const doesFileExist = await wrapperExists(filename);

  if (!doesFileExist) {
    res.sendStatus(404);
    return;
  }

  const resultFile = await wrapperReadFile(filename);

  if (!resultFile) {
    res.sendStatus(404);
    return;
  }

  if (!acceptedEncodings) {
    res.status(200).send(resultFile);
    return;
  }

  let compressedFile = resultFile;

  if (acceptedEncodings.includes('br')) {
    const compressedFilename = `${filename}.br`;
    const doesCompressedExist = await wrapperExists(compressedFilename);
    const result = doesCompressedExist
      ? await wrapperReadFile(compressedFilename)
      : await getBrotli(resultFile);
    if (result) {
      compressedFile = result;
      res.setHeader('Content-Encoding', 'br');
      if (!doesCompressedExist && !(await wrapperExists(`${compressedFilename}.tmp`))) {
        saveCompressed(result, compressedFilename);
      }
    }
  } else if (acceptedEncodings.includes('gzip')) {
    const compressedFilename = `${filename}.gz`;
    const doesCompressedExist = await wrapperExists(compressedFilename);
    const result = doesCompressedExist
      ? await wrapperReadFile(compressedFilename)
      : await getGZip(resultFile);
    if (result) {
      compressedFile = result;
      res.setHeader('Content-Encoding', 'gzip');
      if (!doesCompressedExist && !(await wrapperExists(`${compressedFilename}.tmp`))) {
        saveCompressed(result, compressedFilename);
      }
    }
  }

  res.status(200).send(compressedFile);
};
