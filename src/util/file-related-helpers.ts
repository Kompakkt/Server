import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { info, warn } from 'src/logger';

/**
 * Ensure a path exists
 * @param path
 * @returns
 */
export const ensure = async (path: string) => {
  try {
    info(`Ensuring path exists: ${path}`);
    await mkdir(dirname(path), { recursive: true });
  } catch (err) {
    warn(`Failed to ensure path exists: ${path}`, err);
  }
};
