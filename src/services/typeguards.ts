import { IAnnotation, ICompilation, IModel, IMetaDataDigitalObject } from '../interfaces';

export const isCompilation = (obj: any): obj is ICompilation => {
  const compilation = obj as ICompilation;
  return compilation.models !== undefined
    && compilation.name !== undefined
    && compilation.description !== undefined;
};

export const isModel = (obj: any): obj is IModel => {
  const model = obj as IModel;
  return model.name !== undefined && model.mediaType !== undefined
    && model.online !== undefined && model.finished !== undefined;
};

export const isAnnotation = (obj: any): obj is IAnnotation => {
  const annotation = obj as IAnnotation;
  return annotation.body !== undefined && annotation.target !== undefined;
};

export const isDigitalObject = (obj: any): obj is IMetaDataDigitalObject => {
  const digobj = obj as IMetaDataDigitalObject;
  return digobj.digobj_title !== undefined;
}
