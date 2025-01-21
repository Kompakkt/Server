import {
  WBPredicates,
  WBClasses,
  WBValues,
  WikibaseID,
  getIDfromWBEntity,
  getQNumberFromURL,
  type IMediaHierarchy,
  type IMetadataChoices,
  type IAnnotationLinkChoices,
  isWikibaseConfiguration,
  type IWikibaseItem,
  type IMediaAgent,
  type IWikibaseDigitalEntityExtensionData,
  type IWikibaseAnnotationExtensionData,
  getDigitalEntityMetadataSpark,
  getAnnotationMetadataSpark,
  getWikibaseClassAndSubclassSpark,
  getWikibaseClassInstancesSpark,
  getHierarchySpark,
} from './common';
import WBEdit from 'wikibase-edit';
import WBK from 'wikibase-sdk';
import { WikibaseConnector } from './connector';
import {
  WikibaseConfiguration,
  type WikibaseAnnotation,
  type WikibaseDigitalEntity,
} from './config';
import { ObjectId } from 'mongodb';
import { err, info, log } from 'src/logger';
import { annotationCollection, digitalEntityCollection, entityCollection } from 'src/mongo';
import { get, RequestClient } from 'src/util/requests';
import { Configuration } from 'src/configuration';

type UndoPartial<T> = T extends Partial<infer R> ? R : T;

type ValueLabelItem = {
  value: string;
  label: string;
};

type DescItem = {
  value: string;
  agent?: string;
  agentLabel?: string;
};

export type MetadataResponseItem = {
  licence: ValueLabelItem;
  physicalObjs?: ValueLabelItem;
  rightsOwner: ValueLabelItem;
  dataCreator?: ValueLabelItem;
  creator: ValueLabelItem;
  editor?: ValueLabelItem;
  contactperson?: ValueLabelItem;
  desc: string;
  label: string;
  externalLinks?: string;
  techniques?: ValueLabelItem;
  software?: ValueLabelItem;
  equipment?: ValueLabelItem;
};

type AnnotationResponseItem = {
  desc: DescItem;
  label: string;
  val: string;
  rank: number;
  motiv: string;
  camType: string;
  cx: number;
  cy: number;
  cz: number;
  ctx: number;
  cty: number;
  ctz: number;
  sx: number;
  sy: number;
  sz: number;
  snx: number;
  sny: number;
  snz: number;
  target: string;
  concept?: ValueLabelItem;
  media?: ValueLabelItem;
  relMediaThumb?: string;
  fileView?: string;
};

const isValueLabelItem = (item: MetadataField): item is ValueLabelItem => {
  return (
    typeof item !== 'string' &&
    (item as ValueLabelItem).value !== undefined &&
    (item as ValueLabelItem).label !== undefined
  );
};
const isDescItem = (item: MetadataField): item is DescItem => {
  return typeof item !== 'string' && (item as DescItem).value !== undefined;
};
type MetadataField = string | ValueLabelItem | number | DescItem;
type RawMetadata = Record<string, MetadataField>[];
type ProcessedMetadata = Record<string, MetadataField | Array<MetadataField>>;

type HierarchiesResponseItem = {
  item: ValueLabelItem;
  type: string;
};

export class WikibaseService {
  static instance: WikibaseService;
  wbConnect: WikibaseConnector;
  wbEdit: ReturnType<typeof WBEdit>;
  wbSDK: ReturnType<typeof WBK>;

  constructor() {
    const instance = 'http://wb.local';
    const username = WikibaseConfiguration?.AdminUsername ?? '';
    const password = WikibaseConfiguration?.AdminPassword ?? '';
    const sparqlEndpoint = WikibaseConfiguration?.SPARQLEndpoint;

    this.wbConnect = new WikibaseConnector(instance, { username, password });
    this.wbEdit = WBEdit({ instance, credentials: { username, password } });
    this.wbSDK = WBK({ instance, sparqlEndpoint });
  }

  private extractWikibaseExtensionData<T extends WikibaseAnnotation | WikibaseDigitalEntity>(
    obj: T,
  ) {
    return obj.extensions!.wikibase! as UndoPartial<
      NonNullable<NonNullable<T['extensions']>['wikibase']>
    >;
  }

