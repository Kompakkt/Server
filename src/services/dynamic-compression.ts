import { compress } from 'iltorb';
import { exists, readFile } from 'fs-extra';
import { join } from 'path';
import { Request, Response } from 'express';

export const serveFile = (directory: string) => async (
  request: Request,
  response: Response,
) => {
  const filename = join(directory, request.path);
  const acceptedEncodings = request.headers['accept-encoding'] as
    | string
    | undefined;
  const doesFileExist = await new Promise<boolean>((resolve, _) =>
    exists(filename, resolve),
  );

  if (!doesFileExist) {
    response.sendStatus(404);
    return;
  }

  const resultFile = await new Promise<Buffer>((resolve, reject) =>
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

  if (!resultFile) {
    response.sendStatus(404);
    return;
  }

  if (!acceptedEncodings) {
    response.send(resultFile);
    return;
  }

  let compressedFile = resultFile;

  // TODO: more encoding types
  if (acceptedEncodings.includes('br')) {
    const result = await getBrotli(resultFile);
    if (result) {
      compressedFile = result;
      response.setHeader('Content-Encoding', 'br');
    }
  }

  response.send(compressedFile);
};

const getBrotli = async (file: Buffer) =>
  compress(file, { quality: 4 })
    .then(result => result)
    .catch(err => {
      console.error(err);
      return undefined;
    });
