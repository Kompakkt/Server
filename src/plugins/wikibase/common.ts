export type IWikibaseItem = {
  id: string;
  internalID?: string;
  label: IWikibaseLabel;
  description?: string;
  media?: string;
};

export type IMediaAgent = IWikibaseItem & {
  roleTitle: 'Rightsowner' | 'Creator' | 'Editor' | 'Data Creator' | 'Contact Person' | undefined;
};

export type IMetadataChoices = {
  persons: IWikibaseItem[];
  techniques: IWikibaseItem[];
  software: IWikibaseItem[];
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
  licence: string;
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
  mediaUrls: string[];
  entities: IWikibaseItem[];
}>;

export const getPQNumberFromID = (id: string) => {
  const match = id.match(/[PQ](\d+)/i)?.at(1);
  return match ? Number.parseInt(match) : undefined;
};
