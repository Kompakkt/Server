import { join, extname } from 'path';
import {
  type IMediaHierarchy,
  type IMetadataChoices,
  type IAnnotationLinkChoices,
  type IWikibaseItem,
  type IWikibaseDigitalEntityExtension,
  type IWikibaseAnnotationExtension,
  properties,
  classes,
  values,
  WikibaseID,
  type IWikibaseConfiguration,
  isWikibaseConfiguration,
} from './wikibase.common';
import { Configuration, type IConfiguration } from 'src/configuration';
import { DigitalEntityCache, MetadataChoicesCache } from '../cache';
import * as wapi from './wikibase.api';
import * as sparql from './wikibase.sparql';
import { updatedDiff, deletedDiff } from 'deep-object-diff';
import { RootDirectory } from '../../environment';
import type { IAnnotation, IDigitalEntity } from 'src/common';
import { info, warn } from 'src/logger';

type WikibaseDigitalEntity = IDigitalEntity<IWikibaseDigitalEntityExtension>;
type WikibaseAnnotation = IAnnotation<IWikibaseAnnotationExtension>;
const WikibaseConfiguration = (Configuration as IConfiguration<{ Wikibase: IWikibaseConfiguration }>).Extensions?.Wikibase;

let wbSession: wapi.Session | undefined = undefined;

let joinWikibaseItems = async (a: IWikibaseItem[], b: IWikibaseItem[]) => {
  // simple function to join together two IWikibaseItems
  // better solution would be that list_items_of_classes is called

  let meld = [...a, ...b];
  return meld as IWikibaseItem[];
};

async function initSession() {
  if (wbSession) {
    // const force = await wbSession.always_login(Configuration, role);
    const valid = await wbSession.check();
    if (!valid) {
      throw new Error('Unable to validate Wikibase session');
    }
    return wbSession;
  }
  if (!isWikibaseConfiguration(WikibaseConfiguration)) {
    console.log(WikibaseConfiguration);
    throw new Error('Server has no valid wikibase API config. Cannot add/update entity data');
  }
  wbSession = await wapi.login(WikibaseConfiguration);
  return wbSession;
}

export async function fetchMetadataChoices(): Promise<IMetadataChoices | undefined> {
  log('Fetching metadata choices from Wikibase');
  if (!isWikibaseConfiguration(WikibaseConfiguration)) {
    err('Server has no valid wikibase API config. Cannot add/update entity data');
    return undefined;
  }
  const domain = WikibaseConfiguration.Domain;
  const endpoint = WikibaseConfiguration.SPARQLEndpoint;

  let get_and_set = async (class_id: number) => {
    const key = class_id.toString();
    let values: IWikibaseItem[] = []; //await MetadataChoicesCache.get<IWikibaseItem[]>(key);
    if (!values || !values.length) {
      values = await sparql.list_items_of_class(domain, endpoint, class_id);
    }
    MetadataChoicesCache.set(key, values as IWikibaseItem[]);
    return values as IWikibaseItem[];
  };

  // const start = performance.now();
  // let result : any = {};
  // result.persons = await get_and_set(classes.human);

  // let result : any = {};
  // result.persons = await get_and_set(classes.human);

  let result: any = {};
  let agents_people = await get_and_set(classes.human);
  let agents_organisations = await get_and_set(classes.organisation);
  result.persons = await joinWikibaseItems(agents_organisations, agents_people);
  result.techniques = await get_and_set(classes.technique);
  result.software = await get_and_set(classes.software);
  result.roles = await get_and_set(classes.role);
  result.bibliographic_refs = await get_and_set(classes.bibliographicRef);

  const building_key = classes.buildingEnsemble.toString();
  // let phy_objs = undefined; //await MetadataChoicesCache.get<IWikibaseItem[]>(building_key);
  // let phy_objs : IWikibaseItem[] | undefined = undefined; //await MetadataChoicesCache.get<IWikibaseItem[]>(building_key);

  let phy_objs = await MetadataChoicesCache.get<IWikibaseItem[]>(building_key);
  if (phy_objs === undefined) {
    const class_ids = await sparql.list_building_item_classes(domain, endpoint);
    const data = await sparql.list_items_of_classes(domain, endpoint, class_ids);
    phy_objs = Object.values(data).flat();
    MetadataChoicesCache.set(building_key, phy_objs);
  }
  result.physical_objs = phy_objs as IWikibaseItem[];

  return result as IMetadataChoices;
}

