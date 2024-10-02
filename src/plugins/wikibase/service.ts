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
import { err, log } from 'src/logger';
import { annotationCollection, digitalEntityCollection, entityCollection } from 'src/mongo';
import { get, RequestClient } from 'src/util/requests';

type UndoPartial<T> = T extends Partial<infer R> ? R : T;

export class WikibaseService {
  private static instance: WikibaseService;
  private wbConnect: WikibaseConnector;
  private wbEdit: ReturnType<typeof WBEdit>;
  private wbSDK: ReturnType<typeof WBK>;

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
    claims: { [key: string]: any } = {},
    prevAnnotation: WikibaseAnnotation | undefined = undefined,
    preview: string | undefined = undefined,
  ) {
    const annotation = this.extractWikibaseExtensionData(fullAnnotation);
    const prev = prevAnnotation ? this.extractWikibaseExtensionData(prevAnnotation) : undefined;
    if (id === undefined) {
      console.log('id is undefined');
      let create = await this.wbEdit.entity.create({
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
    let spark = {
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
    claims: { [key: string]: any } = {},
    prevEntity: WikibaseDigitalEntity | undefined = undefined,
  ) {
    const entity = this.extractWikibaseExtensionData(fullEntity);
    const prev = prevEntity ? this.extractWikibaseExtensionData(prevEntity) : undefined;
    log(
      `updateDigitalEntity with id ${id} and entity ${JSON.stringify(entity)}, claims ${JSON.stringify(claims)}, prev ${JSON.stringify(prev)}`,
    );
    if (id === undefined) {
      let created = await this.wbEdit.entity.create({
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

    let model_events: any[] = [];

    let model_claims = {
      [WBPredicates.instance_of]: [WBClasses.media],
      [WBPredicates.license]: ['Q' + entity.licence],
      [WBPredicates.technique]: entity.techniques.map(d => d['id']),
      [WBPredicates.software]: entity.software.map(d => d['id']),
      [WBPredicates.objectOfRepresentation]: entity.physicalObjs.map(d => d['id']),
      [WBPredicates.bibliographicRef]: entity.bibliographicRefs.map(d => d['id']),
      [WBPredicates.equipment]: entity.equipment,
      [WBPredicates.entityLink]: 'https://' + Configuration.Server.Host + '/entity/' + entity_id,
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

    let hierarchies: IMediaHierarchy[] = [];
    let object_array = entity.physicalObjs.map(d => d['id']);
    let process_hierarchies: IMediaHierarchy[][] = await Promise.all(
      object_array.map(d => this.fetchHierarchy(d)),
    );
    if (process_hierarchies.length > 1) {
      hierarchies = process_hierarchies.flat();
    }

    return { itemId: id, claims: claims, hierarchies };
  }

  public async fetchHierarchy(id: string): Promise<IMediaHierarchy[]> {
    console.log('fetching hierarchy for ' + id);

    const query = `
    SELECT ?type ?item ?itemLabel WHERE {
      {
        tib:${id} tibt:${WBPredicates.isPartOf}* ?item.
        BIND("parent" AS ?type)
      } UNION {
        tib:${id} tibt:${WBPredicates.isPartOf} ?parent.
        ?item tibt:${WBPredicates.isPartOf} ?parent.
        BIND("sibling" AS ?type)
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    }
    `;

    const results = await this.wikibase_read(query);
    if (!results) return [];

    const hierarchy = results.reduce(
      (acc: { parents: IWikibaseItem[]; siblings: IWikibaseItem[] }, d: any) => {
        d['id'] = d['item']['value'];
        d['label'] = { en: d['item']['label'] };
        delete d['item'];
        if (d.type === 'parent') {
          acc.parents.push(d);
        } else if (d.type === 'sibling') {
          acc.siblings.push(d);
        }
        return acc;
      },
      { parents: [], siblings: [] },
    );

    hierarchy.parents.reverse();
    return [hierarchy];
  }

  public async fetchMetadataChoices(): Promise<IMetadataChoices | undefined> {
    log('Fetching metadata choices from Wikibase');

    let result: any = {};
    result.persons = await this.wikibase_class_instances([WBClasses.human, WBClasses.organisation]);
    result.techniques = await this.wikibase_class_instances([WBClasses.technique]);
    result.software = await this.wikibase_class_instances([WBClasses.software]);
    result.roles = await this.wikibase_class_instances([WBClasses.role]);
    result.bibliographic_refs = await this.wikibase_class_instances([WBClasses.bibliographicRef]);

    // // TODO this needs to be rethought as there will be "physical objects" which are not buildings.
    // // building ensemble will always be subclass of human-made object, although a room is not a "subclass of" a building!
    // // we could test a recursive "subclass of" or "has part" (tibt:P5*/tibt:P2*) and see how that performs

    // let building_class_ids = await this.wikibase_read('select ?parts where {tib:Q58 tibt:P5* ?parts}')
    // building_class_ids = building_class_ids.map(d => d['parts'])
    // result.physical_objs = await this.wikibase_class_instances(building_class_ids);

    // updated to pull all instances of humanMadeObject directly.

    result.physical_objs = await this.wikibase_class_instances([WBClasses.humanMadeObject]);

    return result as IMetadataChoices;
  }

  public async fetchAnnotationLinkChoices(): Promise<IAnnotationLinkChoices | undefined> {
    if (!isWikibaseConfiguration(WikibaseConfiguration)) {
      return undefined;
    }

    let result: any = {};
    result.relatedAgents = await this.wikibase_class_instances([WBClasses.human]);
    result.relatedMedia = await this.wikibase_class_instances([WBClasses.media]);
    result.relatedConcepts = await this.wikibase_class_instances([WBClasses.iconographicConcept]);
    result.licenses = await this.wikibase_class_instances([WBClasses.license]);
    log(
      `Fetched ${result.relatedAgents.length} related agents, ${result.relatedMedia.length} related media, ${result.relatedConcepts.length} related concepts, and ${result.licenses.length} licenses from Wikibase`,
    );
    //log(result);
    return result as IAnnotationLinkChoices;
  }

  public async removeWikibaseItem(id: string) {
    this.wbEdit.entity.delete({ id: id });
  }

  private async wikibase_read(spark: string) {
    console.log(spark);
    const prefixedSpark = ['PREFIX tibt: <https://wikibase.semantic-kompakkt.de/prop/direct/>', 'PREFIX tib: <https://wikibase.semantic-kompakkt.de/entity/>', spark].join('\n');
    const query = this.wbSDK.sparqlQuery(prefixedSpark);

    const result = await get(query, {}).catch(error => {
      console.log('wikibase_read', error.message, error.config?.url);
      return undefined;
    });
    console.log(result);

    if (!result) return undefined;
    //const result = await this.wbConnect.requestSDKquery(query);
    const simple = this.wbSDK.simplify.sparqlResults(result.data);
    return simple;
  }

  private async wikibase_class_instances(class_array: string[]) {
    const class_string: string = 'tib:' + class_array.join(' tib:');

    const spark = `select DISTINCT ?id ?label_en ?description ?media where { 
        values ?class {${class_string}} 
        ?id tibt:${WBPredicates.instance_of} ?class. 
        ?id rdfs:label ?label_en filter (lang(?label_en) = "en"). 
        optional { ?id schema:description ?description filter (lang(?description) = "en")}.
        optional { ?id tibt:${WBPredicates.image} ?media. }
      }`;

    const class_items = await this.wikibase_read(spark);
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
    const class_string: string = 'tib:' + class_array.join(' tib:');
    const class_items = await this.wikibase_read(
      `select ?id ?label_en ?desc ?media where { 
      values ?class {${class_string}} 
      {
        ?id tibt:${WBPredicates.instance_of} ?class.
      }
      UNION
      {
        ?subclass tibt:${WBPredicates.subclass_of} ?class.
        ?id tibt:${WBPredicates.instance_of} ?subclass.
      }
      ?id rdfs:label ?label_en filter (lang(?label_en) = "en"). 
      optional { ?id schema:description ?desc filter (lang(?desc) = "en")}.
      optional { ?media tibt:${WBPredicates.image} ?media. }
    }`,
    );

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

  public async fetchAnnotation(wikibase_id: string): Promise<WikibaseAnnotation | undefined> {
    console.log('fetching annotation', wikibase_id);
    const annotation = await this.wikibase_read(
      `SELECT
      ?label ?desc ?dateCreated ?dateModified ?val ?rank ?motiv ?camType
      ?cx ?cy ?cz
      ?ctx ?cty ?ctz
      ?sx ?sy ?sz
      ?snx ?sny ?snz
      ?target
      ?concept ?conceptLabel
      ?media ?mediaLabel
      ?mediaURL ?relMediaThumb ?fileView
      ?descAgent ?descAgentLabel
      ?descLicense ?descLicenseLabel
      WHERE {
        SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
        tib:${wikibase_id} schema:description ?desc .
        tib:${wikibase_id} tibt:${WBPredicates.annotationVerified} ?val .
        tib:${wikibase_id} tibt:${WBPredicates.annotationRanking} ?rank .
        tib:${wikibase_id} tibt:${WBPredicates.annotationMotivation} ?motiv .
        tib:${wikibase_id} tibt:${WBPredicates.cameraType} ?camType .
        tib:${wikibase_id} tibt:${WBPredicates.perspectivePositionX} ?cx .
        tib:${wikibase_id} tibt:${WBPredicates.perspectivePositionY} ?cy .
        tib:${wikibase_id} tibt:${WBPredicates.perspectivePositionZ} ?cz .
        tib:${wikibase_id} tibt:${WBPredicates.perspectiveTargetX} ?ctx .
        tib:${wikibase_id} tibt:${WBPredicates.perspectiveTargetY} ?cty .
        tib:${wikibase_id} tibt:${WBPredicates.perspectiveTargetZ} ?ctz .
        tib:${wikibase_id} tibt:${WBPredicates.targetEntity} ?target .
        OPTIONAL { 
          tib:${wikibase_id} tibt:${WBPredicates.selectorNormalX} ?sx . 
          tib:${wikibase_id} tibt:${WBPredicates.selectorNormalY} ?sy . 
          tib:${wikibase_id} tibt:${WBPredicates.selectorNormalZ} ?sz . 
        }
        OPTIONAL {
          tib:${wikibase_id} tibt:${WBPredicates.selectorPositionX} ?snx .
          tib:${wikibase_id} tibt:${WBPredicates.selectorPositionY} ?sny .
          tib:${wikibase_id} tibt:${WBPredicates.selectorPositionZ} ?snz . 
        }
        OPTIONAL {
            tib:${wikibase_id} tibp:${WBPredicates.annotationDescriptionLink} [tibps:${WBPredicates.annotationDescriptionLink} ?descAgentItem; tibpq:${WBPredicates.rightsOwner} ?descAgent] .
        }
        OPTIONAL {
            tib:${wikibase_id} tibp:${WBPredicates.annotationDescriptionLink} [tibps:${WBPredicates.annotationDescriptionLink} ?descLicenseItem; tibpq:${WBPredicates.license} ?descLicense]
        }
        OPTIONAL { tib:${wikibase_id} tibt:${WBPredicates.dateCreated} ?dateCreated .  }
        OPTIONAL { tib:${wikibase_id} tibt:${WBPredicates.annotationRelatedConcepts} ?concept }
        OPTIONAL {
            tib:${wikibase_id} tibt:${WBPredicates.annotationRelatedMedia} ?media .
            ?media tibt:${WBPredicates.entityLink} ?fileView.
            ?media tibt:${WBPredicates.image} ?relMediaThumb.
        }
        OPTIONAL { tib:${wikibase_id} tibt:${WBPredicates.externalLink} ?mediaURL }
        OPTIONAL { tib:${wikibase_id} rdfs:label ?label } 
      }`,
    );

    const processedMetadata = this.processRawMetadata(annotation);
    if (processedMetadata && Object.keys(processedMetadata).length > 0) {
      let annotation = processedMetadata;

      const descriptionAuthors: IWikibaseItem[] = [];
      const descriptionLicenses: IWikibaseItem[] = [];
      const relatedMedia: IWikibaseItem[] = this.processWikibaseItems(processedMetadata, 'media');

      //because SPARQL is weird, we have to concat the media related stuff here (and with the processedMetadata)
      for (let i = 0; i < relatedMedia.length; i++) {
        relatedMedia[i].media = this.getPreviewImage(relatedMedia[i].id);
        relatedMedia[i].internalID =
          /* fist check if processedMetadata.filView is array or just string */ processedMetadata.fileView
            ? processedMetadata.fileView
            : processedMetadata.fileView[i];
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

      const annotationData: WikibaseAnnotation = {
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
        relatedEntities: this.processWikibaseItems(processedMetadata, 'concept'),
        relatedMediaUrls: this.processWikibaseItems(processedMetadata, 'mediaURL'),
      };
      return annotationData;
    }
    return undefined;
  }

  getPreviewImage(id: string): string | undefined {
    //check if valid QNumber
    if (!id.startsWith('Q')) {
      return undefined;
    }
    return `${WikibaseConfiguration?.Domain}/wiki/Special:Filepath/Preview${id}.png`;
  }

  public async fetchWikibaseMetadata(wikibase_id: any): Promise<WikibaseDigitalEntity | undefined> {
    log('Fetching metadata from Wikibase for ' + wikibase_id);

    const sparql = `SELECT 
      ?desc 
      ?label 
      ?licence ?licenceLabel
      ?date 
      ?techniques ?techniquesLabel
      ?software ?softwareLabel
      ?equipment ?equipmentLabel
      ?externalLinks 
      ?bibliographicRefs ?bibliographicRefsLabel
      ?physicalObjs ?physicalObjsLabel
      ?rightsOwner ?rightsOwnerLabel
      ?dataCreator ?dataCreatorLabel
      ?creator ?creatorLabel
      ?editor ?editorLabel
      ?contactperson ?contactpersonLabel
      WHERE {
        tib:${wikibase_id} schema:description ?desc .
        tib:${wikibase_id} tibt:${WBPredicates.license} ?licence .
        OPTIONAL { tib:${wikibase_id} rdfs:label ?label }
        OPTIONAL { tib:${wikibase_id} tibt:${WBPredicates.dateCreated} ?date }
        OPTIONAL { tib:${wikibase_id} tibt:${WBPredicates.technique} ?techniques }
        OPTIONAL { tib:${wikibase_id} tibt:${WBPredicates.software} ?software }
        OPTIONAL { tib:${wikibase_id} tibt:${WBPredicates.equipment} ?equipment }
        OPTIONAL { tib:${wikibase_id} tibt:${WBPredicates.externalLink} ?externalLinks }
        OPTIONAL { tib:${wikibase_id} tibt:${WBPredicates.bibliographicRef} ?bibliographicRefs }
        OPTIONAL { tib:${wikibase_id} tibt:${WBPredicates.objectOfRepresentation} ?physicalObjs }
        OPTIONAL { tib:${wikibase_id} tibt:${WBPredicates.instance_of} ?hierarchies }
        OPTIONAL { tib:${wikibase_id} tibt:${WBPredicates.rightsOwner} ?rightsOwner }
        OPTIONAL { tib:${wikibase_id} tibt:${WBPredicates.contactPerson} ?contactperson }
        OPTIONAL { tib:${wikibase_id} tibp:${WBPredicates.hasEvent} ?statement1.
				            ?statement1 tibps:${WBPredicates.hasEvent} tib:${WBClasses.rawDataCreation} ;
							      tibpq:${WBPredicates.carriedOutBy} ?dataCreator. }
        OPTIONAL { tib:${wikibase_id} tibp:${WBPredicates.hasEvent} ?statement2.
				            ?statement2 tibps:${WBPredicates.hasEvent} tib:${WBClasses.creation} ;
							      tibpq:${WBPredicates.carriedOutBy} ?creator. }
        OPTIONAL { tib:${wikibase_id} tibp:${WBPredicates.hasEvent} ?statement3.
				            ?statement3 tibps:${WBPredicates.hasEvent} tib:${WBClasses.modification} ;
							      tibpq:${WBPredicates.carriedOutBy} ?editor. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
      }`;
    //console.log(sparql)
    const metadata = await this.wikibase_read(sparql);

    const processedMetadata = this.processRawMetadata(metadata);

    if (processedMetadata.length == 0) {
      console.log('no metadata found');
      return undefined;
    }
    const licence = new WikibaseID(
      processedMetadata['licence'] ? processedMetadata['licence']['value'] : '',
    ).numericID;
    const digitalEntity: WikibaseDigitalEntity = {
      id: wikibase_id,
      description: this.processWikibaseItems(processedMetadata, 'desc'),
      label: { en: this.processWikibaseItems(processedMetadata, 'label') },
      licence: licence ?? '',
      creationDate: this.processWikibaseItems(processedMetadata, 'date'),
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
    };

    return digitalEntity;
  }

  private processWikibaseItems(metadata: unknown, key: string) {
    const items: IWikibaseItem[] = [];
    const strings: string[] = [];

    if (metadata?.[key]) {
      if (Array.isArray(metadata[key])) {
        const mappedItems = metadata[key].map((item: any) => ({
          id: item.value,
          label: { en: item.label },
        }));
        items.push(...mappedItems);
      } else if (typeof metadata[key] === 'object') {
        items.push({
          id: metadata[key].value,
          label: { en: metadata[key].label },
        });
      } else if (metadata?.[key] && typeof metadata[key] === 'string') {
        strings.push(metadata[key].toString());
      }
    }

    /* return either an array of items or an array of strings */
    return items.length > 0 ? items : strings;
  }

  private processRawMetadata(rawMetadata: object[]) {
    return rawMetadata.reduce((processedMetadata, row) => {
      (Object.keys(row) as (keyof typeof row)[]).forEach(key => {
        // If the key is not in processedMetadata, initialize it
        if (!processedMetadata[key]) {
          processedMetadata[key] = row[key];
        } else {
          // If the value is an object, not an array or a string, check if the current value is different
          if (
            (!Array.isArray(processedMetadata[key]) &&
              typeof processedMetadata[key] !== 'string' &&
              processedMetadata[key].value !== row[key].value) ||
            (typeof processedMetadata[key] === 'string' && processedMetadata[key] !== row[key])
          ) {
            // If the value is different, convert it into an array and add the new value
            processedMetadata[key] = [processedMetadata[key], row[key]];
          } else if (Array.isArray(processedMetadata[key])) {
            // Check if the value already exists in the array
            const valueExists = processedMetadata[key].some((item: any) =>
              typeof item === 'string' ? item === row[key] : item.value === row[key].value,
            );
            // If the value doesn't exist, add it to the array
            if (!valueExists) {
              processedMetadata[key].push(row[key]);
            }
          }
        }
      });
      return processedMetadata;
    }, {});
  }

  private getAgentsFromMetadata(metadata: any): IMediaAgent[] {
    const agents: IMediaAgent[] = [];

    // Check if metadata is empty
    if (metadata.length === 0) {
      return agents;
    }

    const addAgents = (metadata: any, roleTitle: string, roleKey: string, roleId: number) => {
      if (Array.isArray(metadata?.[roleKey])) {
        const agentsForRole = metadata[roleKey].map((agent: any) => ({
          id: agent.value,
          label: { en: agent.label },
          role: roleId,
          roleTitle,
        }));
        agents.push(...agentsForRole);
      } else if (metadata?.[roleKey]) {
        const agent = metadata[roleKey];
        agents.push({
          id: agent.value,
          label: { en: agent.label },
          role: roleId,
          roleTitle,
        });
      }
    };

    addAgents(metadata, 'Rightsowner', 'rightsOwner', getIDfromWBEntity(WBValues.roleRightsOwner));
    addAgents(metadata, 'Data Creator', 'dataCreator', getIDfromWBEntity(WBValues.roleDataCreator));
    addAgents(metadata, 'Creator', 'creator', getIDfromWBEntity(WBValues.roleCreator));
    addAgents(metadata, 'Editor', 'editor', getIDfromWBEntity(WBValues.roleEditor));
    addAgents(
      metadata,
      'Contact Person',
      'contactperson',
      getIDfromWBEntity(WBValues.roleContactPerson),
    );

    return agents;
  }
}
