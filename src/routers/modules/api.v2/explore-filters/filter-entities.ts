import type { IEntity, IUserData } from 'src/common';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { resolveEntity } from '../../api.v1/resolving-strategies';
import { AnnotationFilter, MiscFilter, type ExploreRequest } from '../types';
import { isUserWhitelisted } from 'src/util/permission-helpers';

export const filterEntities = async (
  documents: ServerDocument<IEntity>[],
  { access, annotations, mediaTypes, licences, misc, limit, offset }: ExploreRequest,
  userdata: ServerDocument<IUserData> | undefined = undefined,
): Promise<ServerDocument<IEntity>[]> => {
  const resultDocuments = new Array<ServerDocument<IEntity>>();
  let toSkip = offset;
  for (const document of documents) {
    if (resultDocuments.length >= limit) break;
    const resolved = (await resolveEntity(document, 1)) as
      | ServerDocument<IEntity<unknown, false>>
      | undefined;
    if (!resolved) continue;

    if (licences.length > 0) {
      if (!('licence' in resolved.relatedDigitalEntity)) continue;
      const licence = resolved.relatedDigitalEntity.licence.replaceAll('-', '');
      if (!licences.includes(licence)) continue;
    }

    if (misc.length > 0) {
      if (misc.includes(MiscFilter.downloadable)) {
        if (!resolved?.options?.allowDownload) continue;
      }
      // TODO: Animated filter
    }

    if (mediaTypes.length > 0) {
      if (!mediaTypes.includes(resolved.mediaType)) continue;
    }

    if (annotations !== AnnotationFilter.all) {
      if (annotations === AnnotationFilter.withAnnotations) {
        if (Object.keys(resolved.annotations).length === 0) continue;
      } else if (annotations === AnnotationFilter.withoutAnnotations) {
        if (Object.keys(resolved.annotations).length > 0) continue;
      }
    }

    if (resolved.whitelist?.enabled) {
      if (!isUserWhitelisted(resolved, userdata)) continue;
    }

    if (access.length > 0) {
      if (!userdata) continue;
      if (!resolved.access) continue;
      const userRole = resolved.access[userdata._id.toString()]?.role;
      if (!access.includes(userRole)) continue;
    }

    // Offset
    if (toSkip > 0) {
      toSkip--;
      continue;
    }

    resultDocuments.push(resolved as IEntity);
  }

  return resultDocuments;
};
