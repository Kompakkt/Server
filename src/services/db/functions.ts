import { ObjectId, Filter } from 'mongodb';
import { ensureDir, writeFile } from 'fs-extra';
import imagemin from 'imagemin';
import imageminPngquant from 'imagemin-pngquant';
import { RootDirectory } from '../../environment';
import { Configuration } from '../configuration';
import { Logger } from '../logger';
import { IUserData, IStrippedUserData, ICompilation } from '../../common/interfaces';

/**
 * Turns an _id into a more forgiving Query by allowing both ObjectId as well as string
 * @type {[type]}
 */
const query = (_id: string | ObjectId): Filter<any> => {
  return {
    $or: [{ _id: _id.toString() }, { _id: new ObjectId(_id.toString()) }],
  };
};

/**
 * Turns an _id into a more forgiving Query (Array) by allowing both ObjectId as well as string
 * @type {[type]}
 */
const queryIn = (_id: string | ObjectId): Filter<any> => {
  return {
    $in: [_id.toString(), new ObjectId(_id.toString())],
  };
};

/**
 * Sets the password property of a compilation to a boolean,
 * depending on whether the compilation has a password
 * @type {[type]}
 */
const lockCompilation = (comp: ICompilation): ICompilation => {
  return { ...comp, password: !!comp.password };
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

/**
 * Checks wheter an _id is valid
 * @type {Boolean}
 */
const isValidId = (_id?: string | ObjectId): _id is string | ObjectId => {
  return !!_id && ObjectId.isValid(_id);
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

  return finalImagePath;
};

/**
 * Removes all user properties except for fullname, username and _id
 * @type {[type]}
 */
const stripUserData = (obj: IUserData): IStrippedUserData => ({
  _id: obj._id,
  username: obj.username,
  fullname: obj.fullname,
});

export {
  query,
  queryIn,
  areIdsEqual,
  updatePreviewImage,
  stripUserData,
  isValidId,
  lockCompilation,
};
