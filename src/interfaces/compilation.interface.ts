import { IModel } from './model.interface';

export interface ICompilation {
  _id?: string;
  name?: string;
  description?: string;
  relatedOwner?: string;
  passcode?: string;
  models: IModel[];
  annotationList: string[];
}
