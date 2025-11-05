import { t, type Static } from 'elysia';
import type { FindOptions, ObjectId } from 'mongodb';
import {
  Collection,
  ProfileType,
  type ICompilation,
  type IEntity,
  type IInstitution,
  type IUserData,
} from 'src/common';
import { compilationCollection, entityCollection, profileCollection } from 'src/mongo';
import { searchService } from 'src/sonic';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { filterEntities } from './explore-filters/filter-entities';
import { filterByCollection, SortOrder, type ExploreRequest } from './types';
import { filterCompilations } from './explore-filters/filter-compilations';
import objectHash from 'object-hash';
import { exploreCache, searchCache } from 'src/redis';
import { warn } from 'src/logger';

type SortOptions = {
  order: SortOrder;
  reversed: boolean;
};

const getSortObject = (sortOptions: SortOptions) => {
  const sort: Record<string, 1 | -1> = {};
  if (sortOptions.order === SortOrder.popularity) {
    sort.__hits = sortOptions.reversed ? 1 : -1;
    sort.__createdAt = -1;
  } else if (sortOptions.order === SortOrder.newest) {
    sort.__createdAt = sortOptions.reversed ? 1 : -1;
  } else if (sortOptions.order === SortOrder.name) {
    sort.__normalizedName = sortOptions.reversed ? -1 : 1;
    sort.__createdAt = -1;
  } else if (sortOptions.order === SortOrder.annotations) {
    sort.__annotationCount = sortOptions.reversed ? 1 : -1;
    sort.__createdAt = -1;
  }
  return sort;
};

const getDocuments = async <
  C extends Collection.entity | Collection.compilation | Collection.institution,
>(
  collection: C,
  hasSearchText: boolean,
  foundIds: ObjectId[],
  sortOptions: SortOptions,
) => {
  if (collection === Collection.entity) {
    return entityCollection
      .find(
        hasSearchText
          ? { _id: { $in: foundIds }, finished: true, online: true }
          : { finished: true, online: true },
        { sort: getSortObject(sortOptions) },
      )
      .toArray();
  } else if (collection === Collection.compilation) {
    return compilationCollection
      .find(
        hasSearchText
          ? { _id: { $in: foundIds }, password: { $eq: '' } }
          : { password: { $eq: '' } },
        { sort: getSortObject(sortOptions) },
      )
      .toArray();
  } else if (collection === Collection.institution) {
    return profileCollection
      .find(
        hasSearchText
          ? { _id: { $in: foundIds }, type: ProfileType.institution }
          : { type: ProfileType.institution },
        { sort: getSortObject(sortOptions) },
      )
      .toArray();
  } else {
    return [];
  }
};

type ExploreDocument = IEntity | ICompilation | IInstitution;

const filterDocuments = (collection: Collection) => {
  switch (collection) {
    case Collection.entity:
      return filterEntities;
    case Collection.compilation:
      return filterCompilations;
    default:
      return async (
        documents: ServerDocument<ExploreDocument>[],
        options: ExploreRequest,
      ): Promise<ServerDocument<ExploreDocument>[]> => documents;
  }
};

export const exploreHandler = async (
  options: ExploreRequest,
  userdata: ServerDocument<IUserData> | undefined = undefined,
): Promise<{
  results: ServerDocument<ExploreDocument>[];
  suggestions: string[];
  requestTime: number;
}> => {
  const requestTime = Date.now();

  const trimmedSearchText = options.searchText.trim();
  const hasSearchText = trimmedSearchText.length > 0;
  const collection = filterByCollection[options.filterBy];

  const suggestions = hasSearchText
    ? await searchService.suggest(collection, trimmedSearchText).catch(() => [])
    : [];

  queueMicrotask(() => {
    // Increment search term count for exact matches to suggest popular searches
    const exactSuggestionMatch = suggestions.find(
      s => s.toLowerCase() === trimmedSearchText.toLowerCase(),
    );
    if (!exactSuggestionMatch) return;
    const key = `search-terms::${collection}`;
    searchCache.redis.send('ZINCRBY', [key, '1', exactSuggestionMatch]).catch(err => {
      warn(`Failed to increment search term count for explore suggestions`, err);
    });
  });

  const foundIds = hasSearchText ? await searchService.search(collection, trimmedSearchText) : [];

  const hash = objectHash(options);

  console.time(`explore::${collection}::${hash}`);
  const documents = await (async () => {
    const cached = await exploreCache.get<ServerDocument<ExploreDocument>[]>(
      `explore::${collection}::${hash}`,
    );
    if (cached) return cached;
    const fresh = await getDocuments(collection, hasSearchText, foundIds, {
      order: options.sortBy,
      reversed: options.reversed,
    });
    exploreCache.set(`explore::${collection}::${hash}`, fresh);
    return fresh;
  })();
  console.timeEnd(`explore::${collection}::${hash}`);

  // @ts-expect-error Unsure of correct typing, but it works
  const filteredDocuments = await filterDocuments(collection)(documents, options, userdata);

  // TODO: Sort options, pagination, and reversed order

  return Promise.resolve({ suggestions, requestTime, results: filteredDocuments });
};
