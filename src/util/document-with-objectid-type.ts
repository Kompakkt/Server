import type { ObjectId } from 'mongodb';

export type ServerDocument<T> = { _id: ObjectId | string } & Omit<T, '_id'>;
