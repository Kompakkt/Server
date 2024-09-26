import axios from 'axios';
import { properties, classes, values, WikibaseID } from './wikibase_common';
import { Session, get_annotation_description, get_direct_image_link } from './wikibase_api';
import { log } from 'src/logger';

export async function get(wikibase_sparql_endpoint: string, query: string) {
  const url = `${wikibase_sparql_endpoint}?query=${encodeURIComponent(query)}`;
  let headers: any = {
    'User-Agent': 'KompakktBackend/0.0',
  };
  const response = await axios({
    url: url,
    method: 'get',
    headers: headers,
  }).catch(error => {
    log(`Error while fetching ${url}: ${error}`);
    throw error;
  });

  if (!response.data) {
    log(`Response: ${JSON.stringify(response)}`);
    return undefined;
  }
  if (response.data.error) {
    console.error(response.data.error.messages.response);
    return undefined;
  }

  return response.data;
}

function format_select(wikibase_domain: string, outputs: string, expressions: string[]) {
  let query = `
        PREFIX schema: <http://schema.org/>
        SELECT ${outputs} WHERE \{
    `;

  for (const exp of expressions) query += exp + '.\n';

  query += '}';

  return query;
}

export async function list_concepts(
  wikibase_domain: string,
  wikibase_sparql_endpoint: string,
): Promise<IWikibaseItem[]> {
  let query = format_select(wikibase_domain, '?concept ?conceptLabel ?conceptDescription', [
    // `?class tibt:P1/tibt:P2* tib:Q4`,
    // `?concept tibt:P1/tibt:P2* ?class`,
    `?concept tibt:P1/tibt:P2* tib:Q29`,
    `SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }`,
  ]);
  let response = await get(wikibase_sparql_endpoint, query);
  return response.results.bindings.map((item: any) => {
    const id = item.concept.value;
    const label = item.conceptLabel?.value;
    const description = item.conceptDescription?.value ?? '';
    return {
      id,
      internalID: id,
      label: { en: label },
      description,
    } as IWikibaseItem;
  });
}

export async function list_media_items(
  wikibase_domain: string,
  wikibase_sparql_endpoint: string,
): Promise<IWikibaseItem[]> {
  let query = format_select(wikibase_domain, '?medium ?mediumLabel ?mediumDescription ?thumb', [
    `?medium tibt:${properties.instance_of} tib:Q${classes.media}`,
    `?medium tibt:${properties.image} ?thumb`,
    `SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }`,
  ]);
  log('Wikibase query: ' + query);
  let response = await get(wikibase_sparql_endpoint, query).catch((error: any) => {
    log('Wikibase query failed: ' + error);
  });
  log('Wikibase response: ' + JSON.stringify(response));
  let items: IWikibaseItem[] = [];
  for (const item of response.results.bindings) {
    let thumb = item.thumb?.value;
    if (thumb) {
      const filename = new URL(thumb).pathname.match(/File[:](.+)/);
      if (filename) {
        log('Wikibase filename: ' + filename[1]);
        thumb = await get_direct_image_link(wikibase_domain, filename[1]);
        log('Wikibase thumb: ' + thumb);
      }
    }
    // get Q number http://wikibase.svc/entity/Q671 -> Q671
    // take everything after last slash
    const id = item.medium.value.split('/').pop();
    const digitalentity = await Repo.digitalentity.findOne({ wikibase_id: id });
    if (digitalentity) {
      // query with a mongoDB Filter
      const entities = await Repo.entity.findAll();
      // for each entity, check if it is a child of the digital entity
      let entity: IEntity | undefined;
      for (const e of entities) {
        if (e.relatedDigitalEntity._id.toString() === digitalentity._id.toString()) {
          entity = e;
          break;
        }
      }
      console.log('Found entity: ' + JSON.stringify(entity));
      if (entity) {
        items.push({
          id: item.medium.value,
          internalID: entity._id,
          label: { en: item.mediumLabel?.value },
          description: item.mediumDescription?.value ?? '',
          media: thumb,
        } as IWikibaseItem);
      }
    }
  }
  return items;
}

