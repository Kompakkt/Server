import { ObjectId } from 'mongodb';
import { Configuration } from 'src/configuration';
import { err, info, log } from 'src/logger';
import { annotationCollection, digitalEntityCollection, entityCollection } from 'src/mongo';
import { RequestClient, get } from 'src/util/requests';
import WBEdit from 'wikibase-edit';
import WBK from 'wikibase-sdk';
import {
  type IAnnotationLinkChoices,
  type IMediaAgent,
  type IMediaHierarchy,
  type IMetadataChoices,
  type IWikibaseAnnotationExtensionData,
  type IWikibaseDigitalEntityExtensionData,
  type IWikibaseItem,
  type IWikibaseLabel,
  WBClasses,
  WBPredicates,
  WBValues,
  WikibaseID,
  getAnnotationMetadataSpark,
  getDigitalEntityMetadataSpark,
  getHierarchySpark,
  getIDfromWBEntity,
  getQNumberFromURL,
  getWikibaseClassAndSubclassSpark,
  getWikibaseClassInstancesSpark,
  isWikibaseConfiguration,
} from './common';
import {
  type WikibaseAnnotation,
  WikibaseConfiguration,
  type WikibaseDigitalEntity,
} from './config';
import { WikibaseConnector } from './connector';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { asVector3 } from 'src/common';

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

const extractWikibaseExtensionData = <
  T extends ServerDocument<WikibaseAnnotation> | ServerDocument<WikibaseDigitalEntity>,
>(
  obj: T,
) => {
  return obj.extensions?.wikibase! as UndoPartial<
    NonNullable<NonNullable<T['extensions']>['wikibase']>
  >;
};

const wikibaseLabelToWBEditDescription = (item: IWikibaseLabel) => {
  const obj: Record<string, { value: string }> = {};
  for (const language in item) {
    obj[language] = { value: item[language] };
  }
  return obj;
};

const getIdFromWikibaseItem = (item: string | IWikibaseItem) => {
  if (typeof item === 'string') {
    return item;
  }
  return item.id;
};

const getIdFromCreationError = (error: any) => {
  const errorString = error.toString() as string;

  if (!errorString.includes('modification-failed')) {
    log('Error creating entity:', errorString);
    return undefined;
  }
  log('Existing entity with modification failure, extracting id');
  const matchedId = Array.from(errorString.matchAll(/\[\[Item\:Q(\d+)\|Q(\d+)\]\]/gi))
    .find(r => r[1] === r[2])
    ?.at(-1);
  if (!matchedId) {
    throw new Error('Failed to extract id from creation error\n\nError: ' + errorString);
  }
  return `Q${matchedId}`;
};

export class WikibaseService {
  static instance: WikibaseService;
  wbConnect: WikibaseConnector;
  wbEdit: ReturnType<typeof WBEdit>;
  wbSDK: ReturnType<typeof WBK>;

  constructor() {
    const instance = WikibaseConfiguration?.Domain;
    const username = WikibaseConfiguration?.AdminUsername;
    const password = WikibaseConfiguration?.AdminPassword;
    const sparqlEndpoint = WikibaseConfiguration?.SPARQLEndpoint;

    if (!instance || !username || !password || !sparqlEndpoint) {
      throw new Error('Wikibase configuration not found');
    }

    this.wbConnect = new WikibaseConnector(instance, { username, password });
    this.wbEdit = WBEdit({ instance, credentials: { username, password } });
    this.wbSDK = WBK({ instance, sparqlEndpoint });
  }

  public static getInstance(): WikibaseService {
    if (!WikibaseService.instance) {
      WikibaseService.instance = new WikibaseService();
    }
    return WikibaseService.instance;
  }

