import { info } from "src/logger";

type ResponseFormat = 'json' | 'text' | 'blob' | 'arrayBuffer';

type RequestOptions = {
  params?: Record<string, string>;
  options?: RequestInit;
  responseFormat?: ResponseFormat;
  cookieJar?: CookieJar;
};

class CookieJar {
  readonly #map = new Map<string, string>();

  append(cookies: string[]) {
    for (const cookie of cookies) {
      const [key] = cookie.split('=');
      this.#map.set(key, cookie);
    }
  }

  toCookieString() {
    return Array.from(this.#map.values()).join('; ');
  }
}

const defaultCookieJar = new CookieJar();

export class RequestClient {
  readonly #baseUrl: string;
  readonly #cookieJar = new CookieJar();

  constructor(baseUrl: string) {
    this.#baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  get(path: string, obj: Omit<RequestOptions, 'cookieJar'>) {
    return get(this.#baseUrl + path, { ...obj, cookieJar: this.#cookieJar });
  }

  post(path: string, obj: Omit<RequestOptions, 'cookieJar'>) {
    return post(this.#baseUrl + path, { ...obj, cookieJar: this.#cookieJar });
  }

  get cookieJar() {
    return this.#cookieJar.toCookieString();
  }
}

const request = (method: string, url: string, obj: RequestOptions) => {
  const options = obj.options || {};
  const cookieJar = obj.cookieJar || defaultCookieJar;
  const responseFormat = obj.responseFormat || 'json';
  const urlObj = new URL(url);
  for (const [key, value] of Object.entries(obj.params || {})) {
    urlObj.searchParams.set(key, value.toString());
  }
  url = urlObj.toString();
  info(`Making ${method} request to ${url}`, obj);
  return Bun.fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      Cookie: cookieJar.toCookieString(),
    },
    method,
  }).then(response => {
    cookieJar.append(response.headers.getSetCookie());
    switch (responseFormat) {
      case 'blob':
        return response.blob();
      case 'arrayBuffer':
        return response.arrayBuffer();
      case 'text':
        return response.text();
      case 'json':
      default:
        return response.json();
    }
  })
};

export const get = (url: string, obj: RequestOptions) => request('get', url, obj);

export const post = (url: string, obj: RequestOptions) => request('post', url, obj);
