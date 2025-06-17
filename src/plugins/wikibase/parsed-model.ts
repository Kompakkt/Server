import { WikibaseConfiguration } from './config';
import { log, err, info } from 'src/logger';

const turtleUrl =
  WikibaseConfiguration?.TTLFileURL ??
  `https://gitlab.com/nfdi4culture/wikibase4research/auxiliary-service-repositories/wikibase-model/-/raw/main/wikibase_generic_model.ttl`;
// `https://gitlab.com/nfdi4culture/wikibase4research/auxiliary-service-repositories/wikibase-model/-/raw/37-update-the-data-model-for-events-and-event-related-properties/wikibase_generic_model.ttl`;

log(`Downloading wikibase turtle file from ${turtleUrl}`);
const ttl = await Bun.fetch(turtleUrl)
  .then(res => res.text())
  .catch(error => {
    err(`Failed to fetch ${turtleUrl}: ${error}`);
    return undefined;
  });

if (!ttl) {
  err(`No Wikibase turtle file found. Exiting`);
  process.exit(1);
}

const snakeToCamel = (str: string) =>
  str
    .replace('position_in_3d_model_-_', '')
    .replace(/[_-]([a-z0-9])/g, (_, letter) => letter.toUpperCase());

const model = ttl
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.match(/^wgm:\w+/) || line.match(/^skos:note\s+"Wikibase ID:\s+[PQ]\d+/))
  .map(line =>
    line.includes('wgm')
      ? line.split(/\s+/).at(0)?.replace('wgm:', '')
      : line.match(/Wikibase ID:\s+([PQ]\d+)/)?.at(1),
  )
  .reduce(
    (acc, curr, index) => {
      curr = snakeToCamel(curr as string).trim();
      if (index % 2 === 1 && acc.prev) {
        acc.final[acc.prev] = curr as string;
      }
      acc.prev = curr;
      return acc;
    },
    {
      final: {} as Record<string, string>,
      prev: undefined as string | undefined,
    },
  ).final;

info(`Wikibase model parsed from turtle file. ${Object.keys(model).length} entries parsed`);

const WBPredicatesArr = [
  'instanceOf',
  'subclassOf',
  'partOf',
  'hasEvent',
  'date',
  'carriedOutBy',
  'inCustodyOf',
  'owner',
  'rightHeldBy',
  'curator',
  'contactPerson',
  'externalLink',
  'documentedIn', // bibliographicRef
  'license',
  'image',
  'objectOfRepresentation',
  'method',
  'softwareUsed',
  'equipment',
  'fileView',
  'hasAnnotation',

  // Added in june 2025 model changes
  'createdBy',
  'modifiedBy',
  'rawDataCreatedBy', // might not be added
] as const;

const WBAnnotationPredicatesArr = [
  'cameraType',
  'ranking',
  'motivation',
  'verified',
  'perspectivePositionXAxis',
  'perspectivePositionYAxis',
  'perspectivePositionZAxis',
  'perspectiveTargetXAxis',
  'perspectiveTargetYAxis',
  'perspectiveTargetZAxis',
  'selectorRefPointXAxis',
  'selectorRefPointYAxis',
  'selectorRefPointZAxis',
  'selectorRefNormalXAxis',
  'selectorRefNormalYAxis',
  'selectorRefNormalZAxis',
  'annotationText',
  'annotates',
  'relatedConcept',
  'relatedMedia',
] as const;

const WBClassesArr = [
  'group',
  'human',
  'humanMadeObject',
  'conceptualObject',
  'mediaItem',
  'software',
  'bibliographicWork',
  'annotation',
  'event',
  'creation',
  'modification',
  'rawDataCreation',
  'organization',
  'license',
  'technique',
  'iconographicConcept',
] as const;

const WBValuesArr = ['true', 'false', 'describing'] as const;

const WBLicensesArr = [
  'cc0',
  'creativeCommonsAttribution',
  'creativeCommonsAttributionSharealike',
  'creativeCommonsAttributionNoncommercial',
  'creativeCommonsAttributionNoncommercialNoderivatives',
  'creativeCommonsAttributionNoderivatives',
  'creativeCommonsAttributionNoncommercialSharealike',
  'allRightsReserved',
];

const createMapping = <T extends readonly string[]>(arr: T, model: Record<string, string>) => {
  return Object.fromEntries(arr.map(key => [key, model[key]])) as Record<T[number], string>;
};

export const WBValues = createMapping(WBValuesArr, model);
export const WBPredicates = createMapping(WBPredicatesArr, model);
export const WBAnnotationPredicates = createMapping(WBAnnotationPredicatesArr, model);
export const WBClasses = createMapping(WBClassesArr, model);
export const WBLicenses = createMapping(WBLicensesArr, model);

log(
  `Full model: ${Bun.inspect({ WBValues, WBPredicates, WBAnnotationPredicates, WBClasses, WBLicenses })}`,
);
