import {
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
  IEntityResolvedOnlyDigitalEntitySchema,
  IEntityResolvedSchema,
  IPersonResolvedSchema,
  ICompilationResolvedOnlyEntitiesSchema,
  ICompilationResolvedSchema,
  IInstitutionResolvedSchema,
  IDigitalEntityResolvedSchema,
  IPhysicalEntityResolvedSchema,
} from '@kompakkt/common';
import { t } from 'elysia';

/**
 * Union type for all possible collection schemas.
 * Used by routes which catch-all collection types.
 * Unfortunately some validations fail if the resolved schemas are after the non-resolved ones, so the resolved schemas are placed before the non-resolved ones in the union.
 *
 * TODO: Refactor the server to not have any catch-all routes, and instead have specific routes for each collection type. This would allow us to remove this union type and the associated complexity.
 * Alternatively, maybe we can do some "additionalProperties"-shenanigans on the non-resolved schemas to not automatically omit properties of the resolved schemas?
 */
/**
 * Elysia forces `additionalProperties: false` onto union members and falls back to
 * cleaning the body against the first union member when validation fails. Without
 * declaring `profileId` on every member, a push body carrying it (org-profile uploads)
 * fails the union check and gets reduced to `{ _id }` before reaching the handler.
 */
const withProfileId = (schema: Parameters<typeof t.Composite>[0][number]) =>
  t.Composite([schema, t.Object({ profileId: t.Optional(t.String()) })]);

export const AllCollectionsSchemaUnion = t.Union([
  withProfileId(IAddressSchema),
  withProfileId(IAnnotationSchema),
  withProfileId(IContactSchema),
  withProfileId(ITagSchema),

  withProfileId(IEntityResolvedSchema),
  withProfileId(IEntityResolvedOnlyDigitalEntitySchema),
  withProfileId(IEntitySchema),

  withProfileId(IPersonResolvedSchema),
  withProfileId(IPersonSchema),

  withProfileId(ICompilationResolvedOnlyEntitiesSchema),
  withProfileId(ICompilationResolvedSchema),
  withProfileId(ICompilationSchema),

  withProfileId(IInstitutionResolvedSchema),
  withProfileId(IInstitutionSchema),

  withProfileId(IDigitalEntityResolvedSchema),
  withProfileId(IDigitalEntitySchema),

  withProfileId(IPhysicalEntityResolvedSchema),
  withProfileId(IPhysicalEntitySchema),
]);