  public static getInstance(): WikibaseService {
    if (!WikibaseService.instance) {
      WikibaseService.instance = new WikibaseService();
    }
    return WikibaseService.instance;
  }

  // update annotation
  public async updateAnnotation(
    id: string | undefined,
    fullAnnotation: WikibaseAnnotation,
    claims: { [key: string]: string | string[] } = {},
    prevAnnotation: WikibaseAnnotation | undefined = undefined,
    preview: string | undefined = undefined,
  ) {
    const annotation = this.extractWikibaseExtensionData(fullAnnotation);
    const prev = prevAnnotation ? this.extractWikibaseExtensionData(prevAnnotation) : undefined;
    if (id === undefined) {
      console.log('id is undefined');
      const create = await this.wbEdit.entity.create({
        type: 'item',
        labels: { en: annotation.label['en'] },
        descriptions: { en: annotation.description },
      });
      id = create.entity.id;
      console.log('created new item with id ' + id);
    }

    let preview_path = '';
    try {
      console.log('writing image with id ' + id + ' and preview ' + preview);
      preview_path = await this.wbConnect.writeImage(id ?? '', preview ?? '');
      console.log('wrote image, path is ' + preview_path);
    } catch (error) {
      console.log('error writing image');
      err(error);
      preview_path = '';
    }

    await this.wbConnect.writeAnnotation(id ?? '', annotation.description ?? '');
    //TODO shouldnt this be in the writeAnnotation function?
    const fixedPos = 6;
    log('related Media (kmpkt): ' + JSON.stringify(annotation.media));
    const spark = {
      id: id,
      clear: true,
      labels: { en: annotation.label['en'] },
      descriptions: { en: annotation.description },
      claims: {
        [WBPredicates.instance_of]: [WBClasses.annotation],
        [WBPredicates.cameraType]: annotation.cameraType,
        [WBPredicates.perspectivePositionX]: annotation.cameraPosition.x.toFixed(fixedPos),
        [WBPredicates.perspectivePositionY]: annotation.cameraPosition.y.toFixed(fixedPos),
        [WBPredicates.perspectivePositionZ]: annotation.cameraPosition.z.toFixed(fixedPos),
        [WBPredicates.perspectiveTargetX]: annotation.cameraTarget.x.toFixed(fixedPos),
        [WBPredicates.perspectiveTargetY]: annotation.cameraTarget.y.toFixed(fixedPos),
        [WBPredicates.perspectiveTargetZ]: annotation.cameraTarget.z.toFixed(fixedPos),
        [WBPredicates.selectorPositionX]: annotation.selectorPoint._x?.toFixed(fixedPos),
        [WBPredicates.selectorPositionY]: annotation.selectorPoint._y?.toFixed(fixedPos),
        [WBPredicates.selectorPositionZ]: annotation.selectorPoint._z?.toFixed(fixedPos),
        [WBPredicates.selectorNormalX]: annotation.selectorNormal._x?.toFixed(fixedPos),
        [WBPredicates.selectorNormalY]: annotation.selectorNormal._y?.toFixed(fixedPos),
        [WBPredicates.selectorNormalZ]: annotation.selectorNormal._z?.toFixed(fixedPos),
        [WBPredicates.annotationRanking]: annotation.ranking,
        [WBPredicates.annotationVerified]: [WBValues.true],
        [WBPredicates.annotationMotivation]: [WBValues.motivationDescribing],
        // P12: annotation.created, // library does not include support for edtf!
        [WBPredicates.targetEntity]: ['Q' + annotation.targetMetadata],
        [WBPredicates.annotationRelatedConcepts]: annotation.entities.map(d => d['id']),
        [WBPredicates.annotationRelatedMedia]: annotation.media.map(d => d['id']), //  this should work, issue with prefixes for now.
        [WBPredicates.image]: preview_path ?? '',
        [WBPredicates.annotationDescriptionLink]: [
          {
            value: WikibaseConfiguration?.Public + '/wiki/Annotation:' + id,
            qualifiers: {
              [WBPredicates.rightsOwner]: annotation.authors.map(d => d['id']),
              [WBPredicates.license]: annotation.licenses.map(d => d['id']),
            },
          },
        ],
      },
    };
    //console.log(spark)
    let edititem = await this.wbEdit.entity.edit(spark);

    let linkback = await this.wbEdit.entity.edit({
      id: 'Q' + annotation.targetMetadata,
      claims: {
        [WBPredicates.hasAnnotation]: [id],
      },
      reconciliation: {
        mode: 'merge',
      },
    });

    if (id === undefined) {
      throw new Error('Invalid id.');
    }

    return { item_id: id, claims: claims };
  }

