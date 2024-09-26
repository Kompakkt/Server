import axios from 'axios';
import { createReadStream } from 'fs';
import { basename } from 'path';
import { URLSearchParams } from 'url';
import WikibaseError from '../../errors/wikibase_error';
import { IWikibaseConfiguration } from '../configuration';
import { classes, properties } from './wikibase_common';
import { err, info, log } from 'src/logger';
const request = require('request');

export class Session {
  public api_url: string;
  public cookie?: string;
  public login_token?: string;
  public csrf_token?: string;

  constructor(
    public wikibase_domain: string,
    private username = 'ignored',
    private password = 'ignored',
    public debug = false,
  ) {
    this.api_url = `${wikibase_domain}/w/api.php`;
  }

  async check_token() {
    const check = await post(this, { action: 'checktoken', type: 'csrf' });
    return check?.checktoken?.result === 'valid';
  }

  async check() {
    const valid = await this.check_token();
    if (!valid) {
      info('Session expired. Logging in again.');
      try {
        const new_session = await login({
          Domain: this.wikibase_domain,
          SPARQLEndpoint: 'ignored',
          Username: this.username,
          Password: this.password,
          AdminUsername: this.username,
          AdminPassword: this.password,
        });
        this.cookie = new_session.cookie;
        this.login_token = new_session.login_token;
        this.csrf_token = new_session.csrf_token;
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  // async always_login(conf, role){
  //   if (role == 'admin') {
  //     this.username = conf.Wikibase.AdminUsername
  //     this.password = conf.Wikibase.AdminPassword
  //     info(role, 'login.')
  //     try {
  //       const new_session = await login_admin({
  //         Domain: this.wikibase_domain,
  //         SPARQLEndpoint: 'ignored',
  //         Username: this.username,
  //         Password: this.password,
  //         AdminUsername: this.username,
  //         AdminPassword: this.password,
  //       });
  //       this.cookie = new_session.cookie;
  //       this.login_token = new_session.login_token;
  //       this.csrf_token = new_session.csrf_token;
  //     } catch(e) {
  //       return false;
  //     }
  //   } else {
  //     this.username = conf.Wikibase.Username
  //     this.password = conf.Wikibase.Password
  //     info(role, 'login.')
  //     try {
  //       const new_session = await login({
  //         Domain: this.wikibase_domain,
  //         SPARQLEndpoint: 'ignored',
  //         Username: this.username,
  //         Password: this.password,
  //         AdminUsername: this.username,
  //         AdminPassword: this.password,
  //       });
  //       this.cookie = new_session.cookie;
  //       this.login_token = new_session.login_token;
  //       this.csrf_token = new_session.csrf_token;
  //     } catch(e) {
  //       return false;
  //     }
  //   }
  // }
}

export async function get(session: Session, url_params: any, update_cookie = false) {
  url_params.format = 'json';
  let headers: any = {
    'User-Agent': 'KompakktBackend/0.0',
  };
  if (session.cookie !== undefined) {
    headers.Cookie = session.cookie;
  }

  const response = await axios({
    url: session.api_url,
    method: 'get',
    params: url_params,
    headers: headers,
  }).catch(e => {
    console.log('From get: ', e.toJSON());
  });

  if (!response?.data) {
    err(`No response from ${session.api_url}`);
    return undefined;
  }
  if (response.data.error) {
    err(`Error from ${session.api_url}: ${response.data.error.info}`);
    return undefined;
  }
  // if (session.debug) {
  //     console.log(`Response with id: ${response.data.claim?.id || '-'}, success: ${response.data.success}`);
  // }

  if (update_cookie) {
    session.cookie = response.headers['set-cookie'].join(';');
  }
  return response.data;
}

export async function get_public(api_url: string, url_params: any) {
  url_params.format = 'json';
  let headers: any = {
    'User-Agent': 'KompakktBackend/0.0',
  };

  log(`URL looks like: ${api_url}`);
  const response = await axios({
    url: api_url,
    method: 'get',
    params: url_params,
    headers: headers,
  }).catch(e => {
    console.log('From get_pub: ', e.toJSON());
  });

  if (!response?.data) {
    err(`No response from ${api_url}`);
    return undefined;
  }
  if (response.data.error) {
    err(`Error from ${api_url}: ${response.data.error.info}`);
    console.error(response.data.error.messages);
    return undefined;
  }
  return response.data;
}

export async function post(
  session: Session,
  body: any,
  update_cookie = false,
  on_error: any = undefined,
) {
  body.format = 'json';
  if (session.csrf_token !== undefined) {
    body.token = session.csrf_token;
  }
  let data = new URLSearchParams(body).toString();
  // if (session.debug) {
  //   console.log(`Request: ${body.action} for (${body.entity || "x"}|${body.property || "x"}) = ${body.value}`);
  // }
  let headers: any = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
  };
  if (session.cookie !== undefined) {
    headers.Cookie = session.cookie;
  }
  // console.time('post request');
  const response = await axios.post(session.api_url, data, { headers: headers }).catch(e => {
    console.log('From post: ', e.toJSON());
  });
  // console.timeEnd('post request');
  if (!response?.data) {
    err(`No response from ${session.api_url}`);
    return undefined;
  }
  if (response.data.error) {
    if (on_error) {
      on_error(response.data.error.messages[0]);
    } else {
      console.error(response.data.error.messages);
      return undefined;
    }
  }
  // if (session.debug) {
  //   console.log(`Response with id: ${response.data.claim?.id || '-'}, success: ${response.data.success}`);
  // }

  if (update_cookie) {
    session.cookie = response.headers['set-cookie'].join(';');
  }
  return response.data;
}

export async function post2(
  session: Session,
  body: any,
  update_cookie = false,
  on_error: any = undefined,
) {
  // this function fixes an issue where the previous post instance
  // substitues a csrf token into the body, which causes issues for operations
  // which require a different kind of token (usercreate token for example).

  // cloning the entire function is a terrible solution, this needs to be cleaned up.

  body.format = 'json';
  // if (session.csrf_token !== undefined) {
  //   body.token = session.csrf_token;
  // }
  let data = new URLSearchParams(body).toString();
  // if (session.debug) {
  //   console.log(`Request: ${body.action} for (${body.entity || "x"}|${body.property || "x"}) = ${body.value}`);
  // }
  let headers: any = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
  };
  if (session.cookie !== undefined) {
    headers.Cookie = session.cookie;
  }
  // console.time('post request');
  const response = await axios.post(session.api_url, data, { headers: headers }).catch(e => {
    console.log('From post: ', e.toJSON());
  });
  // console.timeEnd('post request');
  if (!response?.data) {
    throw new WikibaseError(`No response from ${session.api_url}`);
  }
  // search evey word in response for "fail" case insensitive. response.data is an object
  // so we need to convert it to a string first.
  var responseString = JSON.stringify(response.data);
  if (responseString.match(/\bfail\b/i)) {
    throw new WikibaseError(responseString);
  }

  if (response.data.error) {
    if (on_error) {
      on_error(response.data.error.messages[0]);
    } else {
      console.error(response.data.error.messages);
      return undefined;
    }
  }
  // if (session.debug) {
  //   console.log(`Response with id: ${response.data.claim?.id || '-'}, success: ${response.data.success}`);
  // }

  if (update_cookie) {
    session.cookie = response.headers['set-cookie'].join(';');
  }
  return response.data;
}

export async function uploadStream(session: Session, stream: any, filename: string) {
  let params: any = {
    action: 'upload',
    filename,
    ignorewarnings: '1',
    format: 'json',
  };
  if (session.csrf_token !== undefined) {
    params.token = session.csrf_token;
  }

  let headers: any = {
    'Content-Type': 'multipart/form-data; charset=utf-8',
    'Content-Disposition': `form-data; filename="${filename}"`,
  };
  if (session.cookie != null) {
    headers.Cookie = session.cookie;
  }

  const formData = {
    ...params,
    file: {
      value: stream,
      options: {
        filename,
        contentType: 'image/png',
      },
    },
  };

  // no idea how to do this in axios thanks to it returning html if not urlsearchparam-encoded
  return new Promise<any>((resolve, reject) => {
    log(`Uploading ${filename} to ${session.api_url}`);
    request.post(
      { url: session.api_url, formData: formData, headers },
      function (error: any, res: any, body: any) {
        if (error) {
          err(error);
          reject(error);
        } else {
          body = JSON.parse(body);
          if (body.error != null) {
            err(body.error);
            reject(body.error);
          } else if (body.upload.result === 'Success') {
            let result = { filename: body.upload.filename };
            if (body.upload.imageinfo != null) {
              result = { ...result, ...body.upload.imageinfo };
            }
            log(`Uploaded ${filename}`);
            resolve(result);
          }
        }
      },
    );
  });
}

export async function upload(session: Session, filepath: string, filename?: string) {
  return uploadStream(session, createReadStream(filepath), filename ?? basename(filepath));
}

export async function uploadBase64(session: Session, base64: string, filename: string) {
  let res: any = undefined;
  try {
    const data = base64.replace(/^data:image\/(png|gif|jpeg);base64,/, '');
    const buffer = Buffer.from(data, 'base64');
    // const stream = Readable.from(data);
    res = await uploadStream(session, buffer, filename);
  } catch (e) {
    console.error(e);
  }
  return res;
}

async function get_login_token(session: Session): Promise<Session> {
  const response = await get(
    session,
    {
      action: 'query',
      meta: 'tokens',
      type: 'login',
    },
    true,
  );
  session.login_token = response.query.tokens.logintoken;
  return session;
}

async function get_csrf_token(session: Session): Promise<Session> {
  const response = await get(session, {
    action: 'query',
    meta: 'tokens',
    type: 'csrf',
    format: 'json',
  });
  session.csrf_token = response.query?.tokens?.csrftoken;
  return session;
}

export async function login(config: IWikibaseConfiguration): Promise<Session> {
  let session = new Session(config.Domain, config.Username, config.Password);
  session = await get_login_token(session);

  let body: any = {
    action: 'login',
    lgname: config.Username,
    lgpassword: config.Password,
    lgtoken: session.login_token,
  };
  const response = await post(session, body, true);
  if (response && response.login && response.login.result === 'Success') {
    session = await get_csrf_token(session);
    return session;
  }
  return session;
}

// export async function
// login_admin(config : IWikibaseConfiguration) : Promise<Session> {
//     let session = new Session(config.Domain, config.AdminUsername, config.AdminPassword);
//     session = await get_login_token(session);

//     let body : any = {
//         action: 'login',
//         lgname: config.AdminUsername,
//         lgpassword: config.AdminPassword,
//         lgtoken: session.login_token,
//     };
//     const response = await post(session, body, true);
//     if (response && response.login && response.login.result === 'Success') {
//         session = await get_csrf_token(session);
//         return session;
//     }
//     return session;
// }

export async function login_admin(config: IWikibaseConfiguration): Promise<Session> {
  let session = new Session(config.Domain, config.AdminUsername, config.AdminPassword);
  session = await get_login_token(session);

  let body: any = {
    action: 'login',
    lgname: config.AdminUsername,
    lgpassword: config.AdminPassword,
    lgtoken: session.login_token,
  };
  const response = await post(session, body, true);
  if (response && response.login && response.login.result === 'Success') {
    session = await get_csrf_token(session);
    return session;
  }
  return session;
}

export async function remove_page(session: Session, title: string) {
  let body: any = {
    action: 'delete',
    title: title,
  };
  return post(session, body);
}

export async function create_base_item(session: Session, data: any) {
  let body: any = {
    action: 'wbeditentity',
    new: 'item',
    summary: 'autogenerated by bot',
    bot: '1',
    data: JSON.stringify(data),
  };
  return post(session, body);
}

export async function edit_base_item(session: Session, item_id: string, data: any) {
  let body: any = {
    action: 'wbeditentity',
    id: item_id,
    summary: 'autogenerated by bot',
    bot: '1',
    data: JSON.stringify(data),
  };
  return post(session, body);
}

export async function create_item(
  session: Session,
  label: string,
  description?: string,
  alias?: string,
) {
  let data: any = {
    labels: {
      en: {
        language: 'en',
        value: label,
      },
    },
  };
  if (description !== undefined) {
    data.descriptions = {
      en: {
        language: 'en',
        value: description,
      },
    };
  }
  if (alias !== undefined) {
    data.aliases = {
      en: {
        language: 'en',
        value: alias,
      },
    };
  }
  return create_base_item(session, data);
}

export async function edit_item(
  session: Session,
  item_id: string,
  label: string,
  description?: string,
  alias?: string,
) {
  let data: any = {
    labels: {
      en: {
        language: 'en',
        value: label,
      },
    },
  };
  if (description !== undefined) {
    data.descriptions = {
      en: {
        language: 'en',
        value: description,
      },
    };
  }
  if (alias !== undefined) {
    data.aliases = {
      en: {
        language: 'en',
        value: alias,
      },
    };
  }
  return edit_base_item(session, item_id, data);
}

export async function create_claim(
  session: Session,
  subject: string,
  predicate: string,
  object: any,
) {
  let body: any = {
    action: 'wbcreateclaim',
    entity: subject,
    property: predicate,
    snaktype: object.type,
  };
  if (object.type === 'value') {
    body.value = object.value;
  }
  const res = await post(session, body);
  return res.claim.id;
}

export async function edit_claim(
  session: Session,
  claim_id: string,
  predicate: string,
  object: any,
) {
  let body: any = {
    action: 'wbsetclaim',
    claim: {
      id: claim_id,
      type: 'claim',
      mainsnak: {
        snaktype: object.type,
        property: predicate,
      },
    },
  };
  if (object.type === 'value') {
    body.claim.mainsnak.datavalue = object.value;
  }
  body.claim = JSON.stringify(body.claim);
  const res = await post(session, body);
  return res.claim.id;
}

export async function remove_claim(session: Session, claim_id: string) {
  let body: any = {
    action: 'wbremoveclaims',
    claim: claim_id,
  };

  await post(session, body, false, (err: any) => {
    if (err.name === 'wikibase-api-invalid-guid') {
      console.error(`Unable to delete claim with GUID ${claim_id}. Claim does not exist.`);
    }
  });
}

export async function remove_qualifier(session: Session, claim_id: string, qualifier_id: string) {
  let body: any = {
    action: 'wbremovequalifiers',
    claim: claim_id,
    qualifiers: qualifier_id,
  };

  await post(session, body, false, (err: any) => {
    if (err.name === 'wikibase-api-invalid-guid') {
      console.error(
        `Unable to delete qualifier with claim GUID ${claim_id} and qualifier GUID ${qualifier_id}. Qualifiert does not exist.`,
      );
    }
  });
}

export async function create_item_claim(
  session: Session,
  subject: string,
  predicate: string,
  entity_id: number,
) {
  let data: any = {
    'entity-type': 'item',
    'numeric-id': entity_id,
  };

  const claim_id = await create_claim(session, subject, predicate, {
    type: 'value',
    value: JSON.stringify(data),
  });
  return claim_id;
}

export async function upsert_item_claim(
  session: Session,
  subject: string,
  predicate: string,
  entity_id: number,
  claim_id?: string,
) {
  if (claim_id === undefined) {
    return create_claim(session, subject, predicate, {
      type: 'value',
      value: JSON.stringify({
        'entity-type': 'item',
        'numeric-id': entity_id,
      }),
    });
  } else {
    return edit_claim(session, claim_id, predicate, {
      type: 'value',
      value: {
        value: {
          'entity-type': 'item',
          'numeric-id': entity_id,
        },
        type: 'wikibase-entityid',
      },
    });
  }
}

export async function create_string_claim(
  session: Session,
  subject: string,
  predicate: string,
  value: string,
) {
  return create_claim(session, subject, predicate, { type: 'value', value: `"${value}"` });
}

// export async function
// edit_string_claim(session : Session,
//                   claim_id : string,
//                   predicate : string,
//                   value : string) {
//     return edit_claim(session, claim_id, predicate, {
//       type: 'value',
//       value: { value: value, type: "string" }
//     });
// }

export async function upsert_string_claim(
  session: Session,
  subject: string,
  predicate: string,
  value: string,
  claim_id?: string,
) {
  if (claim_id === undefined) {
    return create_claim(session, subject, predicate, { type: 'value', value: `"${value}"` });
  } else {
    return edit_claim(session, claim_id, predicate, {
      type: 'value',
      value: { value: value, type: 'string' },
    });
  }
}

export async function create_quantity_claim(
  session: Session,
  subject: string,
  predicate: string,
  amount: number,
  unit: string = '1',
  lower_bound?: number,
  upper_bound?: number,
) {
  let data: string = JSON.stringify({
    amount,
    unit,
    lower_bound,
    upper_bound,
  });

  return create_claim(session, subject, predicate, { type: 'value', value: data });
}

export async function upsert_quantity_claim(
  session: Session,
  subject: string,
  predicate: string,
  amount: number,
  claim_id?: string,
  unit: string = '1',
  lower_bound?: number,
  upper_bound?: number,
) {
  if (claim_id === undefined) {
    return create_claim(session, subject, predicate, {
      type: 'value',
      value: JSON.stringify({
        amount,
        unit,
        lower_bound,
        upper_bound,
      }),
    });
  } else {
    return edit_claim(session, claim_id, predicate, {
      type: 'value',
      value: {
        value: {
          amount,
          unit,
          lower_bound,
          upper_bound,
        },
        type: 'quantity',
      },
    });
  }
}

export async function create_claim_qualifier(
  session: Session,
  claim_guid: string,
  predicate: string,
  entity_id: number,
) {
  let data: any = {
    'entity-type': 'item',
    'numeric-id': entity_id,
  };
  let body: any = {
    action: 'wbsetqualifier',
    claim: claim_guid,
    property: predicate,
    snaktype: 'value',
    value: JSON.stringify(data),
  };
  const res = await post(session, body);
  const qualifiers = res.claim.qualifiers[predicate];
  return qualifiers.find((q: any) => q.datavalue.value['numeric-id'] == entity_id)?.hash;
}

export async function edit_claim_qualifier(
  session: Session,
  claim_guid: string,
  predicate: string,
  entity_id: number,
  qualifier_id?: string,
) {
  let data: any = {
    'entity-type': 'item',
    'numeric-id': entity_id,
  };
  let body: any = {
    action: 'wbsetqualifier',
    claim: claim_guid,
    property: predicate,
    value: JSON.stringify(data),
  };
  if (qualifier_id !== undefined) {
    body.snakhash = qualifier_id;
  } else {
    body.snaktype = 'value';
  }
  const res = await post(session, body);
  const qualifiers = res.claim.qualifiers[predicate];
  return qualifiers.find((q: any) => q.datavalue.value['numeric-id'] == entity_id)?.hash;
}

export async function create_person(
  session: Session,
  name: string,
  description?: string,
  alias?: string,
) {
  const person = await create_item(session, name, description, alias);
  if (person.success === 1) {
    await create_item_claim(session, person.entity?.id, properties.instance_of, classes.human);
  }
  return person.entity;
}

export async function create_media_item(
  session: Session,
  name: string,
  description?: string,
  alias?: string,
) {
  const item = await create_item(session, name, description, alias);
  if (item.success === 1) {
    await create_item_claim(session, item.entity?.id, properties.instance_of, classes.media);
  }
  return item.entity;
}

export async function create_description_page(
  session: Session,
  item_id: number,
  description: string,
) {
  let body: any = {
    action: 'edit',
    title: `Annotation:Q${item_id}`,
    text: description,
    summary: 'autogenerated by bot',
    bot: '1',
    recreate: '1',
    minor: '',
    notminor: '',
    //createonly: "",
  };
  return post(session, body);
}

export async function get_annotation_description(session: Session, annotationId: string) {
  const response = await get(
    session,
    {
      action: 'parse',
      page: `Annotation:${annotationId}`,
      prop: 'wikitext',
    },
    false,
  );
  return response;
}

export async function get_direct_image_link(wikibase_domain: string, filename: string) {
  const url = `${wikibase_domain}/w/index.php?title=Special:Redirect/file/${filename}`;
  const response = await axios.get(url);
  return response.request.res.responseUrl;
}
