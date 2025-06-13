export const capitalize = (
  str?: string,
  options: Partial<{
    keepUppercase: string[];
    keepLowercase: string[];
  }> = {
    keepUppercase: [],
    keepLowercase: [],
  },
) => {
  if (!str) return undefined;
  // Check if string is uppercase and should be kept as is, e.g. SPARQL, SQL, etc.
  if (options.keepUppercase?.includes(str)) {
    return str;
  }
  // Check if string is lowercase and should be kept as is, e.g. sparql, sql, etc.
  if (options.keepLowercase?.includes(str)) {
    return str;
  }
  // Otherwise capitalize the first letter
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};
