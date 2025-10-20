import type { KyInstance } from 'ky';
import { join } from 'node:path';
import { Configuration } from 'src/configuration';
import { err, log, warn } from 'src/logger';
import { createKyClient } from 'src/util/create-ky-client';
import { RootDirectory } from '../../environment';

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

export class WikibaseConnector {
  private wikibaseUrl: string;
  private login: string;
  private password: string;
  private client: KyInstance;
  private requestAttempts = 0;

  loginToken: string | null;
  csrfToken: string | null;

  constructor(instance: string, credentials: { username: string; password: string }) {
    if (!instance.endsWith('api.php')) {
      if (!instance.endsWith('/')) instance += '/';
      instance += 'api.php';
    }

    this.wikibaseUrl = instance;
    this.login = credentials.username;
    this.password = credentials.password;

    this.loginToken = null;
    this.csrfToken = null;

    this.client = createKyClient();

    this.loginRequest();
  }

  // Account management methods

  private async loginRequest() {
    const loginToken = await this.getLoginToken();
    if (!loginToken) return undefined;

    const url = new URL(this.wikibaseUrl);
    const params = new URLSearchParams();
    params.set('action', 'clientlogin');
    params.set('username', this.login);
    params.set('password', this.password);
    params.set('logintoken', loginToken);
    params.set('loginreturnurl', 'http://test');
    params.set('format', 'json');

    const response = await this.client
      .post<ClientLoginResponse>(url, {
        body: params,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .then(response => response.json())
      .catch(error => {
        err('Login request failed', error);
        return undefined;
      });
    if (!response) return undefined;

    if (response?.clientlogin.status !== 'PASS') {
      err('! login failed', response);
      return undefined;
    }

    const token = await this.requestCsrfToken();
    if (!token) return undefined;
    this.csrfToken = token;
  }

  // Token management methods

  private async requestLoginToken() {
    const url = new URL(this.wikibaseUrl);
    url.searchParams.set('action', 'query');
    url.searchParams.set('meta', 'tokens');
    url.searchParams.set('type', 'login');
    url.searchParams.set('format', 'json');

    const queryLoginTokenResponse = await this.client
      .get<LoginTokenResponse>(url)
      .then(response => response.json())
      .catch(error => {
        warn(`Failed getting wikibase login token: ${error}`);
        return undefined;
      });

    return queryLoginTokenResponse?.query.tokens.logintoken ?? undefined;
  }

  private async requestCsrfToken(): Promise<string | undefined> {
    const url = new URL(this.wikibaseUrl);
    url.searchParams.set('action', 'query');
    url.searchParams.set('meta', 'tokens');
    url.searchParams.set('type', 'csrf');
    url.searchParams.set('format', 'json');
    const csfrTokenResponse = await this.client
      .get<CSRFTokenResponse>(url)
      .then(response => response.json())
      .catch(error => {
        warn(`Failed getting wikibase CSRF token: ${error}`);
        return undefined;
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

    const url = new URL(this.wikibaseUrl);
    const formData = new FormData();
    formData.append('ignorewarnings', '1');
    formData.append('title', `Annotation:${id}`);
    formData.append('text', text);
    formData.append('token', csrfToken);
    formData.append('action', 'edit');
    formData.append('format', 'json');

    return await this.client
      .post(url, { body: formData })
      .then(response => response.json())
      .then(response => {
        if (isLinkbackResponse(response) && response.success === 1) {
          return true;
        }
        if (isEditResponse(response) && response?.edit?.result === 'Success') {
          return true;
        }
        warn(`Unknown response type ${response}`);
        throw new Error('Failed to write annotation');
      })
      .catch(error => {
        err('writeAnnotation', error);
        return false;
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

    const url = new URL(this.wikibaseUrl);
    const formData = new FormData();
    const blob = await Bun.readableStreamToBlob(file.stream());
    formData.append('file', blob, filename);
    formData.append('filename', filename);
    formData.append('ignorewarnings', '1');
    formData.append('token', csrfToken);
    formData.append('action', 'upload');
    formData.append('format', 'json');

    return this.client
      .post(url, { body: formData })
      .then(response => response.json())
      .then(response => {
        log('writeImage', response);
        if (!isWikibaseImageResponse(response)) {
          err('Invalid response received.');
          return '';
        }

        // Check if error exists and has a code property
        if ('error' in response && !!response.error?.info) {
          const info = response.error.info;
          const filename = response.error.info?.match(/\[\[\:\w+\:(\w+\.\w+)\]\]/)?.at(1);
          if (filename) {
            warn(`Using duplicate file: ${info}. Filename: ${filename}`);
            return filename;
          } else {
            warn(`Error uploading image: ${info}`);
          }
        }
        // Check if upload result is "Success"
        else if ('upload' in response && !!response.upload?.filename) {
          return response.upload.filename;
        }

        return undefined;
      })
      .catch(error => {
        log(error);
        return undefined;
      });
  }
}