export async function list_items_of_classes(
  wikibase_domain: string,
  wikibase_sparql_endpoint: string,
  class_ids: number[],
): Promise<{ [key: number]: IWikibaseItem[] }> {
  const instances_of = class_ids
    .map(id => `{?s tibt:${properties.instance_of} tib:Q${id}}`)
    .join(' UNION ');
  let query = format_select(wikibase_domain, '?s ?iid ?label ?desc ?class', [
    `{${instances_of}}`,
    // these two lines would be language filtered versions of the two lines below them
    // `OPTIONAL { ?s rdfs:label ?label. FILTER (langMatches( lang(?label), "en" )) }`,
    // `OPTIONAL { ?s schema:description ?desc. FILTER ( lang(?desc) = "en" ) }`,
    `OPTIONAL { ?s rdfs:label ?label }`,
    `OPTIONAL { ?s schema:description ?desc }`,
    `OPTIONAL { ?s tibt:${properties.internalID} ?iid }`,
    // the instance is fixed for the specified classes above,
    // but I don't know how else we can get the class ID
    // below to reorder items
    `OPTIONAL { ?s tibt:${properties.instance_of} ?class }`,
  ]);
  let response = await get(wikibase_sparql_endpoint, query);
  let mapped: { [key: number]: { [key: string]: IWikibaseItem } } = {};
  for (const item of response.results.bindings) {
    const id = item.s.value;
    const iid = item.iid?.value;
    const [item_class] = new URL(item.class?.value).pathname.split('/').slice(-1);
    const class_id = parseInt(item_class.slice(1));
    const label = item.label?.value;
    const description = item.desc?.value;
    let lang = 'en';
    if (item.label !== undefined && item.label['xml:lang'] !== undefined) {
      lang = item.label['xml:lang'];
    }
    if (mapped[class_id] === undefined) {
      mapped[class_id] = {};
    }
    if (mapped[class_id][id] === undefined) {
      mapped[class_id][id] = {
        id,
        internalID: iid,
        label: {},
        description,
      };
    }
    mapped[class_id][id].label[lang] = label;
  }

  let result: { [key: number]: IWikibaseItem[] } = {};
  for (const cid in mapped) {
    result[cid] = Object.values(mapped[cid]);
  }
  return result;
}

export async function list_items_of_class(
  wikibase_domain: string,
  wikibase_sparql_endpoint: string,
  class_id: number,
): Promise<IWikibaseItem[]> {
  let query = format_select(
    wikibase_domain,
    '?item ?itemLabel ?itemDescription ?iid ?label ?desc',
    [
      `?item tibt:${properties.instance_of} tib:Q${class_id}`,
      `SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }`,
    ],
  );

  let response = await get(wikibase_sparql_endpoint, query);
  let mapped: { [key: string]: IWikibaseItem } = {};
  return response.results.bindings.map(item => {
    // this string formatting would not be required for production
    // instances where domain and sparql namespace are the same.

    let desc_domain = Configuration.Wikibase?.Public;
    let url = new URL(item.item.value);
    let url_string: string = desc_domain + url.pathname;

    const res: IWikibaseItem = {
      id: url_string,
      internalID: url_string,
      label: { en: item.itemLabel.value },
      description: item.itemDescription?.value,
    };
    return res;
  });
}

export async function list_building_item_classes(
  wikibase_domain: string,
  wikibase_sparql_endpoint: string,
): Promise<number[]> {
  let query = format_select(wikibase_domain, '?parts ?partsLabel', [
    `tib:Q${classes.buildingEnsemble} tibt:${properties.hasPart}* ?parts`,
    `SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }`,
  ]);
  let response = await get(wikibase_sparql_endpoint, query);
  let class_ids: number[] = [];
  for (const item of response.results.bindings) {
    const [item_class] = new URL(item.parts?.value).pathname.split('/').slice(-1);
    const class_id = parseInt(item_class.slice(1));
    class_ids.push(class_id);
  }
  return class_ids;
}

export async function get_media_item_property(
  wikibase_domain: string,
  wikibase_sparql_endpoint: string,
  id: string,
  property: string,
): Promise<IWikibaseItem[]> {
  let query = format_select(wikibase_domain, '?item ?itemLabel', [
    `tib:${id} tibt:${property} ?item`,
    `SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }`,
  ]);
  let response = await get(wikibase_sparql_endpoint, query);
  return response.results.bindings.map((res: any) => {
    return {
      id: res.item.value,
      label: { en: res.itemLabel.value },
      description: res.itemLabel.value,
    } as IWikibaseItem;
  });
}