export async function fetchAnnotationLinkChoices(): Promise<IAnnotationLinkChoices | undefined> {
  if (!isWikibaseConfiguration(WikibaseConfiguration)) {
    return undefined;
  }
  const domain = WikibaseConfiguration.Domain;
  const endpoint = WikibaseConfiguration.SPARQLEndpoint;

  // const start = performance.now();
  let result: any = {};

  // related media
  let key = classes.media.toString();
  // result.relatedMedia = await MetadataChoicesCache.get<IWikibaseItem[]>(key);
  if (!result.relatedMedia || !result.relatedMedia.length) {
    result.relatedMedia = await sparql.list_media_items(domain, endpoint);
  }
  MetadataChoicesCache.set(key, result.relatedMedia as IWikibaseItem[]);

  // related concepts
  key = 'all concepts';
  // result.relatedConcepts = await MetadataChoicesCache.get<IWikibaseItem[]>(key);
  if (!result.relatedConcepts || !result.relatedConcepts.length) {
    result.relatedConcepts = await sparql.list_concepts(domain, endpoint);
  }

  MetadataChoicesCache.set(key, result.relatedConcepts as IWikibaseItem[]);

  // relatedAgents
  key = classes.human.toString();
  // result.relatedConcepts = await MetadataChoicesCache.get<IWikibaseItem[]>(key);
  if (!result.relatedAgents || !result.relatedAgents.length) {
    result.relatedAgents = await sparql.list_items_of_class(domain, endpoint, classes.human);
  }

  MetadataChoicesCache.set(key, result.relatedAgents as IWikibaseItem[]);

  // licenses
  key = classes.license.toString();
  // result.relatedConcepts = await MetadataChoicesCache.get<IWikibaseItem[]>(key);
  if (!result.licenses || !result.licenses.length) {
    result.licenses = await sparql.list_items_of_class(domain, endpoint, classes.license);
  }

  MetadataChoicesCache.set(key, result.licenses as IWikibaseItem[]);

  return result as IAnnotationLinkChoices;
}

export async function fetchWikibaseMetadata(id: string) {
  if (!isWikibaseConfiguration(WikibaseConfiguration)) {
    return undefined;
  }
  const domain = WikibaseConfiguration.Domain;
  const endpoint = WikibaseConfiguration.SPARQLEndpoint;
  const result = await sparql.get_media_item_metadata(domain, endpoint, id);
  if (!result) return undefined;

  await DigitalEntityCache.set(id, result);

  return result;
}

