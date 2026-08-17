type QualifierMap = Record<string, string | string[]>;

type SimplifiedClaimValue = string | { value: string; qualifiers?: QualifierMap };

export type SimplifiedClaims = Record<
  string,
  SimplifiedClaimValue | SimplifiedClaimValue[] | undefined | null
>;

export type RestStatement = {
  property: { id: string };
  value: { type: 'value'; content: string };
  qualifiers?: { property: { id: string }; value: { type: 'value'; content: string } }[];
};

export type RestStatements = Record<string, RestStatement[]>;

type PatchReplaceOp = { op: 'replace'; path: string; value: unknown };

const asArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);

export const buildStatement = (propertyId: string, value: SimplifiedClaimValue): RestStatement => {
  if (typeof value === 'string') {
    return { property: { id: propertyId }, value: { type: 'value', content: value } };
  }
  const statement: RestStatement = {
    property: { id: propertyId },
    value: { type: 'value', content: value.value },
  };
  if (value.qualifiers) {
    statement.qualifiers = [];
    for (const [qualifierPropertyId, qualifierValue] of Object.entries(value.qualifiers)) {
      for (const content of asArray(qualifierValue)) {
        statement.qualifiers.push({
          property: { id: qualifierPropertyId },
          value: { type: 'value', content },
        });
      }
    }
  }
  return statement;
};

export const buildStatements = (claims: SimplifiedClaims): RestStatements => {
  const statements: RestStatements = {};
  for (const [propertyId, raw] of Object.entries(claims)) {
    if (raw === undefined || raw === null) continue;
    const values = asArray(raw);
    if (values.length === 0) continue;
    statements[propertyId] = values.map(v => buildStatement(propertyId, v));
  }
  return statements;
};

export const replaceItemPatch = (spec: {
  statements: RestStatements;
  labels: Record<string, string>;
  descriptions: Record<string, string>;
}): PatchReplaceOp[] => {
  return [
    { op: 'replace', path: '/statements', value: spec.statements },
    { op: 'replace', path: '/labels', value: spec.labels },
    { op: 'replace', path: '/descriptions', value: spec.descriptions },
  ];
};
