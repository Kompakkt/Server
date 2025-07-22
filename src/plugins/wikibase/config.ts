import type { IAnnotation, IDigitalEntity } from 'src/common';
import { Configuration, type IConfiguration } from 'src/configuration';
import type { IWikibaseAnnotationExtension, IWikibaseDigitalEntityExtension } from './common';

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

export type WikibaseDigitalEntity = IDigitalEntity<IWikibaseDigitalEntityExtension>;
export type WikibaseAnnotation = IAnnotation<IWikibaseAnnotationExtension>;
