import { log } from 'src/logger';

/**
 * Wait until a file exists.
 * @param path - The path to the file.
 * @param timeout - The timeout in milliseconds.
 * @returns A promise that resolves to true if the file exists, false otherwise.
 */
export const waitUntilFileExists = async (path: string, timeout: number) => {
  if (timeout <= 0) {
    const result = await Bun.file(path).exists();
    return result;
  }
  log(`Waiting for file to exist: ${path}`);
  const startTime = performance.now();
  return new Promise<boolean>(resolve => {
    const checkIfFileExists = async () => {
      const result = await Bun.file(path).exists();
      if (result) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        log(`File exists after ${duration}ms at ${path}`);
        return resolve(true);
      }
      setTimeout(() => checkIfFileExists(), 0);
    };
    setTimeout(() => resolve(false), timeout);
    checkIfFileExists();
  });
};
