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
export const AllCollectionsSchemaUnion = t.Union([
  IAddressSchema,
  IAnnotationSchema,
  IContactSchema,
  ITagSchema,

  IEntityResolvedSchema,
  IEntityResolvedOnlyDigitalEntitySchema,
  IEntitySchema,

  IPersonResolvedSchema,
  IPersonSchema,

  ICompilationResolvedOnlyEntitiesSchema,
  ICompilationResolvedSchema,
  ICompilationSchema,

  IInstitutionResolvedSchema,
  IInstitutionSchema,

  IDigitalEntityResolvedSchema,
  IDigitalEntitySchema,

  IPhysicalEntityResolvedSchema,
  IPhysicalEntitySchema,
]);
