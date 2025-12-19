import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Ensure a path exists
 * @param path
 * @returns
 */
export const ensure = async (path: string) => {
  try {
    await mkdir(dirname(path), { recursive: true });
  } catch (err) {
    // ignore
  }
};
