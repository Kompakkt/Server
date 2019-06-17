// tslint:disable-next-line
import { IAnnotation, ICompilation, IMetaDataDigitalObject, IMetaDataPerson, IModel, IInvalid } from '../interfaces';

export const isCompilation = (obj: any): obj is ICompilation => {
  const compilation = obj as ICompilation | IInvalid;
  return compilation && compilation.models !== undefined
    && compilation.name !== undefined
    && compilation.description !== undefined;
};

export const isModel = (obj: any): obj is IModel => {
  const model = obj as IModel | IInvalid;
  return model && model.name !== undefined && model.mediaType !== undefined
    && model.online !== undefined && model.finished !== undefined;
};

export const isAnnotation = (obj: any): obj is IAnnotation => {
  const annotation = obj as IAnnotation | IInvalid;
  return annotation && annotation.body !== undefined && annotation.target !== undefined;
};

export const isDigitalObject = (obj: any): obj is IMetaDataDigitalObject => {
  const digobj = obj as IMetaDataDigitalObject | IInvalid;
  return digobj && digobj.digobj_title !== undefined;
};

export const isPerson = (obj: any): obj is IMetaDataPerson => {
  const person = obj as IMetaDataPerson | IInvalid;
  return person && person.person_prename !== undefined && person.person_surname !== undefined;
};