  // update digital entity
  public async updateDigitalEntity(
    id: string | undefined,
    fullEntity: WikibaseDigitalEntity,
    claims: { [key: string]: string | string[] } = {},
    prevEntity: WikibaseDigitalEntity | undefined = undefined,
  ) {
    const entity = this.extractWikibaseExtensionData(fullEntity);
    const prev = prevEntity ? this.extractWikibaseExtensionData(prevEntity) : undefined;
    log(
      `updateDigitalEntity with id ${id} and entity ${JSON.stringify(entity)}, claims ${JSON.stringify(claims)}, prev ${JSON.stringify(prev)}`,
    );
    if (id === undefined) {
      const created = await this.wbEdit.entity.create({
        type: 'item',
        labels: { en: entity.label['en'] },
        descriptions: { en: entity.description },
      });
      id = created.entity.id;
    }
    log(`Now updating digital entity with id ${id}`);
    // traverse to pull back kompakkt link for object page.

    let digital_entity_data = await digitalEntityCollection.findOne({ wikibase_id: id });
    let entity_data = await entityCollection.findOne({
      'relatedDigitalEntity._id': '' + digital_entity_data?._id,
    });

    const wikibase_annotation_ids = await (async () => {
      if (typeof entity_data?.annotations !== 'object') return;
      // what should happen here - pull internal ids for all annotation.
      // convert these into wikibase ids, and feed into function below.

      const repo_annotation_ids = Object.keys(entity_data?.annotations).map(d => new ObjectId(d));
      return await annotationCollection.find({ _id: { $in: repo_annotation_ids } }).toArray();
    })();

    this.wbConnect.writeImage(id ?? '', entity_data?.settings.preview ?? '');

    let entity_id = '' + entity_data?._id;

    const model_events = new Array<{ value: string; qualifiers: { [x: string]: string[] } }>();

    let model_claims = {
      [WBPredicates.instance_of]: [WBClasses.media],
      [WBPredicates.license]: ['Q' + entity.licence],
      [WBPredicates.technique]: entity.techniques.map(d => d['id']),
      [WBPredicates.software]: entity.software.map(d => d['id']),
      [WBPredicates.objectOfRepresentation]: entity.physicalObjs.map(d => d['id']),
      [WBPredicates.bibliographicRef]: entity.bibliographicRefs.map(d => d['id']),
      [WBPredicates.equipment]: entity.equipment,
      [WBPredicates.entityLink]: 'https://' + Configuration.Express.Host + '/entity/' + entity_id,
      [WBPredicates.image]: 'Preview' + id + '.png',
      [WBPredicates.hasAnnotation]: wikibase_annotation_ids?.map(d => d['wikibase_id']) ?? [],
      [WBPredicates.externalLink]: entity.externalLinks,
      [WBPredicates.rightsOwner]: entity.agents
        .filter(d => d.roleTitle == 'Rightsowner')
        .map(d => d['id']),
      [WBPredicates.contactPerson]: entity.agents
        .filter(d => d.roleTitle == 'Contact Person')
        .map(d => d['id']),
    };

    let model_creator: any[] = entity.agents
      .filter(d => d.roleTitle == 'Creator')
      .map(d => d['id']);
    if (model_creator.length > 0) {
      model_events.push({
        value: WBClasses.creation,
        qualifiers: { [WBPredicates.carriedOutBy]: model_creator },
      });
    }

    let model_editor: any[] = entity.agents.filter(d => d.roleTitle == 'Editor').map(d => d['id']);
    if (model_editor.length > 0) {
      model_events.push({
        value: WBClasses.modification,
        qualifiers: { [WBPredicates.carriedOutBy]: model_editor },
      });
    }

    let model_data_creator: any[] = entity.agents
      .filter(d => d.roleTitle == 'Data Creator')
      .map(d => d['id']);
    if (model_data_creator.length > 0) {
      model_events.push({
        value: WBClasses.rawDataCreation,
        qualifiers: { [WBPredicates.carriedOutBy]: model_creator },
      });
    }

    model_claims[WBPredicates.hasEvent] = model_events;

    const edit_params = {
      id: id,
      clear: true,
      labels: {
        en: Array.isArray(entity.label['en']) ? entity.label['en'][0] : entity.label['en'],
      },
      descriptions: {
        en: Array.isArray(entity.description) ? entity.description[0] : entity.description,
      },
      claims: model_claims,
    };
    let edititem = await this.wbEdit.entity.edit(edit_params);
    console.log(edititem);
    // TODO not sure why error thrown if the following redundant code is removed

    if (id === undefined) {
      return undefined;
    }

    // TODO hierarchies refactor!
    // currently shows lineage for parents and siblings as expected.
    // what still needs to be fixed:
    // - siblings and parents together seem to cause reprint of subject
    // - resulting ids are q-code only not full path

    const object_array = entity.physicalObjs.map(d => d['id']);
    const process_hierarchies: IMediaHierarchy[][] = await Promise.all(
      object_array.map(d => this.fetchHierarchy(d)),
    );

    return { itemId: id, claims: claims, hierarchies: process_hierarchies.flat() };
  }

