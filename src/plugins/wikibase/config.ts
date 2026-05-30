import type { IAnnotation, IDigitalEntity } from '@kompakkt/common';
import { Configuration, type IConfiguration } from 'src/configuration';
import type { IWikibaseAnnotationExtension, IWikibaseDigitalEntityExtension } from './common';
import type { ServerDocument } from 'src/util/document-with-objectid-type';

export type IWikibaseConfiguration = {
  KompakktAddress?: string;
  Public?: string;
  PrefixDomain?: string;
  Domain: string;
  SPARQLEndpoint: string;
  Username: string;
  Password: string;
  AdminUsername: string;
  AdminPassword: string;
  TTLFileURL?: string;
};

export const isWikibaseConfiguration = (obj: unknown): obj is IWikibaseConfiguration => {
  return (
    !!obj &&
    typeof obj === 'object' &&
    'Domain' in obj &&
    'Username' in obj &&
    'Password' in obj &&
    'AdminUsername' in obj &&
    'AdminPassword' in obj &&
    'SPARQLEndpoint' in obj
  );
};

export const WikibaseConfiguration = (
  Configuration as IConfiguration<{ Wikibase: IWikibaseConfiguration }>
).Extensions?.Wikibase;

export type WikibaseDigitalEntity = IDigitalEntity & { extensions: IWikibaseDigitalEntityExtension };

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
