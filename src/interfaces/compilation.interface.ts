import { Model } from './model.interface';

export interface Compilation {
    _id?: string;
    relatedOwner?: string;
    models: Model[];
}