  public async fetchHierarchy(id: string): Promise<IMediaHierarchy[]> {
    console.log('fetching hierarchy for ' + id);

    const spark = getHierarchySpark(id);
    const results = (await this.wikibase_read<HierarchiesResponseItem>(spark)) ?? [];

    const parents: IWikibaseItem[] = [];
    const siblings: IWikibaseItem[] = [];

    for (const item of results) {
      const wikibaseItem = {
        id: item['item']['value'],
        label: { en: item['item']['label'] },
        type: item['type'],
      };
      if (wikibaseItem.type === 'parent') {
        parents.push(wikibaseItem);
      } else if (wikibaseItem.type === 'sibling') {
        siblings.push(wikibaseItem);
      }
    }

    return [{ parents: parents.reverse(), siblings: siblings }];
  }

  public async fetchMetadataChoices(): Promise<IMetadataChoices | undefined> {
    log('Fetching metadata choices from Wikibase');
    // // TODO this needs to be rethought as there will be "physical objects" which are not buildings.
    // // building ensemble will always be subclass of human-made object, although a room is not a "subclass of" a building!
    // // we could test a recursive "subclass of" or "has part" (tibt:P5*/tibt:P2*) and see how that performs

    // let building_class_ids = await this.wikibase_read('select ?parts where {tib:Q58 tibt:P5* ?parts}')
    // building_class_ids = building_class_ids.map(d => d['parts'])
    // result.physical_objs = await this.wikibase_class_instances(building_class_ids);

    // updated to pull all instances of humanMadeObject directly.
    try {
      const result = {
        persons: await this.wikibase_class_instances([WBClasses.human, WBClasses.organisation]),
        techniques: await this.wikibase_class_instances([WBClasses.technique]),
        software: await this.wikibase_class_instances([WBClasses.software]),
        roles: await this.wikibase_class_instances([WBClasses.role]),
        bibliographic_refs: await this.wikibase_class_instances([WBClasses.bibliographicRef]),
        physical_objs: await this.wikibase_class_instances([WBClasses.humanMadeObject]),
      } satisfies IMetadataChoices;
      return result;
    } catch (error) {
      err('Error fetching metadata choices from Wikibase', error);
      return undefined;
    }
  }

