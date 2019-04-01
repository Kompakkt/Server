export interface IModel {
  _id?: string;
  annotationList: string[];
  name: string;
  files: string[];
  finished: boolean;
  ranking?: number;
  relatedDigitalObject?: any;
  online: boolean;
  isExternal?: boolean;
  externalService?: string;
  mediaType: string;
  dataSource: {
    isExternal: boolean;
    service?: string;
  };
  settings?: {
    preview?: string;
    cameraPositionInitial?: any;
    background?: any;
    lights?: any;
    rotation?: any;
    scale?: any;
  };
  processed?: {
    time?: {
      start: string;
      end: string;
      total: string;
    };
    low?: string;
    medium?: string;
    high?: string;
    raw?: string;
  };
}
