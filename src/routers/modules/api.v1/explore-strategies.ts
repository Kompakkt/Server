import { t, type Static } from 'elysia';
import type { Filter } from 'mongodb';
import type { IEntity, ICompilation, IDigitalEntity, IUserData } from 'src/common';
import { isAnnotation, isEntity } from 'src/common';
import { compilationCollection, entityCollection } from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { resolveCompilation, resolveEntity } from './resolving-strategies';
import { exploreCache } from 'src/redis';
import { err } from 'src/logger';

enum SortOrder {
  name = 'name',
  popularity = 'popularity',
  usage = 'usage',
  annotations = 'annotations',
  newest = 'newest',
}

export const ExploreRequest = t.Object({
  searchEntity: t.Boolean(),
  types: t.Array(t.String()),
  filters: t.Object({
    annotatable: t.Boolean(),
    annotated: t.Boolean(),
    restricted: t.Boolean(),
    associated: t.Boolean(),
  }),
  searchText: t.String(),
  offset: t.Number(),
  sortBy: t.Optional(t.Enum(SortOrder)),
  reversed: t.Optional(t.Boolean()),
  limit: t.Optional(t.Number()),
});
export type ExploreRequest = Static<typeof ExploreRequest>;

type IPossibleUserdata = {
  userData: ServerDocument<IUserData> | null | undefined;
};

type IWeightedItem = {
  entity: ServerDocument<IEntity>;
  value: number;
};

const getPopularity = async (entity: ServerDocument<IEntity>) => {
  // TODO: Implement popularity cache
  return 0;
  /* const hash = ExploreCache.hash('popularity::' + entity._id);
  const cachedPop = await ExploreCache.get<number>(hash);
  return cachedPop ?? 0; */
};

const getUsage = async (entity: ServerDocument<IEntity>) => {
  // TODO: Implement usage cache
  return 0;
  /* const hash = ExploreCache.hash('usage::' + entity._id);
  const cachedUsage = await ExploreCache.get<number>(hash);
  if (cachedUsage) return cachedUsage;

  const filter: Filter<ICompilation> = { $or: [{ password: { $eq: '' } }] };
  filter[`entities.${entity._id}`] = { $exists: true };

  const uses = (await Repo.compilation.find(filter))?.length ?? 0;
  ExploreCache.set(hash, uses);
  return uses; */
};

const getAnnotations = (entity: ServerDocument<IEntity>) => {
  return Object.keys(entity.annotations).length;
};

const getAge = (entity: ServerDocument<IEntity>) => {
  return parseInt(entity._id.toString().slice(0, 8), 16);
};

const byName = (a: ServerDocument<IEntity>, b: ServerDocument<IEntity>) =>
  a.name.localeCompare(b.name);
const byWeight = (a: IWeightedItem, b: IWeightedItem) =>
  a.value !== b.value ? b.value - a.value : byName(a.entity, b.entity);
const byAge = (a: ServerDocument<IEntity>, b: ServerDocument<IEntity>) => getAge(b) - getAge(a);

const sortEntities = async (entities: ServerDocument<IEntity>[], order: SortOrder) => {
  switch (order) {
    case SortOrder.name:
      return entities.sort(byName);
    case SortOrder.popularity:
      const popMap = new Array<IWeightedItem>();
      for (const entity of entities) popMap.push({ entity, value: await getPopularity(entity) });
      return popMap.sort(byWeight).map(item => item.entity);
    case SortOrder.usage:
      const useMap = new Array<IWeightedItem>();
      for (const entity of entities) useMap.push({ entity, value: await getUsage(entity) });
      return useMap.sort(byWeight).map(item => item.entity);
    case SortOrder.annotations:
      const annMap = new Array<IWeightedItem>();
      for (const entity of entities) annMap.push({ entity, value: getAnnotations(entity) });
      return annMap.sort(byWeight).map(item => item.entity);
    case SortOrder.newest:
      return entities.sort(byAge);
  }
};

