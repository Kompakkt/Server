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
  value?: unknown;
  expectedType?: string;
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
  invalidOnly?: boolean;
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

const describeExpectedType = (schema: unknown): string => {
  if (typeof schema !== 'object' || schema === null) return 'unknown';
  const s = schema as Record<string, unknown>;
  if (typeof s.type === 'string') return s.type;
  if (Array.isArray(s.enum)) return `enum(${s.enum.join(', ')})`;
  if (s.const !== undefined) return `const(${JSON.stringify(s.const)})`;
  if (Array.isArray(s.anyOf)) return 'anyOf';
  if (Array.isArray(s.oneOf)) return 'oneOf';
  if (Array.isArray(s.allOf)) return 'allOf';
  if (typeof s.$ref === 'string') return s.$ref;
  return 'unknown';
};

export const validateDocument = (
  schema: TSchema,
  doc: unknown,
  detailed?: boolean,
): IValidationIssue[] =>
  [...Errors(schema, doc)].map(err => ({
    path: err.path,
    message: err.message,
    ...(detailed ? { value: err.value, expectedType: describeExpectedType(err.schema) } : {}),
  }));

const documentIdString = (doc: Document): string =>
  doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id);

export const validateDocuments = async (
  options: IValidateOptions = {},
): Promise<IValidationSummary> => {
  const { collection, limit = DEFAULT_LIMIT, skip = 0, invalidOnly = false } = options;
  const collections = collection ? [collection] : (Object.values(Collection) as Collection[]);
  const results: IDocumentValidationResult[] = [];

  for (const coll of collections) {
    const docs = await collectionMap[coll].find({}, { skip, limit, sort: { _id: 1 } }).toArray();
    const count = await collectionMap[coll].countDocuments();
    info(`Validating ${docs.length} document(s) from "${coll}"`);
    const schema = collectionSchemaMap[coll];
    for (const doc of docs) {
      const issues = validateDocument(schema, doc, invalidOnly);
      if (!invalidOnly || issues.length > 0) {
        results.push({
          collection: coll,
          documentId: documentIdString(doc),
          valid: issues.length === 0,
          issues,
          hasMore: count > skip + docs.length,
        });
      }
    }
  }

  return {
    totalChecked: results.length,
    totalInvalid: results.filter(r => !r.valid).length,
    results,
  };
};