  public async fetchAnnotationLinkChoices(): Promise<IAnnotationLinkChoices | undefined> {
    if (!isWikibaseConfiguration(WikibaseConfiguration)) {
      return undefined;
    }

    try {
      const result = {
        relatedAgents: await this.wikibase_class_instances([WBClasses.human]),
        relatedMedia: await this.wikibase_class_instances([WBClasses.media]),
        relatedConcepts: await this.wikibase_class_instances([WBClasses.iconographicConcept]),
        licenses: await this.wikibase_class_instances([WBClasses.license]),
      } satisfies IAnnotationLinkChoices;
      log(
        `Fetched ${result.relatedAgents.length} related agents, ${result.relatedMedia.length} related media, ${result.relatedConcepts.length} related concepts, and ${result.licenses.length} licenses from Wikibase`,
      );
      return result;
    } catch (error) {
      err('Error fetching annotation link choices from Wikibase', error);
      return undefined;
    }
  }

  public async removeWikibaseItem(id: string) {
    this.wbEdit.entity.delete({ id: id });
  }

  public async wikibase_read<T extends unknown>(spark: string): Promise<T[] | undefined> {
    const query = this.wbSDK.sparqlQuery(spark);
    // info('wikibase_read wikibase-sdk sparqlQuery', query);

    const result = await get(query, {}).catch(error => {
      console.log('wikibase_read', error.message, error.config?.url);
      return undefined;
    });
    // info('wikibase_read result', Bun.inspect(result));

    if (!result) return undefined;
    //const result = await this.wbConnect.requestSDKquery(query);
    const simple = this.wbSDK.simplify.sparqlResults(result);
    // info('wikibase_read simplified result', Bun.inspect(simple));
    return simple as T[];
  }

  private async wikibase_class_instances(class_array: string[]) {
    const spark = getWikibaseClassInstancesSpark(class_array);

    const class_items = await this.wikibase_read<IWikibaseItem>(spark);
    if (!class_items) return [];

    // if thumb is defined we should convert it to a wikimedia special:Filepath Link, so it can resolve properly
    // https://wb.kompakkt.local/wiki/File:PreviewQ548.png -> https://wb.kompakkt.local/wiki/Special:FilePath/PreviewQ548.png
    //class_items.map(d => d['label'] = { 'en': d['label_en'] })
    return class_items.map(d => {
      // TODO: IWikibaseItem Typeguard
      const copy = structuredClone(d) as unknown as IWikibaseItem;
      if (copy['media'] !== undefined && typeof copy['media'] === 'string') {
        copy['media'] = copy['media'].replace('wiki/File:', 'wiki/Special:FilePath/');
      }
      copy['label'] = { en: (copy as any)['label_en'] ?? copy.label.en };
      return copy;
    });
  }

  private async wikibase_class_and_subclass_instances(class_array: string[]) {
    const spark = getWikibaseClassAndSubclassSpark(class_array);
    const class_items = await this.wikibase_read<IWikibaseItem>(spark);

    if (!class_items) return [];

    return class_items.map(d => {
      // TODO: IWikibaseItem Typeguard
      (d as any)['label'] = { en: d['label_en'] };
      return d as unknown as IWikibaseItem;
    });
  }

  // createAccount
  public async createAccount(username: string, password: string) {
    await this.wbConnect.createAccount(username, password);
  }

  //writeImage
  public async writeImage(id: string, image: string) {
    await this.wbConnect.writeImage(id, image);
  }

