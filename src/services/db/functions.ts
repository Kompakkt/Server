import { ObjectId, Filter } from 'mongodb';
import { ensureDir, writeFile } from 'fs-extra';
import imagemin from 'imagemin';
import imageminPngquant from 'imagemin-pngquant';
import { RootDirectory } from '../../environment';
import { Configuration } from '../configuration';
import { Logger } from '../logger';
import { IUserData, IStrippedUserData, ICompilation, Collection, IDocument } from '../../common';

/**
 * Turns an _id into a more forgiving Query by allowing both ObjectId as well as string
 * @template TDocument The document type being queried
 * @param _id The ID value to query for
 * @param targetProp The property name to query against (default: '_id')
 * @returns A MongoDB Filter that matches both string and ObjectId representations
 */
const query = <TDocument extends { [key: string]: any }>(
  _id: string | ObjectId,
  targetProp = '_id',
): Filter<TDocument> => {
  const query: Filter<TDocument> = { $or: [] };

  // First condition: match as string
  const stringCondition: Partial<TDocument> = {} as Partial<TDocument>;
  stringCondition[targetProp as keyof TDocument] = _id.toString() as any;
  query.$or!.push(stringCondition as any);

  // Second condition: match as ObjectId
  const objectIdCondition: Partial<TDocument> = {} as Partial<TDocument>;
  objectIdCondition[targetProp as keyof TDocument] = new ObjectId(_id.toString()) as any;
  query.$or!.push(objectIdCondition as any);

  return query;
};

/**
 * Turns an _id into a more forgiving $in query by allowing both ObjectId and string formats
 * @template TDocument The document type being queried
 * @template TField The type of the field being queried (typically string | ObjectId)
 * @param _id The ID value to include in the $in query
 * @returns A MongoDB $in operator that matches both string and ObjectId representations
 */
const queryIn =
  // @ts-ignore-next-line
  <TDocument extends { [key: string]: any }, TField = string | ObjectId>(
    _id: string | ObjectId,
  ): {
    $in: TField[];
  } => {
    return {
      $in: [_id.toString(), new ObjectId(_id.toString())] as unknown as TField[],
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
 * Returns the ID of a document, regardless of its type
 * @param document The document whose ID to retrieve
 * @returns The ID of the document
 */
const getDocumentId = (document: string | ObjectId | IDocument) => {
  if (typeof document === 'string') return document;
  if (document instanceof ObjectId) return document;
  return document._id;
};

/**
 * Checks whether two _id's are equal by making sure they are considered as ObjectIds
 * @param {string | ObjectId} firstId  [description]
 * @param {string | ObjectId} secondId [description]
 */
const areIdsEqual = (firstId: string | ObjectId | null, secondId: string | ObjectId | null) => {
  if (!firstId || !ObjectId.isValid(firstId)) return false;
  if (!secondId || !ObjectId.isValid(secondId)) return false;
  return new ObjectId(firstId).toString() === new ObjectId(secondId).toString();
};

/**
 * Checks wheter an _id is valid
 * @type {Boolean}
 */
const isValidId = (_id?: string | ObjectId): _id is string | ObjectId => {
  return !!_id && ObjectId.isValid(_id);
};

// Used for helper method below
const __tmp: { [key: string]: Array<any> } = {};
for (const value of Object.values(Collection)) __tmp[value] = new Array<any>();
/**
 * Generates an empty object of all available database collections for the data property of a user.
 * This can be applied at login and does not need a migration incase we add more types
 * @type {[type]}
 */
const getEmptyUserData = () => ({ ...__tmp } as { [key in Collection]: Array<any> });

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
const stripUserData = ({
  _id,
  username,
  fullname,
}: IUserData | IStrippedUserData): IStrippedUserData => ({
  _id: _id.toString(),
  username,
  fullname,
});

export {
  query,
  queryIn,
  areIdsEqual,
  getDocumentId,
  updatePreviewImage,
  stripUserData,
  isValidId,
  lockCompilation,
  getEmptyUserData,
};
