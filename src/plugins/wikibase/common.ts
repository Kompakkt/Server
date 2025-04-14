import { err } from 'src/logger';

export type IWikibaseItem = {
  id: string;
  internalID?: string;
  label: IWikibaseLabel;
  description?: string;
  media?: string;
};

export type IMediaAgent = IWikibaseItem & {
  role: number;
  roleTitle: string | undefined;
};

export type IMetadataChoices = {
  persons: IWikibaseItem[];
  techniques: IWikibaseItem[];
  software: IWikibaseItem[];
  roles: IWikibaseItem[];
  bibliographic_refs: IWikibaseItem[];
  physical_objs: IWikibaseItem[];
};

export type IAnnotationLinkChoices = {
  relatedConcepts: IWikibaseItem[];
  relatedMedia: IWikibaseItem[];
  relatedAgents: IWikibaseItem[];
  licenses: IWikibaseItem[];
};

export type IMediaHierarchy = {
  parents: IWikibaseItem[];
  siblings: IWikibaseItem[];
};

export type IWikibaseLabel = Record<string, string>;

export type IWikibaseDigitalEntityExtension = {
  wikibase?: IWikibaseDigitalEntityExtensionData;
};

export type IWikibaseDigitalEntityExtensionData = Partial<{
  label: IWikibaseLabel;
  description: IWikibaseLabel;
  id: string;
  address: string;
  agents: IMediaAgent[];
  techniques: Array<string | IWikibaseItem>;
  software: Array<string | IWikibaseItem>;
  equipment: Array<string | IWikibaseItem>;
  creationDate: string | IWikibaseItem | undefined;
  externalLinks: Array<string | IWikibaseItem>; // Is this supposed to happen?
  bibliographicRefs: Array<string | IWikibaseItem>;
  physicalObjs: Array<string | IWikibaseItem>;
  licence: number;
  hierarchies: IMediaHierarchy[];
  claims: Record<string, unknown>;
}>;

export type IWikibaseAnnotationExtension = {
  wikibase?: IWikibaseAnnotationExtensionData;
};

export type IWikibaseAnnotationExtensionData = Partial<{
  id: string;
  address: string;
  label: IWikibaseLabel;
  description: IWikibaseLabel;
  authors: IWikibaseItem[];
  licenses: IWikibaseItem[];
  media: IWikibaseItem[];
  mediaUrls: string;
  entities: IWikibaseItem[];
}>;

export type IWikibaseConfiguration = {
  KompakktAddress?: string;
  Public?: string;
  Domain: string;
  SPARQLEndpoint: string;
  Username: string;
  Password: string;
  AdminUsername: string;
  AdminPassword: string;
};

export const isWikibaseConfiguration = (obj: any): obj is IWikibaseConfiguration => {
  return (
    !!obj &&
    obj?.Domain !== undefined &&
    obj?.Username !== undefined &&
    obj?.Password !== undefined &&
    obj?.AdminUsername !== undefined &&
    obj?.AdminPassword !== undefined
  );
};

export const WBPredicates = {
  instance_of: 'P1',
  subclass_of: 'P2',
  title: 'P4', // this is not relevant to Kompakkt
  hasPart: 'P5',
  isPartOf: 'P6',
  hasEvent: 'P8',
  dateCreated: 'P12',
  carriedOutBy: 'P14',
  creator: 'P40', // this is not relevant to Kompakkt
  dataCreator: 'P41',
  editor: 'P42', // this is not relevant to Kompakkt
  inCustodyOf: 'P43', // this is not relevant to Kompakkt
  owner: 'P44', // this is not relevant to Kompakkt
  rightsOwner: 'P45',
  curator: 'P46', // this is not relevant to Kompakkt
  contactPerson: 'P51',
  externalLink: 'P57',
  bibliographicRef: 'P58',
  license: 'P53',
  image: 'P61',
  objectOfRepresentation: 'P63',
  technique: 'P65',
  software: 'P66',
  equipment: 'P67',
  entityLink: 'P74',
  hasAnnotation: 'P75',
  annotationDescriptionLink: 'P76',
  targetEntity: 'P77',
  cameraType: 'P78',
  annotationRanking: 'P79',
  annotationMotivation: 'P80',
  annotationRelatedConcepts: 'P81',
  annotationRelatedMedia: 'P82',
  annotationVerified: 'P83',
  perspectivePositionX: 'P84',
  perspectivePositionY: 'P85',
  perspectivePositionZ: 'P86',
  perspectiveTargetX: 'P87',
  perspectiveTargetY: 'P88',
  perspectiveTargetZ: 'P89',
  selectorPositionX: 'P90',
  selectorPositionY: 'P91',
  selectorPositionZ: 'P92',
  selectorNormalX: 'P93',
  selectorNormalY: 'P94',
  selectorNormalZ: 'P95',
} as const;

