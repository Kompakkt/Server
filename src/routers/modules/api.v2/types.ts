import { t, type Static } from 'elysia';
import { Collection, EntityAccessRole } from 'src/common';

export enum FilterByOptions {
  objects = 'objects',
  collections = 'collections',
  institutions = 'institutions',
}
export const filterByCollection = {
  objects: Collection.entity,
  collections: Collection.compilation,
  institutions: Collection.institution,
} as const;

export enum SortOrder {
  name = 'name',
  popularity = 'popularity',
  usage = 'usage',
  annotations = 'annotations',
  newest = 'newest',
}

export enum AnnotationFilter {
  all = 'all',
  withAnnotations = 'with-annotations',
  withoutAnnotations = 'without-annotations',
}

export enum MiscFilter {
  downloadable = 'downloadable',
  animated = 'animated',
}

export const ExploreRequest = t.Object({
  searchText: t.String(),
  filterBy: t.Enum(FilterByOptions),
  mediaTypes: t.Array(t.String()),
  annotations: t.Enum(AnnotationFilter),
  access: t.Array(t.Enum(EntityAccessRole)),
  licences: t.Array(t.String()),
  misc: t.Array(t.Enum(MiscFilter)),
  offset: t.Number(),
  limit: t.Number(),
  reversed: t.Boolean(),
  sortBy: t.Enum(SortOrder),
});

export type ExploreRequest = Static<typeof ExploreRequest>;