export async function get_media_qualified_item_property(
  wikibase_domain: string,
  wikibase_sparql_endpoint: string,
  id: string,
  property: string,
  qualifier: string,
): Promise<IWikibaseItem[][]> {
  let query = format_select(wikibase_domain, '?item ?itemLabel ?qual ?qualLabel', [
    `tib:${id} tibp:${property} [tibps:${property} ?item; tibpq:${qualifier} ?qual]`,
    `SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }`,
  ]);
  let response = await get(wikibase_sparql_endpoint, query);
  return response.results.bindings.map((res: any) => {
    const qualID = new WikibaseID(res.qual.value).itemID;
    return [
      {
        id: res.item.value,
        label: { en: res.itemLabel.value },
        description: res.itemLabel.value,
      } as IWikibaseItem,
      {
        id: qualID,
        label: { en: res.qualLabel.value },
        description: res.qualLabel.value,
      } as IWikibaseItem,
    ];
  });
}

export async function get_media_string_property(
  wikibase_domain: string,
  wikibase_sparql_endpoint: string,
  id: string,
  property: string,
): Promise<string[]> {
  let query = format_select(wikibase_domain, '?item', [`tib:${id} tibt:${property} ?item`]);
  let response = await get(wikibase_sparql_endpoint, query);
  return response.results.bindings.map((res: any) => res.item.value);
}

export async function get_media_item_metadata(
  wikibase_domain: string,
  wikibase_sparql_endpoint: string,
  id: string,
): Promise<IDigitalEntityWikibase | undefined> {
  let query = format_select(wikibase_domain, '?desc ?label ?licence ?date', [
    `tib:${id} schema:description ?desc`,
    `tib:${id} tibt:${properties.license} ?licence`,
    `OPTIONAL { tib:${id} rdfs:label ?label }`, //,
    //`OPTIONAL { tib:${id} tibt:${properties.dateModified} ?date }`,
  ]);
  let response = await get(wikibase_sparql_endpoint, query);
  if (response.results.bindings.length === 0) {
    return undefined;
  }
  const desc = response.results.bindings[0].desc.value;
  const licence = new WikibaseID(response.results.bindings[0].licence.value).numericID;
  let label = '';
  if (response.results.bindings[0].label !== undefined) {
    label = response.results.bindings[0].label.value;
  }
  let creationDate = undefined;
  if (response.results.bindings[0].date !== undefined) {
    creationDate = response.results.bindings[0].date.value;
  }
  const agent_items = await get_media_qualified_item_property(
    wikibase_domain,
    wikibase_sparql_endpoint,
    id,
    properties.relatedAgents,
    properties.role,
  );
  const agents = agent_items.map(([agent, role]) => {
    return {
      ...agent,
      role: parseInt(role.id.slice(1)),
      roleTitle: role.label['en'],
    } as IMediaAgent;
  });

  const prop = async p => {
    return get_media_item_property(wikibase_domain, wikibase_sparql_endpoint, id, p);
  };
  const sprop = async p => {
    return get_media_string_property(wikibase_domain, wikibase_sparql_endpoint, id, p);
  };
  const techniques = await prop(properties.technique);
  const software = await prop(properties.software);
  const physicalObjs = await prop(properties.objectOfRepresentation);
  const bibliographicRefs = await prop(properties.bibliographicRef);
  const externalLinks = await sprop(properties.externalLink);
  const equipment = await sprop(properties.equipment);
  let hierarchies: IMediaHierarchy[] = [];
  for (const obj of physicalObjs) {
    const hierarchy = await get_part_hierarchy(
      wikibase_domain,
      wikibase_sparql_endpoint,
      new WikibaseID(obj.id).itemID,
    );
    if (hierarchy?.parents?.length > 0 || hierarchy?.siblings?.length > 0) {
      hierarchies.push({ ...hierarchy });
    }
  }
  const res = {
    id,
    internalID: id,
    label: { en: label },
    description: desc,
    agents,
    techniques,
    software,
    equipment,
    creationDate,
    externalLinks,
    bibliographicRefs,
    physicalObjs,
    licence,
    hierarchies,
  } as IDigitalEntityWikibase;
  return res;
}