export async function updateDigitalEntity(
  id: string | undefined,
  entity: WikibaseDigitalEntity,
  claims: Record<string, unknown> = {},
  prev?: WikibaseDigitalEntity,
) {
  if (!isWikibaseConfiguration(WikibaseConfiguration)) {
    return undefined;
  }
  const session = await initSession();

  let diff = Object.keys(entity);
  if (!!prev) {
    diff = Object.keys(updatedDiff(prev as any, entity as any));
  }
  let numericID = parseInt((id || 'Q0').slice(1));
  const label = entity.extensions?.wikibase?.label?.['en'];
  // create new item and permanent properties if necessary
  if (id === undefined) {
    const item = await wapi.create_item(session, label, entity.description);
    id = item?.entity?.id;
    if (session.debug) console.log(`create media item ${id}`);
    if (item.success !== 1 || id === undefined) {
      return undefined;
    }
    numericID = parseInt(id.slice(1));

    // instance of
    claims['instance_of'] = await wapi.create_item_claim(
      session,
      id,
      properties.instance_of,
      classes.media,
    );
  } else {
    // editing item to potentially update label
    await wapi.edit_item(session, id, label, entity.description);
  }

  // for
  // - agents
  // - techniques
  // - software
  // - equipment
  // - externalLinks
  // - bibliographicRefs
  // - physicalObjs
  // we first find all linked items that are no longer present,
  // ie. to be removed and do so using the claimId maps
  if (prev) {
    let obsolete: string[] = [];
    for (const item of prev.extensions?.wikibase?.agents) {
      // due to problems with updating qualifiers we just delete any agent claims
      // to force re-addition
      const numId = new WikibaseID(item.id).numericID;
      if (claims['agents'][numId] && claims['agents'][numId]['claim']) {
        obsolete.push(claims['agents'][numId]['claim']);
        delete claims['agents'][numId];
      }
    }
    for (const item of prev.extensions?.wikibase?.techniques) {
      if (entity.extensions?.wikibase?.techniques?.find(i => i.id === item.id) === undefined) {
        const numId = new WikibaseID(item.id).numericID.toString();
        if (session.debug)
          console.log(`removing technique ${numId} with claim Id ${claims['techniques'][numId]}`);
        obsolete.push(claims['techniques'][numId]);
      }
    }
    for (const item of prev.extensions?.wikibase?.software) {
      if (entity.software.find(i => i.id === item.id) === undefined) {
        const numId = new WikibaseID(item.id).numericID.toString();
        if (session.debug)
          console.log(`removing software ${numId} with claim Id ${claims['software'][numId]}`);
        obsolete.push(claims['software'][numId]);
      }
    }
    for (const item of prev.extensions?.wikibase?.bibliographicRefs) {
      if (
        entity.extensions?.wikibase?.bibliographicRefs.find(i => i.id === item.id) === undefined
      ) {
        const numId = new WikibaseID(item.id).numericID.toString();
        if (session.debug)
          console.log(
            `removing bibliographicRef ${numId} with claim Id ${claims['bibliographicRefs'][numId]}`,
          );
        obsolete.push(claims['bibliographicRefs'][numId]);
      }
    }
    for (const item of prev.extensions?.wikibase?.physicalObjs) {
      if (entity.extensions?.wikibase?.physicalObjs?.find(i => i.id === item.id) === undefined) {
        const numId = new WikibaseID(item.id).numericID.toString();
        if (session.debug)
          console.log(
            `removing physicalObj ${numId} with claim Id ${claims['physicalObjs'][numId]}`,
          );
        obsolete.push(claims['physicalObjs'][numId]);
      }
    }
    for (const item of prev.extensions?.wikibase?.equipment) {
      if (entity.extensions?.wikibase?.equipment.indexOf(item) < 0) {
        if (session.debug)
          console.log(`removing equipment ${item} with claim Id ${claims['equipment'][item]}`);
        obsolete.push(claims['equipment'][item]);
      }
    }
    for (const item of prev.extensions?.wikibase?.externalLinks) {
      if (entity.extensions?.wikibase?.externalLinks.indexOf(item) < 0) {
        if (session.debug)
          console.log(
            `removing externalLink ${item} with claim Id ${claims['externalLinks'][item]}`,
          );
        obsolete.push(claims['externalLinks'][item]);
      }
    }

    for (const claimId of obsolete) {
      if (claimId != null) {
        await wapi.remove_claim(session, claimId);
      }
    }
  }

  // // agents
  // for (const agent of (entity.agents || [])) {
  //   const agentId = new WikibaseID(agent.id).numericID;
  //   if (claims['agents'] === undefined) {
  //     claims['agents'] = {} as { [agent: number] : { [key: string] : string } };
  //   }
  //   if (claims['agents'][agentId] === undefined) {
  //     claims['agents'][agentId] = {} as { [key: string] : string };
  //     claims['agents'][agentId]['claim'] = await wapi.upsert_item_claim(session,
  //                                                                       id,
  //                                                                       properties.relatedAgents,
  //                                                                       agentId,
  //                                                                       claims['agents'][agentId]['claim']);
  //   }
  //   if (session.debug) console.log(`add related agent ${agentId}`);
  //   const r = agent.role.toString();
  //   claims['agents'][agentId][r] = await wapi.edit_claim_qualifier(session,
  //                                                                  claims['agents'][agentId]['claim'],
  //                                                                  properties.role,
  //                                                                  agent.role,
  //                                                                  claims['agents'][agentId][r]);
  // }

  // agents
  for (const agent of entity.agents || []) {
    console.log('agent data', agent);

    const agentId = new WikibaseID(agent.id).numericID;
    if (claims['agents'] === undefined) {
      claims['agents'] = {} as { [key: number]: string };
    }
    const r = agent.role.toString();
    console.log(claims);
    if (session.debug) console.log(`add related agent ${agentId}`);
    if (agent.roleTitle == 'Rightsowner') {
      claims['agents'][agentId + r] = await wapi.upsert_item_claim(
        session,
        id,
        'P45',
        agentId,
        claims['agents'][agentId + r],
      );
    } else if (agent.roleTitle == 'Creator') {
      claims['agents'][agentId + r] = await wapi.upsert_item_claim(
        session,
        id,
        'P40',
        agentId,
        claims['agents'][agentId + r],
      );
    } else if (agent.roleTitle == 'Editor') {
      claims['agents'][agentId + r] = await wapi.upsert_item_claim(
        session,
        id,
        'P42',
        agentId,
        claims['agents'][agentId + r],
      );
    } else if (agent.roleTitle == 'Data Creator') {
      claims['agents'][agentId + r] = await wapi.upsert_item_claim(
        session,
        id,
        'P41',
        agentId,
        claims['agents'][agentId + r],
      );
    } else if (agent.roleTitle == 'Contact Person') {
      claims['agents'][agentId + r] = await wapi.upsert_item_claim(
        session,
        id,
        'P51',
        agentId,
        claims['agents'][agentId + r],
      );
    }
  }

  // techniques
  for (const technique of entity.techniques || []) {
    const techniqueId = new WikibaseID(technique.id).numericID;
    if (claims['techniques'] === undefined) {
      claims['techniques'] = {} as { [key: number]: string };
    }
    if (session.debug) console.log(`add related technique ${techniqueId}`);
    claims['techniques'][techniqueId] = await wapi.upsert_item_claim(
      session,
      id,
      properties.technique,
      techniqueId,
      claims['techniques'][techniqueId],
    );
  }

  // software
  for (const software of entity.software || []) {
    const softwareId = new WikibaseID(software.id).numericID;
    if (claims['software'] === undefined) {
      claims['software'] = {} as { [key: number]: string };
    }
    if (session.debug) console.log(`add related software ${softwareId}`);
    claims['software'][softwareId] = await wapi.upsert_item_claim(
      session,
      id,
      properties.software,
      softwareId,
      claims['software'][softwareId],
    );
  }

  // bibliographicRef
  for (const bibliographicRef of entity.bibliographicRefs || []) {
    const bibliographicRefId = new WikibaseID(bibliographicRef.id).numericID;
    if (claims['bibliographicRefs'] === undefined) {
      claims['bibliographicRefs'] = {} as { [key: number]: string };
    }
    if (session.debug) console.log(`add related bibliographicRef ${bibliographicRefId}`);
    claims['bibliographicRefs'][bibliographicRefId] = await wapi.upsert_item_claim(
      session,
      id,
      properties.bibliographicRef,
      bibliographicRefId,
      claims['bibliographicRefs'][bibliographicRefId],
    );
  }

  // physicalObj
  let hierarchies: IMediaHierarchy[] = [];
  for (const physicalObj of entity.physicalObjs || []) {
    const physicalObjId = new WikibaseID(physicalObj.id);
    if (claims['physicalObjs'] === undefined) {
      claims['physicalObjs'] = {} as { [key: number]: string };
    }
    if (session.debug) console.log(`add related physicalObj ${physicalObjId.numericID}`);
    claims['physicalObjs'][physicalObjId.numericID] = await wapi.upsert_item_claim(
      session,
      id,
      properties.objectOfRepresentation,
      physicalObjId.numericID,
      claims['physicalObjs'][physicalObjId.numericID],
    );
    const hierarchy = await sparql.get_part_hierarchy(
      WikibaseConfiguration.Domain,
      WikibaseConfiguration.SPARQLEndpoint,
      physicalObjId.itemID,
    );
    hierarchies.push(hierarchy);
  }

  // equipment
  for (const equipment of entity.equipment || []) {
    if (claims['equipment'] === undefined) {
      claims['equipment'] = {} as { [key: string]: string };
    }
    if (session.debug) console.log(`add related equipment ${equipment}`);
    claims['equipment'][equipment] = await wapi.upsert_string_claim(
      session,
      id,
      properties.equipment,
      equipment,
      claims['equipment'][equipment],
    );
  }

  // externalLink
  for (const externalLink of entity.externalLinks || []) {
    if (claims['externalLinks'] === undefined) {
      claims['externalLinks'] = {} as { [key: string]: string };
    }
    if (session.debug) console.log(`add related externalLink ${externalLink}`);
    claims['externalLinks'][externalLink] = await wapi.upsert_string_claim(
      session,
      id,
      properties.externalLink,
      externalLink,
      claims['externalLinks'][externalLink],
    );
  }

  // creation date
  if (diff.includes('creationDate') && entity.creationDate) {
    const dateCreated = entity.creationDate.replace(/[.]\d+Z/, 'Z');
    if (session.debug) console.log(`update creation date to ${dateCreated}`);
    claims['creationDate'] = await wapi.upsert_string_claim(
      session,
      id,
      properties.dateCreated,
      dateCreated,
      claims['creationDate'],
    );
  }

  // licence
  if (diff.includes('licence')) {
    if (session.debug) console.log(`update licence to ${entity.licence}`);
    claims['licence'] = await wapi.upsert_item_claim(
      session,
      id,
      properties.license,
      entity.licence,
      claims['licence'],
    );
  }

  // code to find the link for the wikibase page to link back to kompakkt page.
  // this is done by traversing both digitalentity and entity to pull back correct id to form link.
  // some issues: not designed to be updated, although this should not be required given the nature of the data.
  // hardcoded property and path also not desirable and should be replaced during integration rewrite.

  let digital_entity_data = await Repo.digitalentity.findOne({ wikibase_id: id });
  if (digital_entity_data !== undefined) {
    let digital_entity_id = '' + digital_entity_data._id;
    let entity_data = await Repo.entity.findOne({ 'relatedDigitalEntity._id': digital_entity_id });
    if (entity_data !== undefined) {
      let entity_id = '' + entity_data?._id;
      claims['model_link'] = await wapi.upsert_string_claim(
        session,
        id,
        'P74',
        WikibaseConfiguration.KompakktAddress + '/entity/' + entity_id,
        claims['testing'],
      );
    }
  }

  return { itemId: id, claims: claims, hierarchies };
}

