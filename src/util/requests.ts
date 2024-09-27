import { Err, Ok, type Result } from '@thames/monads';
import type { NotUndefined } from 'object-hash';

type ResponseFormat = 'text' | 'json' | 'buffer' | 'blob';

const transformResponse = (response: Response, as: ResponseFormat) => {
  switch (as) {
    case 'text':
      return response.text();
    case 'buffer':
      return response.arrayBuffer();
    case 'blob':
      return response.blob();
    case 'json':
    default:
      return response.json();
  }
};

const request = <T extends NotUndefined>(
  url: string,
  method: 'get' | 'post',
  options?: RequestInit,
  as?: ResponseFormat,
): Promise<Result<T, NotUndefined>> =>
  Bun.fetch(url, { ...options, method })
    .then(response => transformResponse(response, as ?? 'json'))
    .then(response => Ok(response as T))
    .catch(error => Err(error));

export const get = <T extends NotUndefined>(
  url: string,
  options?: RequestInit,
  as?: ResponseFormat,
): Promise<Result<T, NotUndefined>> => request(url, 'get', options, as);

export const post = <T extends NotUndefined>(
  url: string,
  options?: RequestInit,
  as?: ResponseFormat,
): Promise<Result<T, NotUndefined>> => request(url, 'post', options, as);
