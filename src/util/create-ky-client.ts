import ky from 'ky';
import { CookieJar } from 'tough-cookie';

export const createKyClient = (baseUrl?: string) => {
  const cookieJar = new CookieJar();
  const instance = ky.create({
    prefixUrl: baseUrl ? baseUrl : undefined,
    hooks: {
      beforeRequest: [
        async request => {
          const url = request.url;
          const cookies = await cookieJar.getCookies(url);
          const cookieString = cookies.join('; ');
          console.log('kyClient beforeRequest', { url, cookieString });
          request.headers.set('cookie', cookieString);
        },
      ],
      afterResponse: [
        async (request, options, response) => {
          const url = request.url;
          const cookies = response.headers.getSetCookie();
          let cookieString = ''
          if (cookies) {
            for (const cookie of cookies) {
              await cookieJar.setCookie(cookie, url);
              cookieString += cookie + '; ';
            }
          }
          console.log('kyClient afterResponse', { url, cookieString });
        },
      ],
    },
  });
  return instance;
};