export async function fetchAnnotation(item_id: string) {
  if (!isWikibaseConfiguration(WikibaseConfiguration)) {
    return undefined;
  }

  return sparql.get_annotation_data(
    WikibaseConfiguration.Domain,
    WikibaseConfiguration.SPARQLEndpoint,
    item_id,
  );
}

export async function updateAnnotation(
  id: string | undefined,
  annotation: IAnnotationWikibase,
  claims: { [key: string]: any } = {},
  prev: IAnnotationWikibase | undefined = undefined,
  preview: string | undefined = undefined,
) {
  const session = await initSession();
  let diff = Object.keys(annotation);
  if (prev != null) {
    diff = Object.keys(updatedDiff(prev as any, annotation as any));
  }
  let numericID = parseInt((id || 'Q0').slice(1));
  // create new item and permanent properties if necessary
  if (id === undefined) {
    let targetString = 'by kompakkt';
    if (annotation.targetMetadata) {
      targetString = `for Q${annotation.targetMetadata}`;
    }
    const item = await wapi.create_item(
      session,
      annotation.label['en'],
      `Annotation generated ${targetString}`,
      undefined,
    );
    id = item.entity?.id;
    if (session.debug) console.log(`create annotation item ${id}`);
    if (item.success !== 1 || id === undefined) {
      return undefined;
    }
    numericID = parseInt(id.slice(1));

    // instance of
    claims['instance_of'] = await wapi.create_item_claim(
      session,
      id,
      properties.instance_of,
      classes.annotation,
    );

    claims['motivation'] = await wapi.upsert_item_claim(
      session,
      id,
      properties.annotationMotivation,
      values.motivationDescribing,
      claims['motivation'],
    );
  } else {
    // editing item to potentially update label
    await wapi.edit_item(session, id, annotation.label['en']);
  }

  // target entity
  if (annotation.targetMetadata && claims['target_entity'] === undefined) {
    // only do this once
    claims['target_entity'] = await wapi.create_item_claim(
      session,
      id,
      properties.targetEntity,
      annotation.targetMetadata,
    );
  }

  // inverse of target entity
  if (annotation.targetMetadata && claims['has_annotation'] === undefined) {
    // only do this once
    claims['has_annotation'] = await wapi.create_item_claim(
      session,
      `Q${annotation.targetMetadata}`,
      properties.hasAnnotation,
      numericID,
    );
  }

  // description
  if (diff.includes('description') && annotation.description) {
    if (session.debug) console.log(`creating description page`);
    // this also updated the description if the page already exists
    await wapi.create_description_page(session, numericID, annotation.description);
    if (claims['description'] === undefined) {
      // we only link this on first creation

      let desc_domain = WikibaseConfiguration?.Public;
      const descURL = new URL(`/wiki/Annotation:${id}`, desc_domain).href;
      if (session.debug) console.log(`update description to ${descURL}`);
      claims['description'] = await wapi.create_string_claim(
        session,
        id,
        properties.annotationDescriptionLink,
        descURL,
      );
    }
  }

  // description author/license
  // due to problems with updating qualifiers we *alwyas* delete (and potentially re-add) them
  if (claims['descriptionAuthors'] && claims['description']) {
    for (const claimId of claims['descriptionAuthors']) {
      await wapi.remove_qualifier(session, claims['description'], claimId);
    }
    delete claims['descriptionAuthor'];
  }
  if (claims['descriptionLicenses'] && claims['description']) {
    for (const claimId of claims['descriptionLicenses']) {
      await wapi.remove_qualifier(session, claims['description'], claimId);
    }
    delete claims['descriptionLicenses'];
  }
  if (annotation.descriptionAuthors.length && claims['description']) {
    claims['descriptionAuthors'] = [];
    for (const item of annotation.descriptionAuthors) {
      const itemId = new WikibaseID(item.id).numericID;
      const claimId = await wapi.edit_claim_qualifier(
        session,
        claims['description'],
        properties.relatedAgents,
        itemId,
      );
      if (claimId) {
        claims['descriptionAuthors'].push(claimId);
      }
    }
  }
  if (annotation.descriptionLicenses.length && claims['description']) {
    claims['descriptionLicenses'] = [];
    for (const item of annotation.descriptionLicenses) {
      const itemId = new WikibaseID(item.id).numericID;
      const claimId = await wapi.edit_claim_qualifier(
        session,
        claims['description'],
        properties.license,
        itemId,
      );
      if (claimId) {
        claims['descriptionLicenses'].push(claimId);
      }
    }
  }

  // external link
  if (diff.includes('media') && annotation.media) {
    if (session.debug) console.log(`update media to ${annotation.media}`);
    claims['media'] = await wapi.upsert_string_claim(
      session,
      id,
      properties.externalLink,
      annotation.media,
      claims['media'],
    );
  }

  // camera type
  if (diff.includes('cameraType')) {
    const cameraType = annotation.cameraType;
    if (session.debug) console.log(`update camera type to ${cameraType}`);
    claims['cam_type'] = await wapi.upsert_string_claim(
      session,
      id,
      properties.cameraType,
      cameraType,
      claims['cam_type'],
    );
  }
  // cam pos
  if (diff.includes('cameraPosition')) {
    const cameraPos = annotation.cameraPosition;
    if (session.debug) console.log(`update cam pos`);
    claims['cam_pos_x'] = await wapi.upsert_quantity_claim(
      session,
      id,
      properties.perspectivePositionX,
      cameraPos.x,
      claims['cam_pos_x'],
    );
    claims['cam_pos_y'] = await wapi.upsert_quantity_claim(
      session,
      id,
      properties.perspectivePositionY,
      cameraPos.y,
      claims['cam_pos_y'],
    );
    claims['cam_pos_z'] = await wapi.upsert_quantity_claim(
      session,
      id,
      properties.perspectivePositionZ,
      cameraPos.z,
      claims['cam_pos_z'],
    );
  }
  // cam target
  if (diff.includes('cameraTarget')) {
    const cameraTgt = annotation.cameraTarget;
    claims['cam_tgt_x'] = await wapi.upsert_quantity_claim(
      session,
      id,
      properties.perspectiveTargetX,
      cameraTgt.x,
      claims['cam_tgt_x'],
    );
    claims['cam_tgt_y'] = await wapi.upsert_quantity_claim(
      session,
      id,
      properties.perspectiveTargetY,
      cameraTgt.y,
      claims['cam_tgt_y'],
    );
    claims['cam_tgt_z'] = await wapi.upsert_quantity_claim(
      session,
      id,
      properties.perspectiveTargetZ,
      cameraTgt.z,
      claims['cam_tgt_z'],
    );
  }
  // selector pos
  if (diff.includes('selectorPoint')) {
    const selPos = annotation.selectorPoint;
    claims['sel_pos_x'] = await wapi.upsert_quantity_claim(
      session,
      id,
      properties.selectorPositionX,
      selPos.x,
      claims['sel_pos_x'],
    );
    claims['sel_pos_y'] = await wapi.upsert_quantity_claim(
      session,
      id,
      properties.selectorPositionY,
      selPos.y,
      claims['sel_pos_y'],
    );
    claims['sel_pos_z'] = await wapi.upsert_quantity_claim(
      session,
      id,
      properties.selectorPositionZ,
      selPos.z,
      claims['sel_pos_z'],
    );
  }
  // selector nrm
  if (diff.includes('selectorNormal')) {
    const selNrm = annotation.selectorNormal;
    claims['sel_nrm_x'] = await wapi.upsert_quantity_claim(
      session,
      id,
      properties.selectorNormalX,
      selNrm.x,
      claims['sel_nrm_x'],
    );
    claims['sel_nrm_y'] = await wapi.upsert_quantity_claim(
      session,
      id,
      properties.selectorNormalY,
      selNrm.y,
      claims['sel_nrm_y'],
    );
    claims['sel_nrm_z'] = await wapi.upsert_quantity_claim(
      session,
      id,
      properties.selectorNormalZ,
      selNrm.z,
      claims['sel_nrm_z'],
    );
  }
  // ranking
  if (diff.includes('ranking')) {
    if (session.debug) console.log(`update ranking to ${annotation.ranking}`);
    claims['ranking'] = await wapi.upsert_quantity_claim(
      session,
      id,
      properties.annotationRanking,
      annotation.ranking,
      claims['ranking'],
    );
  }
  // creation date
  if (diff.includes('created')) {
    const dateCreated = annotation.created.replace(/[.]\d+Z/, 'Z');
    if (session.debug) console.log(`update creation date to ${dateCreated}`);
    claims['date_created'] = await wapi.upsert_string_claim(
      session,
      id,
      properties.dateCreated,
      dateCreated,
      claims['date_created'],
    );
  }

  // last modification date
  // if (diff.includes('lastModificationDate') && annotation.lastModificationDate) {
  //   const dateModified = annotation.lastModificationDate.replace(/[.]\d+Z/, 'Z');
  //   if (session.debug) console.log(`update modification date to ${dateModified}`);
  //   claims['date_modified'] = await wapi.upsert_string_claim(session,
  //                                                            id,
  //                                                            properties.dateModified,
  //                                                            dateModified,
  //                                                            claims['date_modified']);
  // }

  // validated/verified
  if (diff.includes('validated')) {
    const val = annotation.validated ? values.true : values.false;
    if (session.debug) console.log(`update validity to ${val}`);
    claims['verified'] = await wapi.upsert_item_claim(
      session,
      id,
      properties.annotationVerified,
      val,
      claims['verified'],
    );
  }

  // for relatedMedia, relatedMediaUrls and relatedEntities
  // we first find all linked items that are no longer present,
  // ie. to be removed and do so using the claimId maps
  if (prev) {
    let obsolete: string[] = [];
    for (const item of prev.relatedMedia) {
      if (annotation.relatedMedia.find(i => i.id === item.id) === undefined) {
        const numId = new WikibaseID(item.id).numericID.toString();
        if (session.debug) console.log(`removing item ${numId}`);
        obsolete.push(claims['rel_media'][numId]);
      }
    }
    for (const url of prev.relatedMediaUrls) {
      if (annotation.relatedMediaUrls.indexOf(url) < 0) {
        if (session.debug) console.log(`removing url ${url}`);
        obsolete.push(claims['rel_media_urls'][url]);
      }
    }
    for (const item of prev.relatedEntities) {
      if (annotation.relatedEntities.find(i => i.id === item.id) === undefined) {
        const numId = new WikibaseID(item.id).numericID.toString();
        if (session.debug) console.log(`removing item ${numId}`);
        obsolete.push(claims['rel_concepts'][numId]);
      }
    }

    for (const claimId of obsolete) {
      if (claimId != null) {
        await wapi.remove_claim(session, claimId);
      }
    }
  }

  // related media
  for (const medium of annotation.relatedMedia || []) {
    const mediumId = new WikibaseID(medium.id).numericID;
    if (claims['rel_media'] === undefined) {
      claims['rel_media'] = {} as { [key: number]: string };
    }
    if (session.debug) console.log(`add related medium ${mediumId}`);
    claims['rel_media'][mediumId] = await wapi.upsert_item_claim(
      session,
      id,
      properties.annotationRelatedMedia,
      mediumId,
      claims['rel_media'][mediumId],
    );
  }

  // related media URLs
  for (const medium of annotation.relatedMediaUrls || []) {
    if (claims['rel_media_urls'] === undefined) {
      claims['rel_media_urls'] = {} as { [key: string]: string };
    }
    if (session.debug) console.log(`add related medium URL ${medium}`);
    claims['rel_media_urls'][medium] = await wapi.upsert_string_claim(
      session,
      id,
      properties.externalLink,
      medium,
      claims['rel_media_urls'][medium],
    );
  }

  // related concepts
  for (const concept of annotation.relatedEntities || []) {
    const conceptId = new WikibaseID(concept.id).numericID;
    if (claims['rel_concepts'] === undefined) {
      claims['rel_concepts'] = {} as { [key: number]: string };
    }
    if (session.debug) console.log(`add related concept ${conceptId}`);
    claims['rel_concepts'][conceptId] = await wapi.upsert_item_claim(
      session,
      id,
      properties.annotationRelatedConcepts,
      conceptId,
      claims['rel_concepts'][conceptId],
    );
  }

  if (preview != null) {
    try {
      claims['preview'] = await addWikibasePreviewImage(preview, id, claims['preview']);
    } catch (err) {
      console.error(`error adding preview image: ${err}`);
      claims['preview'] = 'https://commons.wikimedia.org/wiki/File:Wikidata-logo.svg';
    }
  }

  return { item_id: id, claims: claims };
}