export const WBClasses = {
  group: 'Q2',
  human: 'Q5',
  humanMadeObject: 'Q6',
  concept: 'Q8',
  media: 'Q12',
  software: 'Q13',
  bibliographicRef: 'Q14',
  annotation: 'Q15',
  event: 'Q22',
  creation: 'Q25',
  modification: 'Q28',
  rawDataCreation: 'Q32',
  organisation: 'Q35',
  license: 'Q37',
  technique: 'Q38',
  iconographicConcept: 'Q43',
  role: 'Q999', // does not exist in new model
} as const;

export const WBValues = {
  true: 'Q44',
  false: 'Q45',
  motivationDescribing: 'Q62',

  // Licenses

  // note that these commons do not seem to be making it into kompakkt
  // instead definitions are currently hardcoded at
  // src/app/components/entity-detail/detail-entity/detail-entity.component.ts

  // actually those don't do anything either, current qids are hardcoded here
  // kompakkt-repo: src/app/components/metadata/entity/entity.component.ts

  licenceCC0: 'Q46',
  licenceBY: 'Q47',
  licenceBYSA: 'Q48',
  licenceBYNC: 'Q49',
  licenceBYNCND: 'Q50',
  licenceBYND: 'Q51',
  licenceBYNCSA: 'Q52',
  // where is license for Q53? - we can ignore this, it was something we created for data in WB, not needed for Kompakkt
  licenceAR: 'Q54',

  // Roles
  roleRightsOwner: 'Q328', // does not exist in new model
  roleCreator: 'Q340', // does not exist in new model
  roleEditor: 'Q329', // does not exist in new model
  roleDataCreator: 'Q341', // does not exist in new model
  roleContactPerson: 'Q342', // does not exist in new model
} as const;

export const getIDfromWBEntity = (qnumber: string): number => {
  return Number.parseInt(qnumber.slice(1));
};