  // update annotation
  public async updateAnnotation(
    fullAnnotation: ServerDocument<WikibaseAnnotation>,
    claims: { [key: string]: string | string[] } = {},
  ) {
    const annotation = extractWikibaseExtensionData(fullAnnotation);
    if (!annotation?.label || !annotation?.description) {
      throw new Error('Annotation is missing label or description');
    }

    const targetEntity = await (async () => {
      const relatedEntity = await entityCollection.findOne({
        _id: new ObjectId(fullAnnotation.target.source.relatedEntity),
      });
      if (!relatedEntity) return undefined;
      const digitalEntity = await digitalEntityCollection.findOne({
        _id: new ObjectId(relatedEntity.relatedDigitalEntity._id),
      });
      if (!digitalEntity) return undefined;
      const wikibaseEntity = digitalEntity as WikibaseDigitalEntity;
      const data = extractWikibaseExtensionData(wikibaseEntity);
      return data.id;
    })().catch(error => {
      log(`Failed retrieving target wikibase item of annotation`, annotation, id, error);
      return undefined;
    });

    const autogeneratedDescription: IWikibaseLabel = {
      en: targetEntity
        ? `Annotation on ${targetEntity} created at ${new Date().toISOString()}`
        : `Annotation created at ${new Date().toISOString()}`,
    };

    let id: string | undefined = annotation.id;
    if (!id) {
      const createRequest = {
        type: 'item',
        labels: wikibaseLabelToWBEditDescription(annotation.label),
        descriptions: wikibaseLabelToWBEditDescription(autogeneratedDescription),
      } as const;
      log('createRequest', createRequest);
      id = await this.wbEdit.entity
        .create(createRequest)
        .then(created => created.entity.id)
        .catch(getIdFromCreationError)
        .catch(error => {
          err(error);
          return undefined;
        });
      if (!id) throw new Error('Failed to create entity');
    }

    log('Wikibase Annotation with id', id);

    const preview = fullAnnotation.body.content.relatedPerspective.preview;
    const imageFilename = preview ? await this.wbConnect.writeImage(id, preview) : undefined;

    const connectorWriteResult = await this.wbConnect.writeAnnotation(
      id,
      annotation.description.en,
    );
    log('connectorWriteResult', connectorWriteResult);
    //TODO shouldnt this be in the writeAnnotation function?
    const fixedPos = 6;
    log(`related Media (kmpkt): ${JSON.stringify(annotation.media)}`);
    const { referenceNormal, referencePoint } = fullAnnotation.target.selector;
    const { position, target } = fullAnnotation.body.content.relatedPerspective;

    log('Wikibase Annotaiton target entity', targetEntity);

    const wikibaseDomain = WikibaseConfiguration?.Public ?? WikibaseConfiguration?.Domain;

    const spark = {
      id: id,
      clear: true,
      labels: wikibaseLabelToWBEditDescription(annotation.label),
      descriptions: wikibaseLabelToWBEditDescription(autogeneratedDescription),
      claims: {
        [WBPredicates.instance_of]: [WBClasses.annotation],
        [WBPredicates.cameraType]: fullAnnotation.body.content.relatedPerspective.cameraType,
        [WBPredicates.perspectivePositionX]: asVector3(position).x.toFixed(fixedPos),
        [WBPredicates.perspectivePositionY]: asVector3(position).y.toFixed(fixedPos),
        [WBPredicates.perspectivePositionZ]: asVector3(position).z.toFixed(fixedPos),
        [WBPredicates.perspectiveTargetX]: asVector3(target).x.toFixed(fixedPos),
        [WBPredicates.perspectiveTargetY]: asVector3(target).y.toFixed(fixedPos),
        [WBPredicates.perspectiveTargetZ]: asVector3(target).z.toFixed(fixedPos),
        [WBPredicates.selectorPositionX]: asVector3(referencePoint).x.toFixed(fixedPos),
        [WBPredicates.selectorPositionY]: asVector3(referencePoint).y.toFixed(fixedPos),
        [WBPredicates.selectorPositionZ]: asVector3(referencePoint).z.toFixed(fixedPos),
        [WBPredicates.selectorNormalX]: asVector3(referenceNormal).x.toFixed(fixedPos),
        [WBPredicates.selectorNormalY]: asVector3(referenceNormal).y.toFixed(fixedPos),
        [WBPredicates.selectorNormalZ]: asVector3(referenceNormal).z.toFixed(fixedPos),
        [WBPredicates.annotationRanking]: fullAnnotation.ranking,
        [WBPredicates.annotationVerified]: [WBValues.true],
        [WBPredicates.annotationMotivation]: [WBValues.motivationDescribing],
        // P12: annotation.created, // library does not include support for edtf!
        [WBPredicates.targetEntity]: targetEntity ? [targetEntity] : [],
        [WBPredicates.annotationRelatedConcepts]: annotation.entities.map(getIdFromWikibaseItem),
        [WBPredicates.annotationRelatedMedia]: annotation.media.map(getIdFromWikibaseItem), //  this should work, issue with prefixes for now.
        [WBPredicates.image]: imageFilename,
        [WBPredicates.annotationDescriptionLink]: wikibaseDomain
          ? [
              {
                value: `${wikibaseDomain}/wiki/Annotation:${id}`,
                qualifiers: {
                  [WBPredicates.rightsOwner]: annotation.authors.map(getIdFromWikibaseItem),
                  [WBPredicates.license]: annotation.licenses.map(getIdFromWikibaseItem),
                },
              },
            ]
          : [],
      },
    };

    const annotationEditResult = await this.wbEdit.entity.edit(spark);
    log('updateAnnotation result', annotationEditResult);

    if (targetEntity) {
      const linkbackResult = await this.wbEdit.entity
        .edit({
          id: targetEntity,
          claims: {
            [WBPredicates.hasAnnotation]: [id],
          },
          reconciliation: {
            mode: 'merge',
          },
        })
        .catch(error => error.toString());

      log('Linkback result:', linkbackResult);
    }

    return { itemId: id, claims: claims };
  }

