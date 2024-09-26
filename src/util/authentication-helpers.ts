import { createHmac, randomBytes, type BinaryLike } from 'node:crypto';
import { passwordCollection, type PasswordDocument } from 'src/mongo';

const generateSalt = (length = 16) => {
  // tslint:disable-next-line
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
};
const sha512 = (password: string, salt: BinaryLike) => {
  const hash = createHmac('sha512', salt);
  hash.update(password);
  const passwordHash = hash.digest('hex');
  return { salt, passwordHash };
};
const SALT_LENGTH = 16;
export const saltHashPassword = (password: string) => {
  return sha512(password, generateSalt(SALT_LENGTH));
};

export const verifyPassword = async (
  password: string,
  { password: { passwordHash: hash, salt } }: PasswordDocument,
) => {
  const newHash = sha512(password, salt).passwordHash;
  return newHash === hash;
};

export const updateUserPassword = async (
  username: string,
  password: string,
) => {
  const result = await passwordCollection
    .updateOne(
      { username },
      { $set: { username, password: saltHashPassword(password) } },
      { upsert: true },
    );
  return result.modifiedCount + result.upsertedCount > 0;
};