export async function removeAnnotation(id: string, claims: { [key: string]: any } = {}) {
  const session = await initSession();
  if (claims['has_annotation'] !== undefined) {
    await wapi.remove_claim(session, claims['has_annotation']);
  }

  await wapi.remove_page(session, `Annotation:${id}`);
  await wapi.remove_page(session, `Item:${id}`);
}

export async function addWikibasePreviewImage(imgPath: string, itemId: string, claimId?: string) {
  if (imgPath === undefined) {
    warn(`no preview image for ${itemId}!`);
    return;
  }

  if (imgPath.startsWith('uploads/')) {
    imgPath = imgPath.replace('uploads/', '');
  }
  const session = await initSession();
  const fullPath = join(RootDirectory, Configuration.Uploads.UploadDirectory, imgPath);
  try {
    const upload = await wapi
      .upload(session, fullPath, `Preview${itemId}${extname(imgPath)}`)
      .catch(e => {
        console.log('upload failed: ', e);
        return null;
      });
    console.log(claimId);
    return await wapi.upsert_string_claim(
      session,
      itemId,
      properties.image,
      upload.filename,
      claimId,
    );
  } catch (e: any) {
    if (e.code !== 'fileexists-no-change') {
      console.log('upload failed: ', e);
      throw e;
    }
  }
}

