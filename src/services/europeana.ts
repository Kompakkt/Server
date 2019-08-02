import Axios from 'axios';

import { Configuration } from './configuration';

const Europeana = {
  getRecordData: async (record_id: string) => {
    if (
      !Configuration ||
      !Configuration.Services ||
      !Configuration.Services.Europeana
    ) {
      return new Promise<any>((_, reject) =>
        reject('Europeana missing from config'),
      );
    }

    const _endpoint = Configuration.Services.Europeana.endpoint;
    const _apikey = Configuration.Services.Europeana.apiKey;
    if (!_apikey || !_endpoint) {
      return new Promise<any>((_, reject) =>
        reject('ApiKey or Endpoint for Europeana not defined'),
      );
    }

    const _url = `${_endpoint}/${record_id}.json?wskey=${_apikey}`;
    return Axios.get(_url);
  },
};

export { Europeana };
