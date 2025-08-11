import type { ObjectId } from 'mongodb';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { IFile } from 'src/common';
import { Configuration } from 'src/configuration';
import { RootDirectory } from 'src/environment';
import { warn } from 'src/logger';

export const saveMetadataFiles = async (entityId: ObjectId | string, metadataFiles: IFile[]) => {
  const metadataFilePath = join(
    RootDirectory,
    Configuration.Uploads.UploadDirectory,
    'metadata_files',
  );
  await mkdir(metadataFilePath, { recursive: true });
  for (let i = 0; i < metadataFiles.length; i++) {
    const { file_link, file_name } = metadataFiles[i];

    // Skip saved files
    if (file_link.startsWith(Configuration.Uploads.UploadDirectory + '/')) continue;

    try {
      const path = join(metadataFilePath, entityId.toString());
      const file = Bun.file(join(path, file_name));
      await file.write(file_link);

      metadataFiles[i].file_link = join(
        Configuration.Uploads.UploadDirectory,
        'metadata_files',
        entityId.toString(),
        file_name,
      );
    } catch (error) {
      warn(`Failed to save metadata file ${file_name} for entity ${entityId}:`, error);
    }
  }
  return metadataFiles;
};