export async function addWikibasePreviewImageBase64(
  base64: string,
  itemId: string,
  claimId?: string,
) {
  const session = await initSession();
  try {
    const upload = await wapi.uploadBase64(session, base64, `Preview${itemId}.png`);
    return await wapi.upsert_string_claim(
      session,
      itemId,
      properties.image,
      upload.filename,
      claimId,
    );
  } catch (e) {
    if (e.code !== 'fileexists-no-change') {
      console.error(e);
    }
  }
}

// export async function
// update_wikibase_login(config, user, pass) {

//   config.Wikibase.Username = user;
//   config.Wikibase.Password = pass;

//   return config

// }

export async function wikibase_account_create(user: string, pass: string) {
  // function to wikibase account to match kompakkt.
  info(`Creating account for ${user} in Wikibase.`);
  const session = await initSession();

  let response = await wapi.get_public(session.api_url, {
    action: 'query',
    list: 'users',
    ususers: user,
    usprop: 'groups',
  });

  if (response?.query.users[0].userid) {
    console.log('User already exists with this name in Wikibase.'); // throw a more severe error?
    throw new Error('User already exists with this name in Wikibase.');
  } else {
    let request_create_token = await wapi.post2(session, {
      action: 'query',
      meta: 'tokens',
      type: 'createaccount',
      format: 'json',
    });

    let create_token = request_create_token.query.tokens.createaccounttoken;

    var result = await wapi.post2(session, {
      action: 'createaccount',
      createtoken: create_token,
      username: user,
      password: pass,
      retype: pass,
      createreturnurl: 'http://test',
      format: 'json',
    });

    if (!result) {
      throw new Error('Failed to create account.');
    }
  }
}