  public async fetchAnnotation(
    wikibase_id: string,
  ): Promise<IWikibaseAnnotationExtensionData | undefined> {
    console.log('fetching annotation', wikibase_id);

    const spark = getAnnotationMetadataSpark(wikibase_id);
    const simplifiedAnnotation = await this.wikibase_read<AnnotationResponseItem>(spark);

    if (!simplifiedAnnotation) {
      err('Annotation not found', wikibase_id, spark);
      return undefined;
    }

    const processedMetadata = this.processRawMetadata(simplifiedAnnotation);
    if (Object.keys(processedMetadata).length <= 0) {
      err('Annotation data empty', wikibase_id, simplifiedAnnotation, spark);
      return undefined;
    }

    let annotation = processedMetadata as any;

    const descriptionAuthors: IWikibaseItem[] = [];
    const descriptionLicenses: IWikibaseItem[] = [];
    const relatedMedia = this.processWikibaseItems(annotation, 'media') as IWikibaseItem[];

    //because SPARQL is weird, we have to concat the media related stuff here (and with the annotation)
    for (let i = 0; i < relatedMedia.length; i++) {
      relatedMedia[i].media = this.getPreviewImage(relatedMedia[i].id);
      // TODO: fist check if annotation.filView is array or just string
      relatedMedia[i].internalID = Array.isArray(annotation.fileView)
        ? annotation.fileView
        : annotation.fileView[i];
    }

    if (annotation.desc.agent) {
      descriptionAuthors.push({
        id: getQNumberFromURL(annotation.desc.agent),
        label: { en: annotation.desc.agentLabel },
      });
    }
    if (annotation.desc.license) {
      descriptionLicenses.push({
        id: getQNumberFromURL(annotation.desc.license),
        label: { en: annotation.desc.licenseLabel },
      });
    }

    const annotationData: IWikibaseAnnotationExtensionData = {
      id: wikibase_id,
      label: { en: annotation.label },
      description: annotation.desc.value,
      created: annotation.dateCreated,
      lastModificationDate: annotation.dateModified,
      validated: annotation.val,
      ranking: annotation.rank,
      motivation: annotation.motiv,
      cameraType: annotation.camType,
      cameraPosition: {
        x: parseFloat(annotation.cx),
        y: parseFloat(annotation.cy),
        z: parseFloat(annotation.cz),
      },
      cameraTarget: {
        x: parseFloat(annotation.ctx),
        y: parseFloat(annotation.cty),
        z: parseFloat(annotation.ctz),
      },
      selectorNormal: {
        x: parseFloat(annotation.sx),
        y: parseFloat(annotation.sy),
        z: parseFloat(annotation.sz),
      },
      targetMetadata: annotation.target,
      descriptionAuthors: descriptionAuthors,
      descriptionLicenses: descriptionLicenses,
      relatedMedia: relatedMedia,
      selectorPoint: {
        x: parseFloat(annotation.snx),
        y: parseFloat(annotation.sny),
        z: parseFloat(annotation.snz),
      },
      relatedEntities: this.processWikibaseItems(processedMetadata, 'concept') as IWikibaseItem[],
      relatedMediaUrls: this.processWikibaseItems(processedMetadata, 'mediaURL') as string[],
    };
    return annotationData;
  }

  getPreviewImage(id: string): string | undefined {
    //check if valid QNumber
    if (!id.startsWith('Q')) {
      return undefined;
    }
    return `${WikibaseConfiguration?.Domain}/wiki/Special:Filepath/Preview${id}.png`;
  }

  public async fetchWikibaseMetadata(
    wikibase_id: any,
  ): Promise<IWikibaseDigitalEntityExtensionData | undefined> {
    log('Fetching metadata from Wikibase for ' + wikibase_id);

    const spark = getDigitalEntityMetadataSpark(wikibase_id);
    const metadata = await this.wikibase_read<MetadataResponseItem>(spark);
    if (!metadata) {
      console.log('no metadata found');
      return undefined;
    }

    const processedMetadata = this.processRawMetadata(metadata);
    if (Object.keys(processedMetadata).length <= 0) {
      console.log('no metadata found');
      return undefined;
    }

    const licence = new WikibaseID(
      processedMetadata['licence'] ? processedMetadata['licence']['value'] : '',
    ).numericID;
    const digitalEntity = {
      id: wikibase_id,
      description: this.processWikibaseItems(processedMetadata, 'desc')
        .map(item => (typeof item === 'string' ? item : item.label.en))
        .join('.\n'),
      label: {
        en: this.processWikibaseItems(processedMetadata, 'label')
          .map(item => (typeof item === 'string' ? item : item.label.en))
          .join('.\n'),
      },
      licence: licence ?? '',
      creationDate: this.processWikibaseItems(processedMetadata, 'date').at(0),
      agents: this.getAgentsFromMetadata(processedMetadata),
      techniques: this.processWikibaseItems(processedMetadata, 'techniques'),
      software: this.processWikibaseItems(processedMetadata, 'software'),
      equipment: this.processWikibaseItems(processedMetadata, 'equipment'),
      externalLinks: this.processWikibaseItems(processedMetadata, 'externalLinks'),
      bibliographicRefs: this.processWikibaseItems(processedMetadata, 'bibliographicRefs'),
      physicalObjs: this.processWikibaseItems(processedMetadata, 'physicalObjs'),
      hierarchies: processedMetadata['physicalObjs']
        ? await this.fetchHierarchy(processedMetadata['physicalObjs']['value'] as string)
        : [],
    } satisfies IWikibaseDigitalEntityExtensionData;

    return digitalEntity;
  }

