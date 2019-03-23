import axios from 'axios';

import { Configuration } from './configuration';

const Europeana = {
  getRecordData: (record_id: string) => {
    if (!Configuration || !Configuration.Services || !Configuration.Services.Europeana) {
      return new Promise((_, reject) => reject('Europeana missing from config'));
    }

    const _endpoint = Configuration.Services.Europeana.endpoint;
    const _apikey = Configuration.Services.Europeana.apiKey;
    if (!_apikey || !_endpoint) {
      return new Promise((_, reject) => reject('ApiKey or Endpoint for Europeana not defined'));
    }

    const _url = `${_endpoint}/${record_id}.json?wskey=${_apikey}`;
    return axios.get(_url);
  },
};

export { Europeana };