// export async function
// wikibase_account_extant(user: string) {

//   // query whether user account exists in wikibase.

//   const session = await initSession('admin');

//   let response = await wapi.get_public(session.api_url, {
//     'action': 'query',
//     'list': 'users',
//     'ususers': user,
//     'usprop': 'groups'
//   });

//   let respon = Object.keys(response?.query.users[0]).includes('missing');

//   return !respon
// }

// export async function
// wikibase_account_bot(user: string) {

//   // include user in bot group.

//   const session = await initSession('admin');
//   var start = new Date().getTime();
//   try {
//     while (true) {
//       const user_extant = await wikibase_account_extant(user);
//       console.log(user, 'exists', user_extant);
//       if (user_extant) {

//         let request_user_token = await wapi.post2(session, {
//           "action": "query",
//           "meta": "tokens",
//           "type": "userrights",
//           "format": "json"
//         });

//         let user_token = request_user_token.query.tokens.userrightstoken

//         await wapi.post2(session, {
//           "action": "userrights",
//           "user": user,
//           "add": "bot",
//           "token": user_token,
//           "format": "json"
//         });

//         break;
//       };

//       if (new Date().getTime() > start + 2000) { // 2 secs, this should be enough
//         throw new Error("Wikibase bot account not found.");
//       }
//       await new Promise((resolve) => setTimeout(resolve, 100));
//     };
//   } catch (e) {
//     console.error(e);
//   }
// };