  public processWikibaseItems(
    metadata: ProcessedMetadata,
    key: string,
  ): Array<IWikibaseItem | string> {
    const value = metadata?.[key];
    if (!value) return [];

    const items: Array<IWikibaseItem | string> = [];

    if (Array.isArray(value)) {
      const mappedItems = value.map(item => {
        return isValueLabelItem(item)
          ? { id: item.value, label: { en: item.label } }
          : item.toString();
      });
      items.push(...mappedItems);
    } else if (typeof value === 'string' || typeof value === 'number') {
      items.push(value.toString());
    } else if (typeof value === 'object' && isValueLabelItem(value)) {
      items.push({
        id: value.value,
        label: { en: value.label },
      });
    }

    return items;
  }

  public processRawMetadata(rawMetadata: RawMetadata) {
    const processed: ProcessedMetadata = {};

    const equals = (a: MetadataField, b: MetadataField) => {
      if (
        (typeof a === 'string' && typeof b === 'string') ||
        (typeof a === 'number' && typeof b === 'number')
      ) {
        return a === b;
      } else if ((isValueLabelItem(a) && isValueLabelItem(b)) || (isDescItem(a) && isDescItem(b))) {
        return a.value === b.value;
      }
      return false;
    };

    for (const item of rawMetadata) {
      for (const key of Object.keys(item)) {
        const value = item[key];
        // If the key is not in acc, initialize it
        if (!processed[key]) processed[key] = value;

        if (Array.isArray(processed[key])) {
          // Check if the value already exists in the array
          const valueExists = processed[key].some(item => equals(item, value));
          // If the value doesn't exist, add it to the array
          if (!valueExists) processed[key].push(value);
        } else if (!equals(processed[key], value)) {
          // If the value is different, convert it into an array and add the new value
          processed[key] = [processed[key], value];
        }
      }
    }

    return processed;
  }

  public getAgentsFromMetadata(metadata: ProcessedMetadata): IMediaAgent[] {
    const agents: IMediaAgent[] = [];

    // Check if metadata is empty
    if (Object.keys(metadata).length <= 0) {
      return agents;
    }

    const addAgents = (roleTitle: string, roleKey: string, roleId: number) => {
      const value = metadata?.[roleKey];
      if (!value) return;
      const arr = Array.isArray(value) ? value : [value];
      const agentsForRole = arr
        .filter((agent): agent is ValueLabelItem => isValueLabelItem(agent))
        .map(agent => ({
          id: agent.value,
          label: { en: agent.label },
          role: roleId,
          roleTitle,
        }));
      agents.push(...agentsForRole);
    };

    addAgents('Rightsowner', 'rightsOwner', getIDfromWBEntity(WBValues.roleRightsOwner));
    addAgents('Data Creator', 'dataCreator', getIDfromWBEntity(WBValues.roleDataCreator));
    addAgents('Creator', 'creator', getIDfromWBEntity(WBValues.roleCreator));
    addAgents('Editor', 'editor', getIDfromWBEntity(WBValues.roleEditor));
    addAgents('Contact Person', 'contactperson', getIDfromWBEntity(WBValues.roleContactPerson));

    return agents;
  }
}
