// tslint:disable-next-line
import {
  IAnnotation,
  ICompilation,
  IMetaDataDigitalEntity,
  IMetaDataPerson,
  IMetaDataInstitution,
  IEntity,
  IInvalid,
} from '../interfaces';

export const isCompilation = (obj: any): obj is ICompilation => {
  const compilation = obj as ICompilation | IInvalid;
  return (
    compilation?.entities !== undefined &&
    compilation?.name !== undefined &&
    compilation?.description !== undefined
  );
};

export const isEntity = (obj: any): obj is IEntity => {
  const entity = obj as IEntity | IInvalid;
  return (
    entity?.name !== undefined &&
    entity?.mediaType !== undefined &&
    entity?.online !== undefined &&
    entity?.finished !== undefined
  );
};

export const isAnnotation = (obj: any): obj is IAnnotation => {
  const annotation = obj as IAnnotation | IInvalid;
  return annotation?.body !== undefined && annotation?.target !== undefined;
};

export const isDigitalEntity = (obj: any): obj is IMetaDataDigitalEntity => {
  const digentity = obj as IMetaDataDigitalEntity | IInvalid;
  return digentity?.type !== undefined && digentity?.licence !== undefined;
};

export const isPerson = (obj: any): obj is IMetaDataPerson => {
  const person = obj as IMetaDataPerson | IInvalid;
  return person?.prename !== undefined && person?.name !== undefined;
};

export const isInstitution = (obj: any): obj is IMetaDataInstitution => {
  const inst = obj as IMetaDataInstitution | IInvalid;
  return inst?.name !== undefined && inst?.addresses !== undefined;
};
