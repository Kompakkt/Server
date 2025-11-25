import type { Filter } from 'mongodb';
import objectHash from 'object-hash';
import {
  Collection,
  type ICompilation,
  type IEntity,
  type IInstitution,
  type IUserData,
} from 'src/common';
import { warn } from 'src/logger';
import { compilationCollection, entityCollection } from 'src/mongo';
import { searchCache } from 'src/redis';
import { searchService } from 'src/sonic';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import {
  AnnotationFilter,
  filterByCollection,
  MiscFilter,
  SortOrder,
  type ExploreRequest,
} from './types';

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

type ExploreDocument = IEntity | ICompilation | IInstitution;

export const exploreHandler = async (
  options: ExploreRequest,
  userdata: ServerDocument<IUserData> | undefined = undefined,
): Promise<{
  results: ServerDocument<ExploreDocument>[];
  suggestions: string[];
  requestTime: number;
  count: number;
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
  console.log(hasSearchText, trimmedSearchText, foundIds);
  // TODO: Figure out caching with new filtering system, since userdata can affect results

  const hash = objectHash(options);
  console.time(`explore::${collection}::${hash}`);
  const [documents, count] = await (async () => {
    const sortOptions = getSortObject({ order: options.sortBy, reversed: options.reversed });

    const baseFilter: Filter<ServerDocument<IEntity> | ServerDocument<ICompilation>> = {};
    if (hasSearchText) {
      baseFilter._id = { $in: foundIds };
    }

    // TODO: Figure out access, once its available in compilations
    // Right now access data is only available in entities
    if (collection === Collection.entity && options.access.length > 0) {
      if (!userdata) return [[], 0];
      baseFilter[`access.${userdata._id.toString()}.role`] = { $in: options.access };
    }

    // Note: We went from exclusive options to inclusive options, so we need to adjust the logic here
    // Reference: https://github.com/Kompakkt/Repo/issues/146
    const availableAnnotationOptions = Object.keys(AnnotationFilter).length;
    if (
      options.annotations.length !== 0 &&
      options.annotations.length !== availableAnnotationOptions
    ) {
      if (options.annotations.includes(AnnotationFilter.withAnnotations)) {
        baseFilter.__annotationCount = { $gt: 0 };
      } else if (options.annotations.includes(AnnotationFilter.withoutAnnotations)) {
        baseFilter.__annotationCount = { $eq: 0 };
      }
    }

    if (options.mediaTypes.length > 0) {
      baseFilter.__mediaTypes = { $in: options.mediaTypes };
    }

    if (options.licences.length > 0) {
      baseFilter.__licenses = { $in: options.licences };
    }

    if (options.misc.length > 0) {
      if (options.misc.includes(MiscFilter.downloadable)) {
        baseFilter.__downloadable = true;
      }
    }

    switch (collection) {
      case Collection.entity: {
        const filter: Filter<ServerDocument<IEntity>> = {
          ...baseFilter,
          finished: true,
          online: true,
        };

        return await Promise.all([
          entityCollection
            .find(filter, { sort: sortOptions })
            .skip(options.offset)
            .limit(options.limit)
            .toArray(),
          entityCollection.countDocuments(filter),
        ]);
      }
      case Collection.compilation: {
        const filter: Filter<ServerDocument<ICompilation>> = {
          ...baseFilter,
          password: { $eq: '' },
        };

        return await Promise.all([
          compilationCollection
            .find(filter, { sort: sortOptions })
            .skip(options.offset)
            .limit(options.limit)
            .toArray(),
          compilationCollection.countDocuments(filter),
        ]);
      }
      default: {
        return [[], 0];
      }
    }
  })();
  console.timeEnd(`explore::${collection}::${hash}`);
  return { results: documents, suggestions, requestTime, count };
};
