import { randomBytes } from 'crypto';

const alphabet = 'abcdefghijklmnopqrstuvwxyz';
const numbers = '0123456789';
const special = '!$%&*-_';
const allowedChars = `${alphabet}${alphabet.toUpperCase()}${numbers}${special}`.split('');

export const generateSecurePassword = (): string => {
  const values = [...randomBytes(16).values()];
  return values.map(v => allowedChars[v % allowedChars.length]).join('');
};
