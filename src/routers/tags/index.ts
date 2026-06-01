import type { OpenAPIV3 } from 'openapi-types';

export const RouterTags = {
  'Admin': 'Admin',
  'API V1': 'API V1',
  'API V2': 'API V2',
  'User Management': 'User Management',
  'Mail': 'Mail',
  'Upload': 'Upload',
  'Utility': 'Utility',
  'Monitoring': 'Monitoring',
  'Profile': 'Profile',
} as const;

export const RouterTagDescriptions: Record<keyof typeof RouterTags, string> = {
  'Admin': 'Endpoints for administrative tasks',
  'API V1': 'Legacy API endpoints (v1)',
  'API V2': 'Current API endpoints (v2)',
  'User Management': 'Endpoints for managing user accounts and profiles',
  'Mail': 'Endpoints for sending and managing emails',
  'Upload': 'Endpoints for handling file uploads and retrieving uploaded files',
  'Utility': 'Utility endpoints for various helper functions',
  'Monitoring': 'Endpoints for monitoring system health and performance',
  'Profile': 'Endpoints related to public user & institution profiles',
} as const;

const routerTagToTagObject = (tag: keyof typeof RouterTags): OpenAPIV3.TagObject => ({
  name: RouterTags[tag],
  description: RouterTagDescriptions[tag],
});

export const RouterTagsAsTagObjects = Object.keys(RouterTags).map(key =>
  routerTagToTagObject(key as keyof typeof RouterTags),
);
