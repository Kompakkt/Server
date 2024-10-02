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

export type IWikibaseLabel = Record<string, string | string[]>;

export type IWikibaseDigitalEntityExtension = {
  wikibase?: Partial<{
    label: IWikibaseLabel;
    description: string | Array<string | IWikibaseItem>;
    id: string;
    address: string;
    agents: IMediaAgent[];
    techniques: IWikibaseItem[];
    software: IWikibaseItem[];
    equipment: Array<string | IWikibaseItem>;
    creationDate: string | Array<string> | undefined;
    externalLinks: Array<string | IWikibaseItem>; // Is this supposed to happen?
    bibliographicRefs: IWikibaseItem[];
    physicalObjs: IWikibaseItem[];
    licence: number;
    hierarchies: IMediaHierarchy[];
    claims: Record<string, unknown>;
  }>;
};

export type IWikibaseAnnotationExtension = {
  wikibase?: Partial<{
    label: IWikibaseLabel;
    description: string | Array<string | IWikibaseItem>;
    authors: IWikibaseItem[];
    licenses: IWikibaseItem[];
    media: IWikibaseItem[];
    mediaUrls: string;
    entities: IWikibaseItem[];
  }>;
};

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
  return parseInt(qnumber.slice(1));
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
    this.numericID = parseInt(this.itemID.slice(1));
  }
}
