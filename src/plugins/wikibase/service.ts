import { ObjectId } from 'mongodb';
import { asVector3 } from 'src/common';
import { Configuration } from 'src/configuration';
import { err, info, log, warn } from 'src/logger';
import { annotationCollection, digitalEntityCollection, entityCollection } from 'src/mongo';
import { pluginCache } from 'src/redis';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { get } from 'src/util/requests';
import WBEdit, { type ClaimData, type EntityEdit as WBEditEntityEdit } from 'wikibase-edit';
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
  getPQNumberFromID,
} from './common';
import {
  type WikibaseAnnotation,
  WikibaseConfiguration,
  type WikibaseDigitalEntity,
  isWikibaseConfiguration,
} from './config';
import { WikibaseConnector } from './connector';
import {
  WBAnnotationPredicates,
  WBClasses,
  WBLicenseMapping,
  WBLicenses,
  WBPredicates,
  WBValues,
} from './parsed-model';
import {
  getAnnotationMetadataSpark,
  getDigitalEntityMetadataSpark,
  getHierarchySpark,
  getWikibaseClassInstancesSpark,
} from './sparks';

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
const getMetadataFieldValue = (item: MetadataField): string => {
  if (typeof item === 'string' || typeof item === 'number') {
    return item.toString();
  }
  return item.value;
};
type RawMetadata = Record<string, MetadataField>[];
type ProcessedMetadata = Record<string, Array<MetadataField>>;

type HierarchiesResponseItem = {
  item: ValueLabelItem;
  type: string;
};

const extractWikibaseExtensionData = <
  T extends ServerDocument<WikibaseAnnotation> | ServerDocument<WikibaseDigitalEntity>,
