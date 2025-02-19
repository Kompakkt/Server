import type { IAnnotation, IDigitalEntity } from 'src/common';
import { Configuration, type IConfiguration } from 'src/configuration';
import type {
  IWikibaseAnnotationExtension,
  IWikibaseConfiguration,
  IWikibaseDigitalEntityExtension,
} from './common';

export const WikibaseConfiguration = (
  Configuration as IConfiguration<{ Wikibase: IWikibaseConfiguration }>
).Extensions?.Wikibase;

export type WikibaseDigitalEntity = IDigitalEntity<IWikibaseDigitalEntityExtension>;
export type WikibaseAnnotation = IAnnotation<IWikibaseAnnotationExtension>;
