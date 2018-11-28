import { Model } from './model.interface';

export interface Compilation {
    _id?: string;
    name?: string;
    relatedOwner?: string;
    models: Model[];
}
