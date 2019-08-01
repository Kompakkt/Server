// tslint:disable-next-line
import { IAnnotation, ICompilation, IMetaDataDigitalEntity, IMetaDataPerson, IEntity, IInvalid } from '../interfaces';

export const isCompilation = (obj: any): obj is ICompilation => {
  const compilation = obj as ICompilation | IInvalid;
  return compilation && compilation.entities !== undefined
    && compilation.name !== undefined
    && compilation.description !== undefined;
};

export const isEntity = (obj: any): obj is IEntity => {
  const entity = obj as IEntity | IInvalid;
  return entity && entity.name !== undefined && entity.mediaType !== undefined
    && entity.online !== undefined && entity.finished !== undefined;
};

export const isAnnotation = (obj: any): obj is IAnnotation => {
  const annotation = obj as IAnnotation | IInvalid;
  return annotation && annotation.body !== undefined && annotation.target !== undefined;
};

export const isDigitalEntity = (obj: any): obj is IMetaDataDigitalEntity => {
  const digobj = obj as IMetaDataDigitalEntity | IInvalid;
  return digobj && digobj.digobj_title !== undefined;
};

export const isPerson = (obj: any): obj is IMetaDataPerson => {
  const person = obj as IMetaDataPerson | IInvalid;
  return person && person.person_prename !== undefined && person.person_surname !== undefined;
};