export async function get_annotation_data(
  wikibase_domain: string,
  wikibase_sparql_endpoint: string,
  id: string,
) {
  // : Promise<IAnnotationWikibaseData | undefined> {
  let query = format_select(
    wikibase_domain,
    `?label ?descURL ?dateCreated ?dateModified ?val ?rank ?motiv ?camType
                             ?cx ?cy ?cz
                             ?ctx ?cty ?ctz
                             ?sx ?sy ?sz
                             ?snx ?sny ?snz
                             ?target
                             ?concept ?conceptLabel
                             ?media ?mediaLabel
                             ?relMediaThumb
                             ?mediaURL
                             ?descAgent ?descAgentLabel
                             ?descLicense ?descLicenseLabel
                            `,
    [
      `SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }`,
      `tib:${id} tibt:${properties.annotationDescriptionLink} ?descURL`,
      `tib:${id} tibt:${properties.dateCreated} ?dateCreated`,
      `tib:${id} tibt:${properties.annotationVerified} ?val`,
      `tib:${id} tibt:${properties.annotationRanking} ?rank`,
      `tib:${id} tibt:${properties.annotationMotivation} ?motiv`,
      `tib:${id} tibt:${properties.cameraType} ?camType`,
      `tib:${id} tibt:${properties.perspectivePositionX} ?cx`,
      `tib:${id} tibt:${properties.perspectivePositionY} ?cy`,
      `tib:${id} tibt:${properties.perspectivePositionZ} ?cz`,
      `tib:${id} tibt:${properties.perspectiveTargetX} ?ctx`,
      `tib:${id} tibt:${properties.perspectiveTargetY} ?cty`,
      `tib:${id} tibt:${properties.perspectiveTargetZ} ?ctz`,
      `tib:${id} tibt:${properties.selectorPositionX} ?sx`,
      `tib:${id} tibt:${properties.selectorPositionY} ?sy`,
      `tib:${id} tibt:${properties.selectorPositionZ} ?sz`,
      `tib:${id} tibt:${properties.selectorNormalX} ?snx`,
      `tib:${id} tibt:${properties.selectorNormalY} ?sny`,
      `tib:${id} tibt:${properties.selectorNormalZ} ?snz`,
      `tib:${id} tibt:${properties.targetEntity} ?target`,
      `OPTIONAL {
                                  tib:${id} tibp:${properties.annotationDescriptionLink} [tibps:${properties.annotationDescriptionLink} ?descAgentItem; tibpq:${properties.relatedAgents} ?descAgent] .
                                  tib:${id} tibp:${properties.annotationDescriptionLink} [tibps:${properties.annotationDescriptionLink} ?descLicenseItem; tibpq:${properties.license} ?descLicense]
                              }`,
      `OPTIONAL { tib:${id} tibt:${properties.annotationRelatedConcepts} ?concept }`,
      `OPTIONAL {
                                tib:${id} tibt:${properties.annotationRelatedMedia} ?media .
                                OPTIONAL {
                                  ?media tibt:${properties.image} ?relMediaThumb
                                }
                              }`,
      `OPTIONAL { tib:${id} tibt:${properties.externalLink} ?mediaURL }`,
      `OPTIONAL { tib:${id} rdfs:label ?label }`,
      `OPTIONAL { tib:${id} tibt:${properties.dateModified} ?dateModified }`,
    ],
  );
  let response = await get(wikibase_sparql_endpoint, query);
  if (response.results.bindings.length === 0) {
    return undefined;
  }
  const {
    descURL,
    val,
    rank,
    motiv,
    camType,
    cx,
    cy,
    cz,
    ctx,
    cty,
    ctz,
    sx,
    sy,
    sz,
    snx,
    sny,
    snz,
    dateModified,
    dateCreated,
    label,
    target,
  } = response.results.bindings[0];

  const descAgents = new Set<string>();
  const descLicenses = new Set<string>();
  const concepts = new Set<string>();
  const media = new Set<string>();
  const mediaURLs = new Set<string>();
  for (const res of response.results.bindings) {
    if (res.descAgent?.value) {
      descAgents.add(
        JSON.stringify({
          id: res.descAgent.value,
          label: { en: res.descAgentLabel.value },
        }),
      );
    }
    if (res.descLicense?.value) {
      descLicenses.add(
        JSON.stringify({
          id: res.descLicense.value,
          label: { en: res.descLicenseLabel.value },
        }),
      );
    }
    if (res.concept?.value) {
      concepts.add(
        JSON.stringify({
          id: res.concept.value,
          label: { en: res.conceptLabel.value },
        }),
      );
    }
    if (res.media?.value) {
      let thumb = res.relMediaThumb?.value;
      if (thumb) {
        const filename = new URL(thumb).pathname.match(/File[:](.+)/);
        if (filename) {
          thumb = await get_direct_image_link(wikibase_domain, filename[0]);
        }
      }
      media.add(
        JSON.stringify({
          id: res.media.value,
          label: { en: res.mediaLabel.value },
          media: thumb,
        }),
      );
    }
    if (res.mediaURL?.value) {
      mediaURLs.add(res.mediaURL.value);
    }
  }

  let desc = '';
  response = await get_annotation_description(new Session(wikibase_domain), id);
  if (response?.parse?.wikitext !== undefined) {
    desc = response?.parse?.wikitext['*'];
  }
  let result = {
    id,
    label: { en: label.value },
    description: desc,
    descriptionAuthors: Array.from(descAgents).map(a => JSON.parse(a) as IWikibaseItem),
    descriptionLicenses: Array.from(descLicenses).map(l => JSON.parse(l) as IWikibaseItem),
    validated: new WikibaseID(val.value).numericID === values.true,
    ranking: parseInt(rank.value),
    created: dateCreated.value,
    motivation: motiv.value,
    lastModificationDate: dateModified?.value,
    cameraType: camType.value,
    cameraPosition: {
      x: parseFloat(cx.value),
      y: parseFloat(cy.value),
      z: parseFloat(cz.value),
    } as IVector3,
    cameraTarget: {
      x: parseFloat(ctx.value),
      y: parseFloat(cty.value),
      z: parseFloat(ctz.value),
    } as IVector3,
    relatedMedia: Array.from(media).map(m => JSON.parse(m) as IWikibaseItem),
    relatedMediaUrls: Array.from(mediaURLs),
    relatedEntities: Array.from(concepts).map(c => JSON.parse(c) as IWikibaseItem),
    selectorPoint: {
      x: parseFloat(sx.value),
      y: parseFloat(sy.value),
      z: parseFloat(sz.value),
    } as IVector3,
    selectorNormal: {
      x: parseFloat(snx.value),
      y: parseFloat(sny.value),
      z: parseFloat(snz.value),
    } as IVector3,
    targetMetadata: new WikibaseID(target.value).numericID,
  };

  return result as IAnnotationWikibase;
}

