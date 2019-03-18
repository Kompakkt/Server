import { Configuration } from './configuration';
import axios from 'axios';

const Europeana = {
  getRecordData: (record_id: string) => {
    const _endpoint = Configuration.Services.Europeana.endpoint;
    const _apikey = Configuration.Services.Europeana.apiKey;
    if (!_apikey || !_endpoint) {
      console.error('ApiKey or Endpoint for Europeana not defined');
      throw new Error('ApiKey or Endpoint for Europeana not defined');
    }
    const _url = `${_endpoint}/${record_id}.json?wskey=${_apikey}`;
    return axios.get(_url);
  }
};

export { Europeana };
