import type { OpenAPIV3 } from 'openapi-types';

export const RouterTags = {
  'Admin': 'Admin',
  'API V1': 'API V1',
  'API V2': 'API V2',
  'User Management': 'User Management',
  'Cleaning': 'Cleaning',
  'Mail': 'Mail',
  'Upload': 'Upload',
  'Testing': 'Testing',
  'Utility': 'Utility',
  'Monitoring': 'Monitoring',

  'Profile': 'Profile',
  'Entity Management': 'Entity Management',

  // Plugin tags
  'Wikibase': 'Wikibase',
  'Lara3D Suite': 'Lara3D Suite',
  'Cologne Cave': 'Cologne Cave',
  'Sketchfab Importer': 'Sketchfab Importer',
  'OIDC Authentication': 'OIDC Authentication',
} as const;

export const RouterTagDescriptions: Record<keyof typeof RouterTags, string> = {
  'Admin': 'Endpoints for administrative tasks',
  'API V1': 'Legacy API endpoints (v1)',
  'API V2': 'Current API endpoints (v2)',
  'User Management': 'Endpoints for managing user accounts and profiles',
  'Cleaning': 'Endpoints for cleaning up data and resources',
  'Mail': 'Endpoints for sending and managing emails',
  'Upload': 'Endpoints for handling file uploads and retrieving uploaded files',
  'Testing': 'Endpoints for testing purposes',
  'Utility': 'Utility endpoints for various helper functions',
  'Monitoring': 'Endpoints for monitoring system health and performance',

  'Profile': 'Endpoints related to public user & institution profiles',
  'Entity Management': 'Endpoints for managing entities and collections',

  // Plugin tags
  'Wikibase': 'Endpoints related to Wikibase integration',
  'Lara3D Suite': 'Endpoints for Lara3D Suite functionalities',
  'Cologne Cave': 'Endpoints related to the Cologne Cave project',
  'Sketchfab Importer': 'Endpoints for importing models from Sketchfab',
  'OIDC Authentication': 'Endpoints for OpenID Connect authentication',
} as const;

const routerTagToTagObject = (tag: keyof typeof RouterTags): OpenAPIV3.TagObject => ({
  name: RouterTags[tag],
  description: RouterTagDescriptions[tag],
});

export const RouterTagsAsTagObjects = Object.keys(RouterTags).map(key =>
  routerTagToTagObject(key as keyof typeof RouterTags),
);
