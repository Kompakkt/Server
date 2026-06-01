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

export const AllCollectionsSchemaUnion = t.Union([
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
]);

export const AllCollectionsArraySchemaUnion = t.Union([
  t.Array(IAddressSchema, {
    title: 'IAddress[]',
  }),
  t.Array(IAnnotationSchema, {
    title: 'IAnnotation[]',
  }),
  t.Array(ICompilationSchema, {
    title: 'ICompilation[]',
  }),
  t.Array(IContactSchema, {
    title: 'IContact[]',
  }),
  t.Array(IDigitalEntitySchema, {
    title: 'IDigitalEntity[]',
  }),
  t.Array(IEntitySchema, {
    title: 'IEntity[]',
  }),
  t.Array(IInstitutionSchema, {
    title: 'IInstitution[]',
  }),
  t.Array(IPersonSchema, {
    title: 'IPerson[]',
  }),
  t.Array(IPhysicalEntitySchema, {
    title: 'IPhysicalEntity[]',
  }),
  t.Array(ITagSchema, {
    title: 'ITag[]',
  }),
  t.Array(IEntityResolvedOnlyDigitalEntitySchema, {
    title: 'IEntity[] with relatedDigitalEntity resolved',
  }),
  t.Array(IEntityResolvedSchema, {
    title: 'IEntity[] fully resolved',
  }),
  t.Array(IPersonResolvedSchema, {
    title: 'IPerson[] fully resolved',
  }),
  t.Array(ICompilationResolvedOnlyEntitiesSchema, {
    title: 'ICompilation[] with entities resolved',
  }),
  t.Array(ICompilationResolvedSchema, {
    title: 'ICompilation[] fully resolved',
  }),
  t.Array(IInstitutionResolvedSchema, {
    title: 'IInstitution[] fully resolved',
  }),
  t.Array(IDigitalEntityResolvedSchema, {
    title: 'IDigitalEntity[] fully resolved',
  }),
  t.Array(IPhysicalEntityResolvedSchema, {
    title: 'IPhysicalEntity[] fully resolved',
  }),
]);