  // update digital entity
  public async updateDigitalEntity(
    fullEntity: ServerDocument<WikibaseDigitalEntity>,
    claims: { [key: string]: string | string[] } = {},
  ) {
    const entity = extractWikibaseExtensionData(fullEntity);
    let id: string | undefined = entity.id;
    log(
      `updateDigitalEntity with id ${id} and entity ${JSON.stringify(entity)}, claims ${JSON.stringify(claims)}`,
    );
    if (!id) {
      const createRequest = {
        type: 'item',
        labels: wikibaseLabelToWBEditDescription(entity.label),
        descriptions: wikibaseLabelToWBEditDescription(entity.description),
      } as const;
      log('createRequest', createRequest);
      id = await this.wbEdit.entity
        .create(createRequest)
        .then(created => created.entity.id)
        .catch(getIdFromCreationError)
        .catch(error => {
          err(error);
          return undefined;
        });
      if (!id) throw new Error('Failed to create entity');
    }
    log(`Now updating digital entity with id ${id}`);
    // traverse to pull back kompakkt link for object page.

    const parentEntity = await entityCollection.findOne({
      'relatedDigitalEntity._id': fullEntity._id.toString(),
    });

    const wikibaseAnnotationIds = await (async () => {
      if (typeof parentEntity?.annotations !== 'object') return;
      // what should happen here - pull internal ids for all annotation.
      // convert these into wikibase ids, and feed into function below.

      const repoAnnotationIds = Object.keys(parentEntity?.annotations).map(d => new ObjectId(d));
      const annotations = await annotationCollection
        .find({ _id: { $in: repoAnnotationIds } })
        .toArray();
      return annotations as Array<WikibaseAnnotation>;
    })();

    const imageFilename = parentEntity
      ? await this.wbConnect.writeImage(id, parentEntity?.settings.preview ?? '')
      : undefined;
    log('updateDigitalEntity writeImage result', {
      imageFilename,
      preview: parentEntity?.settings.preview,
      id,
    });

    const modelEvents = new Array<{ value: string; qualifiers: { [x: string]: string[] } }>();
    const modelCreator: any[] = entity.agents.filter(d => d.roleTitle === 'Creator').map(d => d.id);
    if (modelCreator.length > 0) {
      modelEvents.push({
        value: WBClasses.creation,
        qualifiers: { [WBPredicates.carriedOutBy]: modelCreator },
      });
    }

    const modelEditor: any[] = entity.agents.filter(d => d.roleTitle === 'Editor').map(d => d.id);
    if (modelEditor.length > 0) {
      modelEvents.push({
        value: WBClasses.modification,
        qualifiers: { [WBPredicates.carriedOutBy]: modelEditor },
      });
    }

    const modelDataCreator: any[] = entity.agents
      .filter(d => d.roleTitle === 'Data Creator')
      .map(d => d.id);
    if (modelDataCreator.length > 0) {
      modelEvents.push({
        value: WBClasses.rawDataCreation,
        qualifiers: { [WBPredicates.carriedOutBy]: modelCreator },
      });
    }

    const modelClaims = {
      [WBPredicates.instance_of]: [WBClasses.media],
      [WBPredicates.license]: [`Q${entity.licence}`],
      [WBPredicates.technique]: entity.techniques.map(getIdFromWikibaseItem),
      [WBPredicates.software]: entity.software.map(getIdFromWikibaseItem),
      [WBPredicates.objectOfRepresentation]: entity.physicalObjs.map(getIdFromWikibaseItem),
      [WBPredicates.bibliographicRef]: entity.bibliographicRefs.map(getIdFromWikibaseItem),
      [WBPredicates.equipment]: entity.equipment.map(getIdFromWikibaseItem),
      [WBPredicates.entityLink]: parentEntity
        ? `https://${Configuration.Express.Host}/entity/${parentEntity._id}`
        : undefined,
      [WBPredicates.image]: imageFilename,
      [WBPredicates.hasAnnotation]:
        wikibaseAnnotationIds
          ?.map(d => d.extensions?.wikibase?.id)
          ?.filter((id): id is string => typeof id === 'string') ?? [],
      [WBPredicates.externalLink]: entity.externalLinks.map(getIdFromWikibaseItem),
      [WBPredicates.rightsOwner]: entity.agents
        .filter(d => d.roleTitle === 'Rightsowner')
        .map(d => d.id),
      [WBPredicates.contactPerson]: entity.agents
        .filter(d => d.roleTitle === 'Contact Person')
        .map(d => d.id),
      [WBPredicates.hasEvent]: modelEvents,
    };

    for (const claim in modelClaims) {
      const value = (modelClaims as any)[claim];
      if (value === undefined) {
        delete (modelClaims as any)[claim];
      }
    }

    const editParams = {
      id: id,
      clear: true,
      labels: wikibaseLabelToWBEditDescription(entity.label),
      descriptions: wikibaseLabelToWBEditDescription(entity.description),
      claims: modelClaims,
    } as const;
    const edititem = await this.wbEdit.entity.edit(editParams);
    log(edititem);
    // TODO not sure why error thrown if the following redundant code is removed

    if (id === undefined) {
      return undefined;
    }

    // TODO hierarchies refactor!
    // currently shows lineage for parents and siblings as expected.
    // what still needs to be fixed:
    // - siblings and parents together seem to cause reprint of subject
    // - resulting ids are q-code only not full path

    const physicalObjs = entity.physicalObjs.map(getIdFromWikibaseItem);
    const processHierarchies: IMediaHierarchy[][] = await Promise.all(
      physicalObjs.map(d => this.fetchHierarchy(d)),
    );

    return { itemId: id, claims: claims, hierarchies: processHierarchies.flat() };
  }

