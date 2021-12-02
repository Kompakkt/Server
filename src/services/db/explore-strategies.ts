import { Filter } from 'mongodb';
import { Repo } from './controllers';
import { Entities } from './entities';
import { ExploreCache } from '../cache';
import {
  IEntity,
  ICompilation,
  IDigitalEntity,
  isEntity,
  isAnnotation,
  IUserData,
} from '../../common';

export enum SortOrder {
  name = 'name',
  popularity = 'popularity',
  usage = 'usage',
  annotations = 'annotations',
  newest = 'newest',
}

export interface IExploreRequest {
  searchEntity: boolean;
  types: string[];
  filters: {
    annotatable: boolean;
    annotated: boolean;
    restricted: boolean;
    associated: boolean;
  };
  searchText: string;
  offset: number;
  sortBy: SortOrder;
  reversed: boolean;
  limit: number;
}

interface IPossibleUserdata {
  userData?: IUserData;
}

interface IWeightedItem {
  entity: IEntity;
  value: number;
}

const getPopularity = async (entity: IEntity) => {
  const hash = ExploreCache.hash('popularity::' + entity._id);
  const cachedPop = await ExploreCache.get<number>(hash);
  return cachedPop ?? 0;
};

const getUsage = async (entity: IEntity) => {
  const hash = ExploreCache.hash('usage::' + entity._id);
  const cachedUsage = await ExploreCache.get<number>(hash);
  if (cachedUsage) return cachedUsage;

  const filter: Filter<ICompilation> = { $or: [{ password: { $eq: '' } }] };
  filter[`entities.${entity._id}`] = { $exists: true };

  const uses = (await Repo.compilation.find(filter))?.length ?? 0;
  ExploreCache.set(hash, uses);
  return uses;
};

const getAnnotations = (entity: IEntity) => {
  return Object.keys(entity.annotations).length;
};

const getAge = (entity: IEntity) => {
  return parseInt(entity._id.toString().slice(0, 8), 16);
};

const byName = (a: IEntity, b: IEntity) => a.name.localeCompare(b.name);
const byWeight = (a: IWeightedItem, b: IWeightedItem) => b.value - a.value;
const byAge = (a: IEntity, b: IEntity) => getAge(b) - getAge(a);

const sortEntities = async (entities: IEntity[], order: SortOrder) => {
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

const exploreEntities = async (body: IExploreRequest & IPossibleUserdata) => {
  const { types, offset, limit, userData, filters, sortBy, searchText } = body;
  const entities =
    (await Repo.entity.find({
      finished: true,
      online: true,
      mediaType: {
        $in: types,
      },
    })) ?? [];
  const sortedEntities = await sortEntities(entities, sortBy ?? SortOrder.popularity);
  if (body.reversed) sortedEntities.reverse();
  const finalEntities = new Array<IEntity>();
  const userOwned = userData ? JSON.stringify(userData.data) : '';

  // TODO: fully or partly resolve depending on if userdata is available
  for (let i = offset; i < sortedEntities.length && finalEntities.length < limit; i++) {
    const _entity = sortedEntities[i];
    if (!_entity || !_entity._id) continue;
    const resolved = await Entities.resolve<IEntity>(_entity, 'entity');
    if (!resolved) continue;

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
    if (searchText !== '' && !metadata.includes(searchText)) {
      continue;
    }

    const { description, licence } = resolved.relatedDigitalEntity as IDigitalEntity;
    finalEntities.push({
      ...resolved,
      relatedDigitalEntity: {
        description,
        licence,
      } as IDigitalEntity,
    } as IEntity);
  }

  return finalEntities;
};

const exploreCompilations = async (body: IExploreRequest & IPossibleUserdata) => {
  const { offset, limit, userData, filters, searchText } = body;
  const compilations = (await Repo.compilation.findAll()) ?? [];
  // TODO: compilation sort params?
  const sortedComps = compilations; //  sortEntities(compilations, sortBy ?? SortOrder.popularity);
  const finalComps = new Array<ICompilation>();
  const userOwned = userData ? JSON.stringify(userData.data) : '';

  for (let i = offset; i < sortedComps.length && finalComps.length < limit; i++) {
    const _comp = sortedComps[i];
    if (!_comp) continue;
    const resolved = await Entities.resolve<ICompilation>(_comp, 'compilation');

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
