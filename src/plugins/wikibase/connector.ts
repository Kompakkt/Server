import { join } from 'node:path';
import { Configuration } from 'src/configuration';
import { err, log, warn } from 'src/logger';
import { RootDirectory } from '../../environment';
import { WikibaseConfiguration } from './config';

type CSRFTokenResponse = {
  batchcomplete?: string;
  query: {
    tokens: {
      csrftoken: string;
    };
  };
};

const isCSRFTokenResponse = (response: unknown): response is CSRFTokenResponse => {
  if (response === null || typeof response !== 'object') return false;
  const query = (response as { query?: unknown }).query;
  if (!query || typeof query !== 'object') return false;
  const tokens = (query as { tokens?: unknown }).tokens;
  if (!tokens || typeof tokens !== 'object') return false;
  const csrftoken = (tokens as { csrftoken?: unknown }).csrftoken;
  return typeof csrftoken === 'string';
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

export class WikibaseConnector {
  private apiUrl: string;
  private oauthToken: string;
  private csrfToken: string | null = null;

  constructor(instance: string) {
    const token = WikibaseConfiguration?.OauthToken;
    if (!token) throw new Error('Wikibase OAuth token not configured');

    let url = instance;
    if (!url.endsWith('api.php')) {
      if (!url.endsWith('/')) url += '/';
      url += 'api.php';
    }

    this.apiUrl = url;
    this.oauthToken = token;
  }

  private authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.oauthToken}`, ...extra };
  }

  private async apiGet(params: Record<string, string>): Promise<unknown> {
    const url = new URL(this.apiUrl);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return await Bun.fetch(url, { headers: this.authHeaders() })
      .then(res => res.json())
      .catch(error => {
        warn(`Wikibase API GET failed: ${error}`);
        return undefined;
      });
  }

  private async apiPost(params: Record<string, string>, formData?: FormData): Promise<unknown> {
    const url = new URL(this.apiUrl);
    const headers = formData
      ? this.authHeaders()
      : this.authHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });
    let body: URLSearchParams | FormData;
    if (formData) {
      for (const [key, value] of Object.entries(params)) formData.append(key, value);
      body = formData;
    } else {
      body = new URLSearchParams(params);
    }
    return await Bun.fetch(url, { method: 'POST', headers, body })
      .then(res => res.json())
      .catch(error => {
        warn(`Wikibase API POST failed: ${error}`);
        return undefined;
      });
  }

  private async requestCsrfToken(): Promise<string | undefined> {
    const response = await this.apiGet({
      action: 'query',
      meta: 'tokens',
      type: 'csrf',
      format: 'json',
    });
    if (!isCSRFTokenResponse(response)) {
      warn('Invalid CSRF token response', response);
      return undefined;
    }
    const token = response.query.tokens.csrftoken;
    log('csrfToken', token);
    return token;
  }

  async getCsrfToken(forceRefresh = false): Promise<string | undefined> {
    if (forceRefresh || !this.csrfToken || this.csrfToken === '+\\') {
      const token = await this.requestCsrfToken();
      if (!token) return undefined;
      if (token === '+\\') {
        throw new Error('Wikibase CSRF token unavailable; check the OAuth token grants');
      }
      this.csrfToken = token;
    }
    return this.csrfToken;
  }

  public async writeAnnotation(id: string, text: string) {
    const csrfToken = await this.getCsrfToken();
    if (!csrfToken) {
      throw new Error('Failed to get CSRF token');
    }

    const response = await this.apiPost({
      action: 'edit',
      title: `Annotation:${id}`,
      text: text,
      token: csrfToken,
      format: 'json',
      ignorewarnings: '1',
    });

    if (isLinkbackResponse(response) && response.success === 1) {
      return true;
    }
    if (isEditResponse(response) && response?.edit?.result === 'Success') {
      return true;
    }
    warn(`Unknown writeAnnotation response`, response);
    err('writeAnnotation failed', response);
    return false;
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
    const blob = await Bun.readableStreamToBlob(file.stream());
    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append('filename', filename);

    const response = await this.apiPost(
      {
        action: 'upload',
        ignorewarnings: '1',
        token: csrfToken,
        format: 'json',
      },
      formData,
    );

    log('writeImage', response);
    if (!isWikibaseImageResponse(response)) {
      err('Invalid writeImage response.');
      return '';
    }

    if ('error' in response && !!response.error?.info) {
      const info = response.error.info;
      const matchedFilename = info?.match(/\[\[\:\w+\:(\w+\.\w+)\]\]/)?.at(1);
      if (matchedFilename) {
        warn(`Using duplicate file: ${info}. Filename: ${matchedFilename}`);
        return matchedFilename;
      }
      warn(`Error uploading image: ${info}`);
    } else if ('upload' in response && !!response.upload?.filename) {
      return response.upload.filename;
    }

    return undefined;
  }

  public async removeItem(id: string) {
    const csrfToken = await this.getCsrfToken();
    if (!csrfToken) {
      throw new Error('Failed to get CSRF token');
    }

    const response = await this.apiPost({
      action: 'delete',
      title: id,
      token: csrfToken,
      format: 'json',
    });

    if (response && typeof response === 'object' && 'error' in response) {
      err('removeItem', (response as { error?: unknown }).error);
      return false;
    }
    if (response && typeof response === 'object' && 'delete' in response) {
      return true;
    }
    warn('Unknown delete response', response);
    return false;
  }
}