export const getQNumberFromURL = (url: string): string => {
  //check if url really is string
  if (typeof url !== 'string') {
    err('getQNumberFromURL: url is not a string', typeof url);
    return '';
  }
  const url_tokens = url.split(/\//);
  return url_tokens[url_tokens.length - 1];
};

export class WikibaseID {
  public url?: URL;
  public itemID: string;
  public numericID: number;
  public namespace?: string;

  constructor(public id: string) {
    // we might get a non-URL as an id
    // in this case consider id to be the Q-number
    try {
      this.url = new URL(id);
      const url_tokens = this.url.pathname.split(/\//);
      this.itemID = url_tokens[url_tokens.length - 1];
    } catch (err) {
      this.url = undefined;
      this.itemID = id;
    }
    const nsSplit = this.itemID.split(/[:]/);
    if (nsSplit.length > 1) {
      this.namespace = nsSplit[0];
      this.itemID = nsSplit[1];
    }
    this.numericID = Number.parseInt(this.itemID.slice(1));
  }
}

export const getDigitalEntityMetadataSpark = (wikibaseId: string) => {
  const spark = `SELECT
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
      tib:${wikibaseId} schema:description ?desc .
      tib:${wikibaseId} tibt:${WBPredicates.license} ?licence .
      OPTIONAL { tib:${wikibaseId} rdfs:label ?label }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.dateCreated} ?date }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.technique} ?techniques }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.software} ?software }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.equipment} ?equipment }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.externalLink} ?externalLinks }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.bibliographicRef} ?bibliographicRefs }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.objectOfRepresentation} ?physicalObjs }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.instance_of} ?hierarchies }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.rightsOwner} ?rightsOwner }
      OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.contactPerson} ?contactperson }
      OPTIONAL { tib:${wikibaseId} tibp:${WBPredicates.hasEvent} ?statement1.
				            ?statement1 tibps:${WBPredicates.hasEvent} tib:${WBClasses.rawDataCreation} ;
							      tibpq:${WBPredicates.carriedOutBy} ?dataCreator. }
      OPTIONAL { tib:${wikibaseId} tibp:${WBPredicates.hasEvent} ?statement2.
				            ?statement2 tibps:${WBPredicates.hasEvent} tib:${WBClasses.creation} ;
							      tibpq:${WBPredicates.carriedOutBy} ?creator. }
      OPTIONAL { tib:${wikibaseId} tibp:${WBPredicates.hasEvent} ?statement3.
				            ?statement3 tibps:${WBPredicates.hasEvent} tib:${WBClasses.modification} ;
							      tibpq:${WBPredicates.carriedOutBy} ?editor. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    }`;
  return spark;
};

export const getAnnotationMetadataSpark = (wikibaseId: string) => {
  const spark = `SELECT
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
        tib:${wikibaseId} schema:description ?desc .
        tib:${wikibaseId} tibt:${WBPredicates.annotationVerified} ?val .
        tib:${wikibaseId} tibt:${WBPredicates.annotationRanking} ?rank .
        tib:${wikibaseId} tibt:${WBPredicates.annotationMotivation} ?motiv .
        tib:${wikibaseId} tibt:${WBPredicates.cameraType} ?camType .
        tib:${wikibaseId} tibt:${WBPredicates.perspectivePositionX} ?cx .
        tib:${wikibaseId} tibt:${WBPredicates.perspectivePositionY} ?cy .
        tib:${wikibaseId} tibt:${WBPredicates.perspectivePositionZ} ?cz .
        tib:${wikibaseId} tibt:${WBPredicates.perspectiveTargetX} ?ctx .
        tib:${wikibaseId} tibt:${WBPredicates.perspectiveTargetY} ?cty .
        tib:${wikibaseId} tibt:${WBPredicates.perspectiveTargetZ} ?ctz .
        tib:${wikibaseId} tibt:${WBPredicates.targetEntity} ?target .
        OPTIONAL {
          tib:${wikibaseId} tibt:${WBPredicates.selectorNormalX} ?sx .
          tib:${wikibaseId} tibt:${WBPredicates.selectorNormalY} ?sy .
          tib:${wikibaseId} tibt:${WBPredicates.selectorNormalZ} ?sz .
        }
        OPTIONAL {
          tib:${wikibaseId} tibt:${WBPredicates.selectorPositionX} ?snx .
          tib:${wikibaseId} tibt:${WBPredicates.selectorPositionY} ?sny .
          tib:${wikibaseId} tibt:${WBPredicates.selectorPositionZ} ?snz .
        }
        OPTIONAL {
            tib:${wikibaseId} tibp:${WBPredicates.annotationDescriptionLink} [tibps:${WBPredicates.annotationDescriptionLink} ?descAgentItem; tibpq:${WBPredicates.rightsOwner} ?descAgent] .
        }
        OPTIONAL {
            tib:${wikibaseId} tibp:${WBPredicates.annotationDescriptionLink} [tibps:${WBPredicates.annotationDescriptionLink} ?descLicenseItem; tibpq:${WBPredicates.license} ?descLicense]
        }
        OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.dateCreated} ?dateCreated .  }
        OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.annotationRelatedConcepts} ?concept }
        OPTIONAL {
            tib:${wikibaseId} tibt:${WBPredicates.annotationRelatedMedia} ?media .
            ?media tibt:${WBPredicates.entityLink} ?fileView.
            ?media tibt:${WBPredicates.image} ?relMediaThumb.
        }
        OPTIONAL { tib:${wikibaseId} tibt:${WBPredicates.externalLink} ?mediaURL }
        OPTIONAL { tib:${wikibaseId} rdfs:label ?label }
      }`;
  return spark;
};

export const getWikibaseClassAndSubclassSpark = (classes: string[]) => {
  const class_string = `tib:${classes.join(' tib:')}`;
  const spark = `SELECT ?id ?label_en ?desc ?media WHERE {
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
    OPTIONAL { ?id schema:description ?desc filter (lang(?desc) = "en")}.
    OPTIONAL { ?media tibt:${WBPredicates.image} ?media. }
  }`;
  return spark;
};

export const getWikibaseClassInstancesSpark = (classes: string[]) => {
  const class_string = `tib:${classes.join(' tib:')}`;

  const spark = `select DISTINCT ?id ?label_en ?description ?media where {
      values ?class {${class_string}}
      ?id tibt:${WBPredicates.instance_of} ?class.
      ?id rdfs:label ?label_en filter (lang(?label_en) = "en").
      optional { ?id schema:description ?description filter (lang(?description) = "en")}.
      optional { ?id tibt:${WBPredicates.image} ?media. }
    }`;

  return spark;
};

export const getHierarchySpark = (wikibaseId: string) => {
  const spark = `
  SELECT ?type ?item ?itemLabel WHERE {
    {
      tib:${wikibaseId} tibt:${WBPredicates.isPartOf}* ?item.
      BIND("parent" AS ?type)
    } UNION {
      tib:${wikibaseId} tibt:${WBPredicates.isPartOf} ?parent.
      ?item tibt:${WBPredicates.isPartOf} ?parent.
      BIND("sibling" AS ?type)
    }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
  }
  `;

  return spark;
};