const exploreEntities = async (body: ExploreRequest & IPossibleUserdata) => {
  const { types, offset, userData, filters, sortBy, searchText } = body;
  const limit = body.limit ?? 30;

  const entities = await (async () => {
    /* const key = `explore::entities::${exploreCache.hash({ searchText, types, filters, sortBy })}`;
    const cached = await exploreCache.get<ServerDocument<IEntity>[]>(key);
    if (cached) return cached; */
    const entities = await entityCollection
      .find({
        finished: true,
        online: true,
        mediaType: {
          $in: types,
        },
      })
      .toArray();
    const sortedEntities = await sortEntities(entities, sortBy ?? SortOrder.popularity);
    /* exploreCache.set(key, sortedEntities); */
    return sortedEntities;
  })();

  if (body.reversed) entities.reverse();
  const finalEntities = new Array<ServerDocument<IEntity>>();
  const userOwned = userData ? JSON.stringify(userData.data) : '';

  // TODO: fully or partly resolve depending on if userdata is available
  for (let i = offset; i < entities.length && finalEntities.length < limit; i++) {
    const _entity = entities[i];
    if (!_entity || !_entity._id) continue;
    const resolved = await resolveEntity(_entity).catch((error) => {
      err(_entity._id, error);
      return 'BREAK';
    });
    if (!resolved) continue;
    if (typeof resolved === 'string') break;

    const isOwner = userOwned.includes(resolved._id.toString());
    const metadata = JSON.stringify(resolved).toLowerCase();

    const isAnnotatable = isOwner; // only owner can set default annotations
    if (filters.annotatable && !isAnnotatable) continue;

    const isAnnotated = Object.keys(resolved.annotations).length > 0;
    if (filters.annotated && !isAnnotated) continue;

    let isRestricted = false;
    // Whitelist visibility filter
    if (resolved.whitelist.enabled) {
      if (!userData) continue;
      // TODO: manual checking instead of JSON.stringify
      const isWhitelisted = JSON.stringify(resolved.whitelist).includes(userData._id.toString());
      if (!isOwner && !isWhitelisted) continue;
      isRestricted = true;
    }
    if (filters.restricted && !isRestricted) continue;

    const isAssociated = userData // user appears in metadata
      ? metadata.includes(userData.fullname.toLowerCase()) ||
        metadata.includes(userData.mail.toLowerCase())
      : false;
    if (filters.associated && !isAssociated) continue;

    // Search text filter
    if (searchText !== '' && !metadata.includes(searchText.toLowerCase())) {
      continue;
    }

    const { description, licence } = resolved.relatedDigitalEntity as IDigitalEntity;
    finalEntities.push({
      ...resolved,
      relatedDigitalEntity: {
        description,
        licence,
      } as IDigitalEntity,
    });
  }

  return finalEntities;
};

const exploreCompilations = async (body: ExploreRequest & IPossibleUserdata) => {
  const { offset, userData, filters, searchText } = body;
  const limit = body.limit ?? 30;
  const compilations = await compilationCollection.find({}).toArray();
  // TODO: compilation sort params?
  const sortedComps = compilations; //  sortEntities(compilations, sortBy ?? SortOrder.popularity);
  const finalComps = new Array<ServerDocument<ICompilation>>();
  const userOwned = userData ? JSON.stringify(userData.data) : '';

  for (let i = offset; i < sortedComps.length && finalComps.length < limit; i++) {
    const _comp = sortedComps[i];
    if (!_comp) continue;
    const resolved = await resolveCompilation(_comp);

    if (!resolved || !resolved._id) continue;
    if (Object.keys(resolved.entities).length === 0) continue;

    if (searchText !== '') {
      if (
        !resolved.name.toLowerCase().includes(searchText) &&
        !resolved.description.toLowerCase().includes(searchText)
      ) {
        continue;
      }
    }

    const isOwner = userOwned.includes(resolved._id.toString());

    const isPWProtected = resolved.password !== undefined && resolved.password !== '';

    // owner can always annotate
    // otherwise only logged in and only if included in whitelist
    const isWhitelisted =
      resolved.whitelist.enabled &&
      userData &&
      JSON.stringify(resolved.whitelist).includes(userData._id.toString());
    const isAnnotatable = isOwner ? true : isWhitelisted;
    if (filters.annotatable && !isAnnotatable) continue;

    if (isPWProtected && !isOwner && !isAnnotatable) continue;
    if (filters.restricted && isPWProtected) continue;

    const isAnnotated = Object.keys(resolved.annotations).length > 0;
    if (filters.annotated && !isAnnotated) continue;

    for (const id in resolved.entities) {
      const value = resolved.entities[id];
      if (!isEntity(value)) {
        delete resolved.entities[id];
        continue;
      }
      const { mediaType, name, settings } = value;
      resolved.entities[id] = { mediaType, name, settings } as IEntity;
    }
    for (const id in resolved.annotations) {
      const value = resolved.annotations[id];
      if (!isAnnotation(value)) {
        delete resolved.annotations[id];
        continue;
      }
      resolved.annotations[id] = { _id: value._id };
    }

    finalComps.push({
      ...resolved,
      password: isPWProtected,
    });
  }

  return finalComps;
};

export { exploreEntities, exploreCompilations };
