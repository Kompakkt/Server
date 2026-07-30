import { Errors } from '@sinclair/typebox/errors';
import type { TSchema } from '@sinclair/typebox';
import { ObjectId, type Document } from 'mongodb';
import {
  Collection,
  IAddressSchema,
  IAnnotationSchema,
  ICompilationSchema,
  IContactSchema,
  IDigitalEntitySchema,
  IEntitySchema,
  IInstitutionSchema,
  IPersonSchema,
  IPhysicalEntitySchema,
  ITagSchema,
} from '@kompakkt/common';
import { collectionMap } from 'src/mongo';
import { info } from 'src/logger';

export interface IValidationIssue {
  path: string;
  message: string;
}

export interface IDocumentValidationResult {
  collection: Collection;
  documentId: string;
  valid: boolean;
  issues: IValidationIssue[];
  hasMore: boolean;
}

export interface IValidationSummary {
  totalChecked: number;
  totalInvalid: number;
  results: IDocumentValidationResult[];
}

export interface IValidateOptions {
  collection?: Collection;
  limit?: number;
  skip?: number;
}

export const collectionSchemaMap: Record<Collection, TSchema> = {
  [Collection.address]: IAddressSchema,
  [Collection.annotation]: IAnnotationSchema,
  [Collection.compilation]: ICompilationSchema,
  [Collection.contact]: IContactSchema,
  [Collection.digitalentity]: IDigitalEntitySchema,
  [Collection.entity]: IEntitySchema,
  [Collection.institution]: IInstitutionSchema,
  [Collection.person]: IPersonSchema,
  [Collection.physicalentity]: IPhysicalEntitySchema,
  [Collection.tag]: ITagSchema,
};

const DEFAULT_LIMIT = 1000;

export const validateDocument = (schema: TSchema, doc: unknown): IValidationIssue[] =>
  [...Errors(schema, doc)].map(err => ({
    path: err.path,
    message: err.message,
  }));

const documentIdString = (doc: Document): string =>
  doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id);

export const validateDocuments = async (
  options: IValidateOptions = {},
): Promise<IValidationSummary> => {
  const { collection, limit = DEFAULT_LIMIT, skip = 0 } = options;
  const collections = collection ? [collection] : (Object.values(Collection) as Collection[]);
  const results: IDocumentValidationResult[] = [];

  for (const coll of collections) {
    const docs = await collectionMap[coll].find({}, { skip, limit, sort: { _id: 1 } }).toArray();
    const count = await collectionMap[coll].countDocuments();
    info(`Validating ${docs.length} document(s) from "${coll}"`);
    const schema = collectionSchemaMap[coll];
    for (const doc of docs) {
      const issues = validateDocument(schema, doc);
      results.push({
        collection: coll,
        documentId: documentIdString(doc),
        valid: issues.length === 0,
        issues,
        hasMore: count > skip + docs.length,
      });
    }
  }

  return {
    totalChecked: results.length,
    totalInvalid: results.filter(r => !r.valid).length,
    results,
  };
};
