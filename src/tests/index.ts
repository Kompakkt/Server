import * as assert from 'uvu/assert';
import { faker } from '@faker-js/faker';

import got from 'got';
const get = <T extends unknown>(path: string) => got.get(`http://localhost:8080${path}`).json<T>();
const post = <T extends unknown>(path: string, json: any) =>
  got.post(`http://localhost:8080${path}`, { json }).json<T>();

import { suite } from 'uvu';
import { Express } from '../server';
import { hrtime } from 'process';
type Context = {
  app: typeof Express;
  __hrtime__: [number, number];
};

const test = suite<Context>('', {
  app: Express,
  __hrtime__: hrtime(),
});

type StatusResponse = { status: 'OK' };
type DocumentResponse = { _id: string } & StatusResponse;

export { assert, faker, get, post, Context, test, Express, StatusResponse, DocumentResponse };
