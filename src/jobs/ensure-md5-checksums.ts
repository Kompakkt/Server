import { Configuration } from 'src/configuration';
import { RootDirectory } from 'src/environment';
import { info } from 'src/logger';
import { md5Cache } from 'src/redis';

const { UploadDirectory } = Configuration.Uploads;

export const ensureMd5Checksums = async () => {
  await md5Cache.flush();
  const glob = new Bun.Glob('**/*');
  const start = performance.now();
  for await (const path of glob.scan({ cwd: `${RootDirectory}/${UploadDirectory}` })) {
    // Skip converted point clouds, as they produce a huge amount of files
    if (path.includes('out/ept')) continue;

    const file = Bun.file(`${RootDirectory}/${UploadDirectory}/${path}`);
    const hasher = new Bun.CryptoHasher('md5');
    hasher.update(await file.arrayBuffer());
    const result = hasher.digest('hex');
    const existing = await md5Cache.get<string>(result);
    if (existing && path !== existing) {
      // log('Duplicate file', path, existing);
      continue;
    }
    await md5Cache.set(result, path);
  }
  const end = performance.now();
  info(`Finished ensuring MD5 checksums in ${end - start}ms`);
  return true;
};
