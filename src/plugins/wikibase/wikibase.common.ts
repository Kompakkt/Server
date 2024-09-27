export type IWikibaseItem = {
  id: string;
  internalID?: string;
  label: { [key: string]: string };
  description?: string;
  media?: string;
}

export type IMediaAgent = IWikibaseItem & {
  role: number;
  roleTitle: string | undefined;
}

export type IMetadataChoices = {
  persons: IWikibaseItem[];
  techniques: IWikibaseItem[];
  software: IWikibaseItem[];
  roles: IWikibaseItem[];
  bibliographic_refs: IWikibaseItem[];
  physical_objs: IWikibaseItem[];
}

export type IAnnotationLinkChoices = {
  relatedConcepts: IWikibaseItem[];
  relatedMedia: IWikibaseItem[];
  relatedAgents: IWikibaseItem[];
  licenses: IWikibaseItem[];
}

export type IMediaHierarchy = {
  parents: IWikibaseItem[];
  siblings: IWikibaseItem[];
}

export type IWikibaseDigitalEntityExtension = {
  wikibase?: Partial<{
    label: Record<string, string>;
    id: string;
    address: string;
    agents: IMediaAgent[];
    techniques: IWikibaseItem[];
    software: IWikibaseItem[];
    equipment: string[];
    creationDate: string | undefined;
    externalLinks: string[];
    bibliographicRefs: IWikibaseItem[];
    physicalObjs: IWikibaseItem[];
    licence: number;
    hierarchies: IMediaHierarchy[];
    claims: Record<string, unknown>;
  }>;
}

export type IWikibaseAnnotationExtension = {
  wikibase?: Partial<{
    authors?: IWikibaseItem[];
    licenses?: IWikibaseItem[];
    media?: IWikibaseItem[];
    mediaUrls?: string;
    entities?: IWikibaseItem[];
  }>;
}

export type IWikibaseConfiguration = {
  KompakktAddress? : string;
  Public? : string;
  Domain: string;
  SPARQLEndpoint: string;
  Username: string;
  Password: string;
  AdminUsername: string;
  AdminPassword: string;
}

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

export const properties = {
  instance_of: 'P1',
  relatedAgents: 'P40',
  media: 'P104',
  hasPart: 'P5',
  isPartOf: 'P6',
  internalID: 'P96',
  title: 'P4',
  dateCreated: 'P12',
  dateModified: 'P112',
  license: 'P53',
  technique: 'P65',
  software: 'P66',
  equipment: 'P67',
  cameraType: 'P78',
  role: 'P110',
  objectOfRepresentation: 'P63',
  bibliographicRef: 'P58',
  externalLink: 'P57',
  hasAnnotation: 'P75',
  targetEntity: 'P77',
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
  annotationRanking: 'P79',
  annotationMotivation: 'P80',
  annotationVerified: 'P83',
  annotationDescriptionLink: 'P76',
  annotationRelatedConcepts: 'P81',
  annotationRelatedMedia: 'P82',
  image: 'P61',
  creator: 'P40',
  dataCreator: 'P41',
  editor: 'P42',
  inCustodyOf: 'P43',
  owner: 'P44',
  rightsOwner: 'P45',
  curator: 'P46',
  contactPerson: 'P51',
} as const;

export const classes = {
  organisation: 4,
  buildingEnsemble: 58,
  human: 2,
  bibliographicRef: 20,
  media: 21,
  license: 19,
  technique: 22,
  software: 23,
  role: 196,
  annotation: 25,
} as const

export const values = {
  motivationDescribing: 45,
  true: 30,
  false: 31,
} as const;

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
