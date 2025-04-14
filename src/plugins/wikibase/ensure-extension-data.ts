import type { IAnnotation, IDigitalEntity } from 'src/common';
import type { IWikibaseAnnotationExtension, IWikibaseDigitalEntityExtension } from './common';
import type { WikibaseAnnotation, WikibaseDigitalEntity } from './config';
import type { ServerDocument } from 'src/util/document-with-objectid-type';

export const ensureDigitalEntityExtensionData = (
  digitalEntity: ServerDocument<IDigitalEntity<Partial<IWikibaseDigitalEntityExtension>>>,
): ServerDocument<WikibaseDigitalEntity> => {
  digitalEntity.extensions ??= {};
  digitalEntity.extensions.wikibase ??= {};
  digitalEntity.extensions.wikibase.label ??= {};
  digitalEntity.extensions.wikibase.description ??= {};

  digitalEntity.extensions.wikibase.label.en ??= digitalEntity.title;
  digitalEntity.extensions.wikibase.description.en ??= digitalEntity.description;
  return digitalEntity;
};

export const ensureAnnotationExtensionData = (
  annotation: ServerDocument<IAnnotation<Partial<IWikibaseAnnotationExtension>>>,
): ServerDocument<WikibaseAnnotation> => {
  annotation.extensions ??= {};
  annotation.extensions.wikibase ??= {};
  annotation.extensions.wikibase.label ??= {};
  annotation.extensions.wikibase.description ??= {};

  annotation.extensions.wikibase.label.en ??= annotation.body.content.title;
  annotation.extensions.wikibase.description.en ??= annotation.body.content.description;
  return annotation;
};
