import { hasExtensions, type IEntityResolved } from "@kompakkt/common";

export type DfgMetsExtensionData = {
  dfgMets?: {
    sharingEnabled?: boolean;
  };
};

export type MetsEntity = IEntityResolved & { extensions?: DfgMetsExtensionData };

export const isMetsEntity = (entity: IEntityResolved): entity is MetsEntity => {
  return hasExtensions(entity) && 'dfgMets' in (entity.extensions);
};
