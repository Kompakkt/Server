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
  console.log('Waiting for file to exist:', path);
  console.time('waitUntilFileExists' + path);
  return new Promise<boolean>(resolve => {
    const checkIfFileExists = async () => {
      const result = await Bun.file(path).exists();
      if (result) {
        console.log('File exists:', path);
        console.timeEnd('waitUntilFileExists' + path);
        return resolve(true);
      }
      setTimeout(() => checkIfFileExists(), 0);
    };
    setTimeout(() => resolve(false), timeout);
    checkIfFileExists();
  });
};
