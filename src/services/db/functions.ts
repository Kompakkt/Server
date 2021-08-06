import { ObjectId, Filter } from 'mongodb';
import { ensureDir, writeFile } from 'fs-extra';
import imagemin from 'imagemin';
import imageminPngquant from 'imagemin-pngquant';
import { RootDirectory } from '../../environment';
import { Configuration } from '../configuration';
import { Logger } from '../logger';

/**
 * Turns an _id into a more forgiving Query by allowing both ObjectId as well as string
 * @type {[type]}
 */
const query = (_id: string | ObjectId): Filter<any> => {
  return {
    $or: [{ _id }, { _id: new ObjectId(_id) }, { _id: _id.toString() }],
  };
};

/**
 * Checks whether two _id's are equal by making sure they are considered as ObjectIds
 * @param {string | ObjectId} firstId  [description]
 * @param {string | ObjectId} secondId [description]
 */
const areIdsEqual = (firstId: string | ObjectId, secondId: string | ObjectId) => {
  if (!ObjectId.isValid(firstId)) return false;
  if (!ObjectId.isValid(secondId)) return false;
  return new ObjectId(firstId).toString() === new ObjectId(secondId).toString();
};

// TODO: (Optional) Convert to progressive JPEG?
/**
 * Takes a base64 png image string, saves it to disk and returns the URL of the file.
 * Does nothing if the input string is already a URL.
 * @param {string}    base64OrUrl [description]
 * @param {string}    subfolder   [description]
 * @param {string |           ObjectId}    identifier [description]
 * @param {[type]}                [description]
 */
const updatePreviewImage = async (
  base64OrUrl: string,
  subfolder: string,
  identifier: string | ObjectId,
) => {
  const convertBase64ToBuffer = (input: string) => {
    const replaced = input.replace(/^data:image\/(png|gif|jpeg);base64,/, '');
    return Buffer.from(replaced, 'base64');
  };

  const minifyBuffer = (buffer: Buffer) =>
    imagemin.buffer(buffer, {
      plugins: [
        imageminPngquant({
          speed: 1,
          strip: true,
          dithering: 1,
        }),
      ],
    });

  const writeBufferToFile = async (buffer: Buffer) => {
    const subfolderPath = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/previews/${subfolder}/`;
    const filePath = `${subfolderPath}${identifier}.png`;
    return ensureDir(subfolderPath)
      .then(() => writeFile(filePath, buffer))
      .then(() => `previews/${subfolder}/${identifier}.png`);
  };

  const getPreviewImagePath = async (input: string) => {
    // If the image is not a base64 image we assume it has already been converted and saved to disk
    if (!input.includes('data:image')) return `previews/${input.split('previews/')[1]}`;

    // Otherwise we save it to a new file
    const converted = convertBase64ToBuffer(input);
    const minified = await minifyBuffer(converted);

    return await writeBufferToFile(minified);
  };

  const finalImagePath = await getPreviewImagePath(base64OrUrl).catch(err => {
    Logger.err('Failed saving image from base64', err);
    return 'previews/noimage.png';
  });

  const https = Configuration.Express.enableHTTPS ? 'https' : 'http';
  const pubip = Configuration.Express.PublicIP;
  const port = Configuration.Express.Port;

  return `${https}://${pubip}:${port}/${finalImagePath}`;
};

export { query, areIdsEqual, updatePreviewImage };
