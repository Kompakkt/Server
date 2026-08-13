import { WikibaseConfiguration } from './config';

type SparqlBinding = {
  'value': string;
  'type': string;
  'xml:lang'?: string;
  'datatype'?: string;
};

type SparqlResults = {
  head: { vars: string[] };
  results: { bindings: Record<string, SparqlBinding>[] };
};

const encodeCharacter = (c: string) => '%' + c.charCodeAt(0).toString(16).toUpperCase();

const fixedEncodeURIComponent = (str: string) =>
  encodeURIComponent(str).replace(/[!'()*]/g, encodeCharacter);

const convertStatementUriToGuid = (uri: string) => {
  const stripped = uri.replace(/^https?:\/\/.*\/entity\/statement\//, '');
  const parts = stripped.split('-');
  return parts[0] + '$' + parts.slice(1).join('-');
};

const parseUri = (uri: string) => {
  if (uri.match(/http.*\/entity\/statement\//)) {
    return convertStatementUriToGuid(uri);
  }
  return uri.replace(/^https?:\/\/.*\/entity\//, '').replace(/^https?:\/\/.*\/prop\/direct\//, '');
};

const parseValue = (valueObj: SparqlBinding | undefined): unknown => {
  if (!valueObj || valueObj.type === 'bnode') return null;
  const { value } = valueObj;
  if (valueObj.type === 'uri') return parseUri(value);
  const datatype = (valueObj.datatype || '').replace('http://www.w3.org/2001/XMLSchema#', '');
  if (
    datatype === 'decimal' ||
    datatype === 'integer' ||
    datatype === 'float' ||
    datatype === 'double'
  ) {
    return parseFloat(value);
  }
  if (datatype === 'boolean') return value === 'true';
  return value;
};

const identifyVars = (vars: string[]) => {
  let richVars = vars.filter(varName => {
    const isAssociatedPattern = new RegExp(`^${varName}[A-Z]\\w+`);
    return vars.some(v => isAssociatedPattern.test(v));
  });
  richVars = richVars.filter(richVar => {
    return !richVars.some(otherRichVar => {
      return richVar !== otherRichVar && richVar.startsWith(otherRichVar);
    });
  });
  const associatedVarPattern = new RegExp(`^(${richVars.join('|')})[A-Z]`);
  const associatedVars = vars.filter(varName => associatedVarPattern.test(varName));
  const standaloneVars = vars.filter(varName => {
    return !richVars.includes(varName) && !associatedVarPattern.test(varName);
  });
  return { richVars, associatedVars, standaloneVars };
};

const addAssociatedValue = (
  input: Record<string, SparqlBinding>,
  varName: string,
  associatedVarName: string,
  richVarData: Record<string, unknown>,
) => {
  let shortAssociatedVarName = associatedVarName.split(varName)[1];
  shortAssociatedVarName =
    shortAssociatedVarName[0].toLowerCase() + shortAssociatedVarName.slice(1);
  if (shortAssociatedVarName === 'altLabel') shortAssociatedVarName = 'aliases';
  const associatedVarData = input[associatedVarName];
  if (associatedVarData != null) richVarData[shortAssociatedVarName] = associatedVarData.value;
};

const getSimplifiedResult = (
  richVars: string[],
  associatedVars: string[],
  standaloneVars: string[],
  input: Record<string, SparqlBinding>,
) => {
  const simplifiedResult: Record<string, unknown> = {};
  for (const varName of richVars) {
    const richVarData: Record<string, unknown> = {};
    const value = parseValue(input[varName]);
    if (value != null) richVarData.value = value;
    for (const associatedVarName of associatedVars) {
      if (associatedVarName.startsWith(varName)) {
        addAssociatedValue(input, varName, associatedVarName, richVarData);
      }
    }
    if (Object.keys(richVarData).length > 0) simplifiedResult[varName] = richVarData;
  }
  for (const varName of standaloneVars) {
    const value = parseValue(input[varName]);
    if (value != null) simplifiedResult[varName] = value;
  }
  return simplifiedResult;
};

export const simplifySparqlResults = <T = Record<string, unknown>>(
  input: SparqlResults | string,
): T[] => {
  if (typeof input === 'string') input = JSON.parse(input) as SparqlResults;
  const { vars } = input.head;
  const results = input.results.bindings;
  const { richVars, associatedVars, standaloneVars } = identifyVars(vars);
  return results.map(result =>
    getSimplifiedResult(richVars, associatedVars, standaloneVars, result),
  ) as T[];
};

export const sparqlQueryUrl = (spark: string): string => {
  const sparqlEndpoint = WikibaseConfiguration?.SPARQLEndpoint;
  if (!sparqlEndpoint) throw new Error('Wikibase SPARQL endpoint not configured');
  const query = fixedEncodeURIComponent(spark.trim());
  if (sparqlEndpoint.includes('qlever')) {
    const { origin, pathname } = new URL(sparqlEndpoint);
    const apiBase = pathname.startsWith('/api') ? sparqlEndpoint : `${origin}/api${pathname}`;
    return `${apiBase}?query=${query}&action=json_export`;
  }
  return `${sparqlEndpoint}?format=json&query=${query}`;
};
