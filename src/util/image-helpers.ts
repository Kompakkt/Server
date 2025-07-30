import type { ObjectId } from 'mongodb';
import sharp from 'sharp';
import { Configuration } from 'src/configuration';
import { RootDirectory } from 'src/environment';
import { err } from 'src/logger';
import { ensure } from './file-related-helpers';

export const MAX_PROFILE_IMAGE_RESOLUTION = 256;
export const MAX_PREVIEW_IMAGE_RESOLUTION = 360;

/**
 * Takes a base64 PNG image string, saves it to disk, and returns the URL of the file.
 * If the input string is already a URL, it returns the existing URL.
 */
export const updatePreviewImage = async (
  base64OrUrl: string,
  subfolder: string,
  identifier: string | ObjectId,
  maxResolution: number,
) => {
  const convertBase64ToBuffer = (input: string) => {
    const replaced = input.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(replaced, 'base64');
  };

  const minifyBuffer = (buffer: Buffer) =>
    sharp(buffer)
      .resize({ fit: 'inside', width: maxResolution, height: maxResolution })
      .webp({ quality: 80 })
      .toBuffer();

  const writeBufferToFile = async (buffer: Buffer) => {
    const subfolderPath = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/previews/${subfolder}/`;
    const filePath = `${subfolderPath}${identifier}.webp`;
    await ensure(subfolderPath);
    await Bun.write(filePath, buffer);
    return `previews/${subfolder}/${identifier}.webp`;
  };

  const getPreviewImagePath = async (input: string) => {
    // If the image is not a base64 image we assume it has already been converted and saved to disk
    if (!input.startsWith('data:image')) return `previews/${input.split('previews/')[1]}`;

    // Otherwise we save it to a new file
    const converted = convertBase64ToBuffer(input);
    const minified = await minifyBuffer(converted);

    return await writeBufferToFile(minified);
  };

  try {
    return await getPreviewImagePath(base64OrUrl);
  } catch (error) {
    err('Failed saving image from base64', error);
    return 'previews/noimage.png';
  }
};