>(
  obj: T,
) => {
  return obj.extensions?.wikibase as
    | UndoPartial<NonNullable<NonNullable<T['extensions']>['wikibase']>>
    | undefined;
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

const getIdFromCreationError = (error: unknown) => {
  if (!error) return undefined;
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

  public static getInstance(): WikibaseService | undefined {
    try {
      if (!WikibaseService.instance) {
        WikibaseService.instance = new WikibaseService();
      }
      return WikibaseService.instance;
    } catch (error) {
      warn(`Could not construct or retrieve WikibaseService instance: ${error}`);
      return undefined;
    }
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
      return data?.id ?? undefined;
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

    const connectorWriteResult = await this.wbConnect
      .writeAnnotation(id, annotation.description.en)
      .catch(error => {
        warn(`Failed writing annotation ${error}`);
        return false;
      });
    log('connectorWriteResult', connectorWriteResult);
    //TODO shouldnt this be in the writeAnnotation function?
    const fixedPos = 6;
    log(`related Media (kmpkt): ${JSON.stringify(annotation.media)}`);
    const { referenceNormal, referencePoint } = fullAnnotation.target.selector;
    const { position, target } = fullAnnotation.body.content.relatedPerspective;

    log('Wikibase Annotation target entity', targetEntity);

    const wikibaseDomain = WikibaseConfiguration?.Public ?? WikibaseConfiguration?.Domain;

    const spark = {
      id: id,
      clear: true,
      labels: wikibaseLabelToWBEditDescription(annotation.label),
      descriptions: wikibaseLabelToWBEditDescription(autogeneratedDescription),
      claims: {
        [WBPredicates.instanceOf]: [WBClasses.annotation],
        [WBAnnotationPredicates.cameraType]:
          fullAnnotation.body.content.relatedPerspective.cameraType,
        [WBAnnotationPredicates.perspectivePositionXAxis]: asVector3(position).x.toFixed(fixedPos),
        [WBAnnotationPredicates.perspectivePositionYAxis]: asVector3(position).y.toFixed(fixedPos),
        [WBAnnotationPredicates.perspectivePositionZAxis]: asVector3(position).z.toFixed(fixedPos),
        [WBAnnotationPredicates.perspectiveTargetXAxis]: asVector3(target).x.toFixed(fixedPos),
        [WBAnnotationPredicates.perspectiveTargetYAxis]: asVector3(target).y.toFixed(fixedPos),
        [WBAnnotationPredicates.perspectiveTargetZAxis]: asVector3(target).z.toFixed(fixedPos),
        [WBAnnotationPredicates.selectorRefPointXAxis]:
          asVector3(referencePoint).x.toFixed(fixedPos),
        [WBAnnotationPredicates.selectorRefPointYAxis]:
          asVector3(referencePoint).y.toFixed(fixedPos),
        [WBAnnotationPredicates.selectorRefPointZAxis]:
          asVector3(referencePoint).z.toFixed(fixedPos),
        [WBAnnotationPredicates.selectorRefNormalXAxis]:
          asVector3(referenceNormal).x.toFixed(fixedPos),
        [WBAnnotationPredicates.selectorRefNormalYAxis]:
          asVector3(referenceNormal).y.toFixed(fixedPos),
        [WBAnnotationPredicates.selectorRefNormalZAxis]:
          asVector3(referenceNormal).z.toFixed(fixedPos),
        [WBAnnotationPredicates.ranking]: fullAnnotation.ranking.toString(),
        [WBAnnotationPredicates.verified]: [WBValues.true],
        [WBAnnotationPredicates.hasMotivation]: [WBValues.describing],
        // P12: annotation.created, // library does not include support for edtf!
        [WBAnnotationPredicates.annotates]: targetEntity ? [targetEntity] : [],
        [WBAnnotationPredicates.relatedConcept]: annotation.entities.map(getIdFromWikibaseItem),
        [WBAnnotationPredicates.relatedMedia]: annotation.media.map(getIdFromWikibaseItem), //  this should work, issue with prefixes for now.
        [WBAnnotationPredicates.annotationText]: wikibaseDomain
          ? [
              {
                value: `${wikibaseDomain}/wiki/Annotation:${id}`,
                qualifiers: {
                  [WBPredicates.rightHeldBy]: annotation.authors.map(getIdFromWikibaseItem),
                  [WBPredicates.license]: annotation.licenses.map(getIdFromWikibaseItem),
                },
              },
            ]
          : [],
      },
    } satisfies WBEditEntityEdit;

    if (imageFilename) {
      spark.claims[WBPredicates.image] = imageFilename;
    }

    log('updateAnnotation spark', spark);
    const annotationEditResult = await this.wbEdit.entity.edit(spark).catch(error => {
      err(`Failed editing annotation: ${error}`);
      return undefined;
    });
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
  public async updateDigitalEntity(fullEntity: ServerDocument<WikibaseDigitalEntity>) {
    const entity = extractWikibaseExtensionData(fullEntity);
    if (!entity) {
      throw new Error('Digital entity is missing wikibase extension data');
    }
    let id: string | undefined = entity.id;
    log(`updateDigitalEntity with id ${id} and entity ${JSON.stringify(entity)}`);
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

    if (!parentEntity) {
      log('No parent entity found for digital entity', fullEntity._id);
      throw new Error('No parent entity found for digital entity');
    }

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

    const modelAgents: Record<NonNullable<IMediaAgent['roleTitle']>, string[]> = {
      'Rightsowner': [],
      'Creator': [],
      'Editor': [],
      'Data Creator': [],
      'Contact Person': [],
    };

    for (const agent of entity.agents) {
      if (agent.roleTitle && modelAgents[agent.roleTitle] !== undefined) {
        modelAgents[agent.roleTitle].push(agent.id);
      }
    }

    const editParams = {
      id: id,
      clear: true,
      labels: wikibaseLabelToWBEditDescription(entity.label),
      descriptions: wikibaseLabelToWBEditDescription(entity.description),
      claims: {
        [WBPredicates.instanceOf]: [WBClasses.mediaItem],
        [WBPredicates.license]: [WBLicenses[WBLicenseMapping[entity.licence]]],
        [WBPredicates.method]: entity.techniques.map(getIdFromWikibaseItem),
        [WBPredicates.softwareUsed]: entity.software.map(getIdFromWikibaseItem),
        [WBPredicates.objectOfRepresentation]: entity.physicalObjs.map(getIdFromWikibaseItem),
        [WBPredicates.documentedIn]: entity.bibliographicRefs.map(getIdFromWikibaseItem),
        [WBPredicates.equipment]: entity.equipment.map(getIdFromWikibaseItem),
        [WBPredicates.fileView]: `${Configuration.Server.PublicURL}/entity/${parentEntity._id}`,
        [WBPredicates.hasAnnotation]:
          wikibaseAnnotationIds
            ?.map(d => d.extensions?.wikibase?.id)
            ?.filter((id): id is string => typeof id === 'string') ?? [],
        [WBPredicates.externalLink]: entity.externalLinks.map(getIdFromWikibaseItem),
        [WBPredicates.rightHeldBy]: modelAgents['Rightsowner'],
        [WBPredicates.contactPerson]: modelAgents['Contact Person'],
      },
    } satisfies WBEditEntityEdit;

    if (imageFilename) {
      editParams.claims[WBPredicates.image] = imageFilename;
    }

    if (modelAgents['Data Creator'].length > 0) {
      editParams.claims[WBPredicates.createdBy ?? WBPredicates.hasEvent] ??= [];
      (editParams.claims[WBPredicates.createdBy ?? WBPredicates.hasEvent] as ClaimData[]).push({
        value: WBClasses.rawDataCreation,
        qualifiers: {
          [WBPredicates.carriedOutBy]: modelAgents['Data Creator'],
        },
      });
    }

    if (modelAgents['Creator'].length > 0) {
      editParams.claims[WBPredicates.createdBy ?? WBPredicates.hasEvent] ??= [];
      (editParams.claims[WBPredicates.createdBy ?? WBPredicates.hasEvent] as ClaimData[]).push({
        value: WBClasses.creation,
        qualifiers: {
          [WBPredicates.carriedOutBy]: modelAgents['Creator'],
        },
      });
    }

    if (modelAgents['Editor'].length > 0) {
      editParams.claims[WBPredicates.modifiedBy ?? WBPredicates.hasEvent] ??= [];
      (editParams.claims[WBPredicates.modifiedBy ?? WBPredicates.hasEvent] as ClaimData[]).push({
        value: WBClasses.modification,
        qualifiers: {
          [WBPredicates.carriedOutBy]: modelAgents['Editor'],
        },
      });
    }

    for (const claim in editParams.claims) {
      const value = editParams.claims[claim];
      if (value === undefined || value === null) {
        delete editParams.claims[claim];
      }
    }

    log('wbEdit digitalEntity editParams', editParams);
    const edititem = await this.wbEdit.entity.edit(editParams);
    log('wbEdit digitalEntity edit result', edititem);
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

    return { itemId: id, claims: editParams.claims, hierarchies: processHierarchies.flat() };
  }

  public async fetchHierarchy(id: string): Promise<IMediaHierarchy[]> {
    log(`fetching hierarchy for ${id}`);

    const spark = getHierarchySpark(id);
    const results = (await this.wikibaseRead<HierarchiesResponseItem>(spark)) ?? [];

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

  public async fetchMetadataChoices(force?: boolean): Promise<IMetadataChoices | undefined> {
    log('Fetching metadata choices from Wikibase');
    // // TODO this needs to be rethought as there will be "physical objects" which are not buildings.
    // // building ensemble will always be subclass of human-made object, although a room is not a "subclass of" a building!
    // // we could test a recursive "subclass of" or "has part" (tibt:P5*/tibt:P2*) and see how that performs

    // let building_class_ids = await this.wikibaseRead('select ?parts where {tib:Q58 tibt:P5* ?parts}')
    // building_class_ids = building_class_ids.map(d => d['parts'])
    // result.physical_objs = await this.wikibaseClassInstances(building_class_ids);

    // updated to pull all instances of humanMadeObject directly.
    const cached = await pluginCache.get<IMetadataChoices>('wikibase::fetchMetadataChoices');
    if (cached && !force) {
      log('Returning cached metadata choices from Wikibase');
      return cached;
    }
    try {
      const result = {
        persons: await this.wikibaseClassInstances([WBClasses.human, WBClasses.organization]),
        techniques: await this.wikibaseClassInstances([WBClasses.technique]),
        software: await this.wikibaseClassInstances([WBClasses.software]),
        bibliographic_refs: await this.wikibaseClassInstances([WBClasses.bibliographicWork]),
        physical_objs: await this.wikibaseClassInstances([WBClasses.humanMadeObject]),
      } satisfies IMetadataChoices;
      log(
        `Fetched ${result.persons.length} persons, ${result.techniques.length} techniques, ${result.software.length} software, ${result.bibliographic_refs.length} bibliographic references, and ${result.physical_objs.length} physical objects from Wikibase`,
      );
      pluginCache.set('wikibase::fetchMetadataChoices', result, 60);
      return result;
    } catch (error) {
      err('Error fetching metadata choices from Wikibase', error);
      return undefined;
    }
  }

  public async fetchAnnotationLinkChoices(
    force?: boolean,
  ): Promise<IAnnotationLinkChoices | undefined> {
    if (!isWikibaseConfiguration(WikibaseConfiguration)) {
      return undefined;
    }

    const cached = await pluginCache.get<IAnnotationLinkChoices>(
      'wikibase::fetchAnnotationLinkChoices',
    );
    if (cached && !force) {
      log('Returning cached annotation link choices from Wikibase');
      return cached;
    }
    try {
      const result = {
        relatedAgents: await this.wikibaseClassInstances([WBClasses.human]),
        relatedMedia: await this.wikibaseClassInstances([WBClasses.mediaItem]),
        relatedConcepts: await this.wikibaseClassInstances([WBClasses.iconographicConcept]),
        licenses: await this.wikibaseClassInstances([WBClasses.licence]),
      } satisfies IAnnotationLinkChoices;
      log(
        `Fetched ${result.relatedAgents.length} related agents, ${result.relatedMedia.length} related media, ${result.relatedConcepts.length} related concepts, and ${result.licenses.length} licenses from Wikibase`,
      );
      pluginCache.set('wikibase::fetchAnnotationLinkChoices', result, 60);
      return result;
    } catch (error) {
      err('Error fetching annotation link choices from Wikibase', error);
      return undefined;
    }
  }

  public async removeWikibaseItem(id: string) {
    this.wbEdit.entity.delete({ id: id });
  }

  public async wikibaseRead<T>(spark: string): Promise<T[] | undefined> {
    // info('wikibaseRead wikibase-sdk', spark);
    const query = this.wbSDK.sparqlQuery(spark);
    // info('wikibaseRead wikibase-sdk sparqlQuery', query);

    const result = await get(query, {}).catch(error => {
      log('wikibaseRead', error.message, error.config?.url);
      return undefined;
    });
    // info('wikibaseRead result', Bun.inspect(result));

    if (!result) return undefined;
    //const result = await this.wbConnect.requestSDKquery(query);
    const simple = this.wbSDK.simplify.sparqlResults(result);
    // info('wikibaseRead simplified result', Bun.inspect(simple));
    return simple as T[];
  }

  private async wikibaseClassInstances(classArray: string[]) {
    const spark = getWikibaseClassInstancesSpark(classArray);

    const items = await this.wikibaseRead<IWikibaseItem>(spark);
    if (!items) return [];

    // if thumb is defined we should convert it to a wikimedia special:Filepath Link, so it can resolve properly
    // https://wb.kompakkt.local/wiki/File:PreviewQ548.png -> https://wb.kompakkt.local/wiki/Special:FilePath/PreviewQ548.png
    //items.map(d => d['label'] = { 'en': d['label_en'] })
    return items.map(d => {
      // TODO: IWikibaseItem Typeguard
      const copy = structuredClone(d) as unknown as IWikibaseItem;
      if (copy.media !== undefined && typeof copy.media === 'string') {
        copy.media = copy.media.replace('wiki/File:', 'wiki/Special:FilePath/');
      }

      // Add label object
      copy.label ??= {};
      for (const labelKey of Object.keys(copy).filter(p => p.startsWith('label_'))) {
        const lang = labelKey.replace('label_', '');
        copy.label[lang] = (copy as any)[labelKey];
      }
      return copy;
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
    const simplifiedAnnotation = await this.wikibaseRead<AnnotationResponseItem>(spark);

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
      const agentId = getPQNumberFromID(annotation.desc.agent);
      if (agentId)
        descriptionAuthors.push({
          id: agentId.toString(),
          label: { en: annotation.desc.agentLabel },
        });
    }
    if (annotation.desc.license) {
      const licenseId = getPQNumberFromID(annotation.desc.license);
      if (licenseId)
        descriptionLicenses.push({
          id: licenseId.toString(),
          label: { en: annotation.desc.licenseLabel },
        });
    }

    const annotationData = {
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
    wikibase_id: string,
  ): Promise<IWikibaseDigitalEntityExtensionData | undefined> {
    log(`Fetching metadata from Wikibase for ${wikibase_id}`);

    const spark = getDigitalEntityMetadataSpark(wikibase_id);
    const metadata = await this.wikibaseRead<MetadataResponseItem>(spark);
    if (!metadata) {
      log('no metadata found');
      return undefined;
    }

    const processedMetadata = this.processRawMetadata(metadata);
    if (Object.keys(processedMetadata).length <= 0) {
      log('no metadata found');
      return undefined;
    }

    const licence = getPQNumberFromID(processedMetadata.licence);
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

    const items: Array<IWikibaseItem | string> = value.map(item => {
      return isValueLabelItem(item)
        ? { id: item.value, label: { en: item.label } }
        : isDescItem(item)
          ? {
              id: item.value,
              label: { en: item.value },
            }
          : item.toString();
    });

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
        if (!processed[key]) processed[key] = [value];
        // Check if the value already exists in the array
        const valueExists = processed[key].some(item => equals(item, value));
        // If the value doesn't exist, add it to the array
        if (!valueExists) processed[key].push(value);
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

    const addAgents = (roleTitle: string, roleKey: string) => {
      const value = metadata?.[roleKey];
      if (!value) return;
      const arr = Array.isArray(value) ? value : [value];
      const agentsForRole = arr
        .filter((agent): agent is ValueLabelItem => isValueLabelItem(agent))
        .map(agent => ({
          id: agent.value,
          label: { en: agent.label },
          roleTitle,
        }));
      agents.push(...agentsForRole);
    };

    addAgents('Rightsowner', 'rightsOwner');
    addAgents('Data Creator', 'dataCreator');
    addAgents('Creator', 'creator');
    addAgents('Editor', 'editor');
    addAgents('Contact Person', 'contactperson');

    return agents;
  }
}
