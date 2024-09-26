import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path';

/**
 * Ensure a path exists
 * @param path 
 * @returns 
 */
export const ensure = async (path: string) => {
    if (await Bun.file(dirname(path)).exists()) return
    await mkdir(dirname(path), { recursive: true });
}