export async function get_part_hierarchy(
  wikibase_domain: string,
  wikibase_sparql_endpoint: string,
  start_id: string,
): Promise<IMediaHierarchy> {
  // parents
  let query = format_select(
    wikibase_domain,
    `?source ?target ?sourceLabel ?targetLabel
                            `,
    [
      `SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }`,
      `VALUES ?obj { tib:${start_id} }`,
      `?obj tibt:${properties.isPartOf}* ?target`,
      `?target tibt:${properties.isPartOf} ?source`,
      `?source tibt:${properties.isPartOf}* ?root`,
      `FILTER NOT EXISTS { ?root tibt:${properties.isPartOf} [] }`,
    ],
  );
  let response = await get(wikibase_sparql_endpoint, query);
  if (response.results.bindings.length === 0) {
    return {
      parents: [] as IWikibaseItem[],
      siblings: [] as IWikibaseItem[],
    };
  }

  let edges: any[] = response.results.bindings.map((e: any) => {
    return {
      src: { id: e.source.value, label: { en: e.sourceLabel.value } },
      tgt: { id: e.target.value, label: { en: e.targetLabel.value } },
    };
  });
  let nodes: IWikibaseItem[] = [];
  let keys = new Set<string>();
  for (const node of edges.map(e => e.src).concat(edges.map(e => e.tgt))) {
    if (!keys.has(node.id)) {
      nodes.push(node);
      keys.add(node.id);
    }
  }
  const root = nodes.find(n => {
    return edges.find(e => e.tgt.id === n.id) === undefined;
  });

  if (root === undefined) {
    return {
      parents: [] as IWikibaseItem[],
      siblings: [] as IWikibaseItem[],
    };
  }

  let parents: IWikibaseItem[] = [root];
  let crt = root;
  while (crt !== undefined) {
    crt = edges.find(e => e.src.id === crt.id)?.tgt;
    if (crt !== undefined) {
      parents.push(crt);
    }
  }

  // siblings
  query = format_select(
    wikibase_domain,
    `?sibling ?siblingLabel ?media
                        `,
    [
      `SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }`,
      `VALUES ?class { tib:${start_id} }`,
      `?class tibt:${properties.isPartOf} ?parent`,
      `?parent tibt:${properties.hasPart} ?sibling`,
      `FILTER (?sibling != ?class)`,
      `OPTIONAL { ?sibling tibt:${properties.media} ?media }`,
    ],
  );
  response = await get(wikibase_sparql_endpoint, query);
  if (response.results.bindings.length === 0) {
    return {
      parents,
      siblings: [] as IWikibaseItem[],
    };
  }
  const siblings = response.results.bindings.map((res: any) => {
    return {
      id: res.sibling.value,
      label: { en: res.siblingLabel.value },
    };
  });

  return {
    parents,
    siblings,
  } as IMediaHierarchy;
}
