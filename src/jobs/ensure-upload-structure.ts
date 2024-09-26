import { Configuration } from 'src/configuration';
import { RootDirectory } from 'src/environment';
import { info, err } from 'src/logger';
import { ensure } from 'src/util/file-related-helpers';

const { TempDirectory, UploadDirectory } = Configuration.Uploads

export const ensureUploadStructure = async () => {
  const directories = [
    `${RootDirectory}/${UploadDirectory}`,
    `${RootDirectory}/${TempDirectory}`,
    ...['audio', 'image', 'metadata_files', 'model', 'previews', 'video'].map(folder => `${RootDirectory}/${UploadDirectory}/${folder}`),
  ];

  const allExist = await Promise.all(directories.map(d => Bun.file(d).exists()));
  if (allExist.every(d => d)) return true;
  info('Ensuring upload structure');
  try {
    await Promise.all(directories.map(ensure));
  } catch (e) {
    err('Failed ensuring upload structure', e);
    return false;
  }
  return true;
};
