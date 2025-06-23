import { join } from 'node:path';
import { t } from 'elysia';
import { Configuration } from 'src/configuration';
import { err, info, log, warn } from 'src/logger';
import { RequestClient } from 'src/util/requests';
import { RootDirectory } from '../../environment';
import { CacheClient } from 'src/redis';

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

type LinkbackResponse = {
  success: number;
};
const isLinkbackResponse = (response: unknown): response is LinkbackResponse => {
  if (response === null || typeof response !== 'object') return false;
  return 'success' in response && typeof (response as LinkbackResponse).success === 'number';
};

type EditResponse = {
  edit?: {
    result?: 'Success' | 'Failure';
    title?: string;
    newrevid?: number;
    newtimestamp?: string;
  };
};

const isEditResponse = (response: unknown): response is EditResponse => {
  if (response === null || typeof response !== 'object') return false;
  const edit = (response as EditResponse).edit;
  return (
    edit !== undefined &&
    typeof edit.result === 'string' &&
    (edit.result === 'Success' || edit.result === 'Failure')
  );
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

const { DBOffset: offset } = Configuration.Redis;

export class WikibaseConnector implements TokenManager {
  private wikibaseUrl: string;
  private login: string;
  private password: string;
  private client: RequestClient;
  private requestAttempts = 0;

  loginToken: string | null;
  csrfToken: string | null;

  constructor(instance: string, credentials: { username: string; password: string }) {
    if (!instance.startsWith('http')) {
      instance = `http://${instance}`;
    }

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
    const queryLoginTokenResponse: LoginTokenResponse | undefined = await this.client
      .get('/api.php', {
        params: {
          action: 'query',
          meta: 'tokens',
          type: 'login',
          format: 'json',
        },
      })
      .catch(error => {
        warn(`Failed getting wikibase login token: ${error}`);
        return undefined;
      });

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
    log('requestCsrfToken', token);
    return token;
  }

  async refreshToken() {
    const token = await this.requestCsrfToken();
    if (!token) return undefined;
    this.csrfToken = token;
    return token;
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

  async getCsrfToken(forceRefresh = false): Promise<string | undefined> {
    if (forceRefresh || !this.csrfToken || this.csrfToken === '+\\') {
      const token = await this.refreshToken();
      if (!token) {
        return undefined;
      }
      this.csrfToken = token;
    }
    log('csrfToken', this.csrfToken);
    return this.csrfToken;
  }

  // Annotation methods

  public async writeAnnotation(id: string, text: string) {
    const csrfToken = await this.getCsrfToken();
    if (!csrfToken) {
      throw new Error('Failed to get CSRF token');
    }

    const formData = new FormData();
    formData.append('ignorewarnings', '1');
    formData.append('title', `Annotation:${id}`);
    formData.append('text', text);
    formData.append('token', csrfToken);
    formData.append('action', 'edit');
    formData.append('format', 'json');

    return await this.client
      .post('/api.php', {
        options: {
          body: formData,
        },
      })
      .then(response => {
        if (isLinkbackResponse(response) && response.success === 1) {
          return true;
        }
        if (isEditResponse(response) && response?.edit?.result === 'Success') {
          return true;
        }
        warn(`Unknown response type ${response}`);
        throw new Error('Failed to write annotation');
      });
  }

  public async writeImage(id: string, path: string) {
    if (!path) return undefined;

    const csrfToken = await this.getCsrfToken();
    if (!csrfToken) {
      throw new Error('Failed to get CSRF token');
    }

    const file = Bun.file(join(RootDirectory, Configuration.Uploads.UploadDirectory, path));
    const extension = path.split('.').pop();
    const filename = `Preview${id}.${extension}`;

    const formData = new FormData();
    const blob = await Bun.readableStreamToBlob(file.stream());
    formData.append('file', blob, filename);
    formData.append('filename', filename);
    formData.append('ignorewarnings', '1');
    formData.append('token', csrfToken);
    formData.append('action', 'upload');
    formData.append('format', 'json');

    return this.client
      .post('/api.php', {
        options: {
          body: formData,
        },
      })
      .then(response => {
        log('writeImage', response);
        if (!isWikibaseImageResponse(response)) {
          err('Invalid response received.');
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

        return undefined;
      })
      .catch(error => {
        log(error);
        return undefined;
      });
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
