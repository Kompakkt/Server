import { Model } from './model.interface';

export interface Compilation {
    _id?: string;
    name?: string;
    description?: string;
    relatedOwner?: string;
    passcode?: string;
    models: Model[];
}
