import type { ICompilation, IUserData } from 'src/common';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { resolveCompilation } from '../../api.v1/resolving-strategies';
import { AnnotationFilter, MiscFilter, type ExploreRequest } from '../types';
import { isUserWhitelisted } from 'src/util/permission-helpers';

export const filterCompilations = async (
  documents: ServerDocument<ICompilation>[],
  { access, annotations, mediaTypes, licences, misc, limit, offset }: ExploreRequest,
  userdata: ServerDocument<IUserData> | undefined = undefined,
): Promise<ServerDocument<ICompilation>[]> => {
  const resultDocuments = new Array<ServerDocument<ICompilation>>();
  let toSkip = offset;
  for (const document of documents) {
    if (resultDocuments.length >= limit) break;
    const resolved = (await resolveCompilation(document, 2)) as
      | ServerDocument<ICompilation<2>>
      | undefined;
    if (!resolved) continue;
    const entities = Object.values(resolved.entities);

    if (licences.length > 0) {
      const anyEntityHasLicence = entities.some(e =>
        licences.includes(e.relatedDigitalEntity.licence.replaceAll('-', '')),
      );
      if (!anyEntityHasLicence) continue;
    }

    if (misc.length > 0) {
      if (misc.includes(MiscFilter.downloadable)) {
        const anyEntityIsDownloadable = entities.some(e => e.options?.allowDownload);
        if (!anyEntityIsDownloadable) continue;
      }
      // TODO: Animated filter
    }

    if (mediaTypes.length > 0) {
      const anyEntityHasMediaType = entities.some(e => mediaTypes.includes(e.mediaType));
      if (!anyEntityHasMediaType) continue;
    }

    if (annotations !== AnnotationFilter.all) {
      if (annotations === AnnotationFilter.withAnnotations) {
        const anyEntityHasAnnotations = entities.some(e => Object.keys(e.annotations).length > 0);
        if (!anyEntityHasAnnotations) continue;
      } else if (annotations === AnnotationFilter.withoutAnnotations) {
        const allEntitiesHaveNoAnnotations = entities.every(
          e => Object.keys(e.annotations).length === 0,
        );
        if (!allEntitiesHaveNoAnnotations) continue;
      }
    }

    if (resolved.whitelist?.enabled) {
      if (!isUserWhitelisted(resolved, userdata)) continue;
    }

    // TODO: Compilation access field?
    /*if (access.length > 0) {
      if (!userdata) continue;
      if (!resolved.access) continue;
      const userRole = resolved.access[userdata._id.toString()]?.role;
      if (!access.includes(userRole)) continue;
      }*/

    // Offset
    if (toSkip > 0) {
      toSkip--;
      continue;
    }

    resultDocuments.push(resolved as ICompilation);
  }

  return resultDocuments;
};
