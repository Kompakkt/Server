import { warn } from 'src/logger';

export class WBErrorHandler {
  // Utility to safely stringify objects with circular references
  safeStringify = (obj: any, indent = 2) => {
    let cache: any = [];
    const retVal = JSON.stringify(
      obj,
      (key, value) => {
        if (typeof value === 'object' && value !== null) {
          // Duplicate reference found, discard key
          if (cache.includes(value)) return;

          // Store value in our collection
          cache.push(value);
        }
        return value;
      },
      indent,
    );
    cache = null; // Enable garbage collection

    return retVal;
  };

  handleRequestError = (error: any) => {
    try {
      const errorDetails = error.request
        ? {
            errorMessage: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            url: error.config.url,
            data: error.response?.data,
            headers: error.response?.headers,
          }
        : {
            errorMessage: error.message,
          };
      // Using safeStringify instead of JSON.stringify to avoid circular structure issues
      this.logAndThrow(
        `WB: request failed, no response received: ${JSON.stringify(errorDetails, null, 2)}`,
        'Request failed, no response received',
      );
    } catch (e) {
      // Additional error logging can go here
      console.error('An exception occurred while trying to log the error:', e);
    }
  };

  logAndThrow = (logMessage: string, errorMessage: string) => {
    warn(logMessage);
    throw new Error(errorMessage);
  };

  handleError = (error: any) => {
    if (error.request) {
      this.handleRequestError(error);
    } else {
      this.logAndThrow(
        `WB: request failed, error message: ${error.message}`,
        `Request failed, error message: ${error.message}`,
      );
    }
  };
}

export class WBResponseErrorHandler {
  response: any;
  handlers: Record<string, () => void>;

  constructor(response: any) {
    this.response = response;
    this.handlers = {
      '<!DOCTYPE html>': this.handleHTMLResponse,
      'badtoken': this.handleBadToken,
      'fileexsists-no-change': this.handleFileExists,
    };
  }

  handleHTMLResponse = () => {
    warn('WB: request failed, response is HTML');
    throw new Error('Invalid response, request is most probably malformed');
  };

  handleBadToken = () => {
    warn('WB: request failed, token is invalid');
    throw new Error('Invalid token, request is most probably malformed');
  };

  handleFileExists = () => {
    warn('WB: request failed, file already exists');
    throw new Error('File already exists');
  };

  validate() {
    if (this.response.data?.error?.code) {
      const code = this.response.data?.error?.code;
      if (code in this.handlers) {
        this.handlers[code]();
      }
    } else if (this.response.data.toString().startsWith('<!DOCTYPE html>')) {
      this.handleHTMLResponse();
    }
  }
}
