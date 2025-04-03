/**
 * Returns an array of key-value pairs from an object, with type safety.
 * @param obj
 * @returns
 */
export const typedObjectEntries = <T extends object>(obj: T): [keyof T, T[keyof T]][] => {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
};
