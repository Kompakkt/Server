import type { IAnnotation, IDigitalEntity } from '@kompakkt/common';
import { Configuration, type IConfiguration } from 'src/configuration';
import type { IWikibaseAnnotationExtension, IWikibaseDigitalEntityExtension } from './common';

export type IWikibaseConfiguration = {
  Public?: string;
  PrefixDomain?: string;
  Domain: string;
  SPARQLEndpoint: string;
  RestAPIURL: string;
  OauthToken: string;
  TTLFileURL?: string;
};

export const isWikibaseConfiguration = (obj: unknown): obj is IWikibaseConfiguration => {
  return (
    !!obj &&
    typeof obj === 'object' &&
    'Domain' in obj &&
    'SPARQLEndpoint' in obj &&
    'RestAPIURL' in obj &&
    'OauthToken' in obj
  );
};

export const WikibaseConfiguration = (
  Configuration as IConfiguration<{ Wikibase: IWikibaseConfiguration }>
).Extensions?.Wikibase;

export type WikibaseDigitalEntity = IDigitalEntity & {
  extensions: IWikibaseDigitalEntityExtension;
};

export const isWikibaseDigitalEntity = (
  digitalEntity: unknown,
): digitalEntity is WikibaseDigitalEntity => {
  return (
    !!digitalEntity &&
    typeof digitalEntity === 'object' &&
    'extensions' in digitalEntity &&
    typeof digitalEntity.extensions === 'object' &&
    digitalEntity.extensions !== null &&
    'wikibase' in digitalEntity.extensions &&
    typeof digitalEntity.extensions.wikibase === 'object' &&
    digitalEntity.extensions.wikibase !== null &&
    'id' in digitalEntity.extensions.wikibase &&
    typeof digitalEntity.extensions.wikibase.id === 'string' &&
    digitalEntity.extensions.wikibase.id.trim().length > 0
  );
};

export type WikibaseAnnotation = IAnnotation & { extensions: IWikibaseAnnotationExtension };