  public async fetchHierarchy(id: string): Promise<IMediaHierarchy[]> {
    log(`fetching hierarchy for ${id}`);

    const spark = getHierarchySpark(id);
    const results = (await this.wikibase_read<HierarchiesResponseItem>(spark)) ?? [];

    const parents: IWikibaseItem[] = [];
    const siblings: IWikibaseItem[] = [];

    for (const item of results) {
      const wikibaseItem = {
        id: item.item.value,
        label: { en: item.item.label },
        type: item.type,
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

  public async wikibase_read<T>(spark: string): Promise<T[] | undefined> {
    const query = this.wbSDK.sparqlQuery(spark);
    // info('wikibase_read wikibase-sdk sparqlQuery', query);

    const result = await get(query, {}).catch(error => {
      log('wikibase_read', error.message, error.config?.url);
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
      if (copy.media !== undefined && typeof copy.media === 'string') {
        copy.media = copy.media.replace('wiki/File:', 'wiki/Special:FilePath/');
      }
      copy.label = { en: (copy as any).label_en ?? copy.label.en };
      return copy;
    });
  }

  private async wikibase_class_and_subclass_instances(class_array: string[]) {
    const spark = getWikibaseClassAndSubclassSpark(class_array);
    const class_items = await this.wikibase_read<IWikibaseItem>(spark);

    if (!class_items) return [];

    return class_items.map(d => {
      // TODO: IWikibaseItem Typeguard
      (d as any).label = { en: d.label_en };
      return d as unknown as IWikibaseItem;
    });
  }

  // createAccount
  public async createAccount(username: string, password: string) {
    await this.wbConnect.createAccount(username, password);
  }

  public async fetchAnnotation(
    wikibase_id: string,
  ): Promise<IWikibaseAnnotationExtensionData | undefined> {
    log('fetching annotation', wikibase_id);

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

    const annotation = processedMetadata as any;

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
        x: Number.parseFloat(annotation.cx),
        y: Number.parseFloat(annotation.cy),
        z: Number.parseFloat(annotation.cz),
      },
      cameraTarget: {
        x: Number.parseFloat(annotation.ctx),
        y: Number.parseFloat(annotation.cty),
        z: Number.parseFloat(annotation.ctz),
      },
      selectorNormal: {
        x: Number.parseFloat(annotation.sx),
        y: Number.parseFloat(annotation.sy),
        z: Number.parseFloat(annotation.sz),
      },
      targetMetadata: annotation.target,
      descriptionAuthors: descriptionAuthors,
      descriptionLicenses: descriptionLicenses,
      relatedMedia: relatedMedia,
      selectorPoint: {
        x: Number.parseFloat(annotation.snx),
        y: Number.parseFloat(annotation.sny),
        z: Number.parseFloat(annotation.snz),
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
    log(`Fetching metadata from Wikibase for ${wikibase_id}`);

    const spark = getDigitalEntityMetadataSpark(wikibase_id);
    const metadata = await this.wikibase_read<MetadataResponseItem>(spark);
    if (!metadata) {
      log('no metadata found');
      return undefined;
    }

    const processedMetadata = this.processRawMetadata(metadata);
    if (Object.keys(processedMetadata).length <= 0) {
      log('no metadata found');
      return undefined;
    }

    const licence = new WikibaseID(processedMetadata.licence ? processedMetadata.licence.value : '')
      .numericID;
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
      hierarchies: processedMetadata.physicalObjs
        ? await this.fetchHierarchy(processedMetadata.physicalObjs.value as string)
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
      }
      if ((isValueLabelItem(a) && isValueLabelItem(b)) || (isDescItem(a) && isDescItem(b))) {
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
