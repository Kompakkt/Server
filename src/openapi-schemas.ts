import * as Common from '@kompakkt/common';
import type { OpenAPIV3 } from 'openapi-types';

const isTypeBoxSchema = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.type === 'string' ||
    Array.isArray(v.anyOf) ||
    Array.isArray(v.allOf) ||
    Array.isArray(v.oneOf) ||
    Array.isArray(v.enum) ||
    'const' in v
  );
};

export const buildCommonComponentsSchemas = (): Record<string, OpenAPIV3.SchemaObject> => {
  const out: Record<string, OpenAPIV3.SchemaObject> = {};
  for (const [name, value] of Object.entries(Common)) {
    if (!name.endsWith('Schema')) continue;
    if (!isTypeBoxSchema(value)) continue;
    const cleanName = name.replace(/Schema$/g, '');
    out[cleanName] = {
      ...(value as object),
      $id: `#/components/schemas/${cleanName}`,
    } as OpenAPIV3.SchemaObject;
  }
  return out;
};
