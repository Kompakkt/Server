import { join } from 'node:path';
import { t } from 'elysia';
import { Configuration } from 'src/configuration';
import { err, info, log } from 'src/logger';
import { RequestClient } from 'src/util/requests';
import { RootDirectory } from '../../environment';

interface TokenManager {
  loginToken: string | null;
  csrfToken: string | null;
}

type QueryTokenResponse<K extends 'logintoken' | 'csrftoken'> = {
  batchcomplete: string;
  query: {
    tokens: {
      [key in K]: string;
    };
  };
};

type LoginTokenResponse = QueryTokenResponse<'logintoken'>;
type CSRFTokenResponse = QueryTokenResponse<'csrftoken'>;

type LoginResponse = {
  login: {
    result: string;
    lguserid: number;
    lgusername: string;
  };
};

type ClientLoginResponse = {
  clientlogin:
    | {
        status: 'PASS';
        username: string;
      }
    | {
        status: 'FAIL';
        message: string;
        messagecode: string;
      };
};

type WikibaseImageResponse = {
  error?: {
    code: string;
    info?: string;
  };
  upload?: {
    result: 'Success';
    filename: string;
  };
};
const isWikibaseImageResponse = (response: unknown): response is WikibaseImageResponse => {
  if (response === null || typeof response !== 'object') return false;
  if (Object.hasOwn(response, 'error')) {
    const error = (response as WikibaseImageResponse).error;
    if (error && Object.hasOwn(error, 'code')) return true;
  }
  if (Object.hasOwn(response, 'upload')) {
    const upload = (response as WikibaseImageResponse).upload;
    if (upload && upload.result === 'Success' && Object.hasOwn(upload, 'filename')) return true;
  }
  return false;
};

export class WikibaseConnector implements TokenManager {
  private wikibaseUrl: string;
  private login: string;
  private password: string;
  private client: RequestClient;
  private requestAttempts = 0;

  loginToken: string | null;
  csrfToken: string | null;

  constructor(instance: string, credentials: { username: string; password: string }) {
    this.wikibaseUrl = instance;
    this.login = credentials.username;
    this.password = credentials.password;

    this.loginToken = null;
    this.csrfToken = null;

    this.client = new RequestClient(this.wikibaseUrl);

    this.loginRequest();
  }

  // Account management methods

  private async loginRequest() {
    const loginToken = await this.getLoginToken();
    if (!loginToken) return undefined;

    const params = {
      action: 'clientlogin',
      username: this.login,
      password: this.password,
      logintoken: loginToken,
      loginreturnurl: 'http://test',
      format: 'json',
    };

    const response: ClientLoginResponse | undefined = await this.client.post('/api.php', {
      options: {
        body: new URLSearchParams(params).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    });

    if (response?.clientlogin.status !== 'PASS') {
      err('! login failed', response);
      return undefined;
    }

    const token = await this.requestCsrfToken();
    if (!token) return undefined;
    this.csrfToken = token;
  }

  public async createAccount(username: string, password: string): Promise<unknown> {
    const csrfToken = await this.getCreateAccountToken();
    const params = {
      action: 'createaccount',
      createtoken: csrfToken,
      username: username,
      password: password,
      retype: password,
      createreturnurl: 'http://test',
      format: 'json',
    };
    const response = await this.client.post('/api.php', { params });
    return response;
  }

  private async getCreateAccountToken() {
    const params = {
      action: 'query',
      meta: 'tokens',
      type: 'createaccount',
      format: 'json',
    };

    const data = await this.client.get('/api.php', { params });
    return data.query.tokens.createaccounttoken;
  }

  // Token management methods

  private async requestLoginToken() {
    const queryLoginTokenResponse: LoginTokenResponse | undefined = await this.client.get(
      '/api.php',
      {
        params: {
          action: 'query',
          meta: 'tokens',
          type: 'login',
          format: 'json',
        },
      },
    );

    return queryLoginTokenResponse?.query.tokens.logintoken ?? undefined;
  }

  private async requestCsrfToken(): Promise<string | undefined> {
    const csfrTokenResponse: CSRFTokenResponse | undefined = await this.client.get('/api.php', {
      params: {
        action: 'query',
        meta: 'tokens',
        type: 'csrf',
        format: 'json',
      },
    });

    if (!csfrTokenResponse) {
      return undefined;
    }

    const token = csfrTokenResponse.query.tokens.csrftoken;

    if (token === '+\\') {
      log('requestCsrfToken', 'Token expired, requesting new one.');
      this.requestAttempts++;
      if (this.requestAttempts >= 5) {
        log('requestCsrfToken', 'Shutting down the application');
        process.exit(1);
      }
      await this.loginRequest();
      return this.requestCsrfToken();
    }
    this.requestAttempts = 0;
    console.log('requestCsrfToken', token);
    return token;
  }

  async refreshToken() {
    const token = await this.requestCsrfToken();
    if (!token) return false;
    this.csrfToken = token;
    return true;
  }

  async getLoginToken() {
    if (!this.loginToken) {
      const token = await this.requestLoginToken();
      if (!token) {
        return undefined;
      }
      this.loginToken = token;
    }
    return this.loginToken;
  }

  async getCsrfToken(forceRefresh = false): Promise<string> {
    if (forceRefresh || !this.csrfToken || this.csrfToken === '+\\') {
      await this.refreshToken();
    }
    console.log('csrfToken', this.csrfToken);
    return this.csrfToken as string;
  }

  // Annotation methods

  public async writeAnnotation(id: string, text: string): Promise<void> {
    const csrfToken = await this.getCsrfToken();
    const params = {
      action: 'edit',
      title: `Annotation:${id}`,
      text: text,
      token: csrfToken,
      format: 'json',
    };

    await this.client.post('/api.php', { params });
  }

  public async writeImage(id: string, img: string): Promise<string> {
    if (img !== '') {
      const csrfToken = await this.getCsrfToken();
      const filename = `Preview${id}.png`;
      const params = {
        action: 'upload',
        filename: filename,
        ignorewarnings: '1',
        token: csrfToken,
        format: 'json',
      };

      const my_img = join(RootDirectory, Configuration.Uploads.UploadDirectory, img);
      const formData = await Bun.file(my_img).formData();

      return this.client
        .post('/api.php', { params, options: { body: formData } })
        .then(response => {
          console.log('writeImage', response);
          if (!isWikibaseImageResponse(response)) {
            console.error('Invalid response received.');
            return '';
          }

          // Check if error exists and has a code property
          if (response.error?.code) {
            const info = response.error.info;
            if (info && typeof info === 'string') {
              const start = info.indexOf('[[:File:') + 8;
              const end = info.indexOf(']]');
              if (start > -1 && end > -1 && end > start) {
                const filename = info.substring(start, end);
                return filename;
              }
            }
          }
          // Check if upload result is "Success"
          else if (response.upload?.filename) {
            return response.upload.filename;
          }

          return '';
        })
        .catch(error => {
          console.log(error);
          return '';
        });
    }

    return Promise.resolve('');
  }

  // SDK query methods

  public async requestSDKquery(query: string): Promise<unknown> {
    const params = {
      action: 'wbgetentities',
      ids: query,
      format: 'json',
    };

    const data = await this.client.get('/api.php', { params });
    return data;
  }
}
