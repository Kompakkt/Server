import { t, type UnwrapSchema } from 'elysia';

export namespace SketchfabSchemas {
  export const LicenseSchema = t.Object({
    fullName: t.String(),
    label: t.String(),
    requirements: t.String(),
    uri: t.String(),
    url: t.Nullable(t.String()),
    slug: t.String(),
  });
  export type License = UnwrapSchema<typeof LicenseSchema>;

  export const ModelSchema = t.Object(
    {
      uid: t.String(),
      isDownloadable: t.Boolean(),
      name: t.String(),
      description: t.String(),
      license: t.Union([
        LicenseSchema,
        t.Intersect([
          t.Omit(LicenseSchema, ['url']),
          t.Object({
            url: t.Nullable(t.String()),
          }),
        ]),
      ]),
      thumbnails: t.Object({
        images: t.Array(
          t.Partial(
            t.Object({
              url: t.String(),
              width: t.Number(),
              height: t.Number(),
            }),
          ),
        ),
      }),
    },
    {
      additionalProperties: true,
    },
  );
  export type Model = UnwrapSchema<typeof ModelSchema>;

  export const MeResponseSchema = t.Object({
    uid: t.String(),
    displayName: t.String(),
    modelsUrl: t.String(),
    modelCount: t.Number(),
  });
  export type MeResponse = UnwrapSchema<typeof MeResponseSchema>;

  export const PartialModelFromModelsResponseSchema = t.Partial(
    t.Pick(ModelSchema, ['uid', 'name', 'description', 'license', 'thumbnails', 'isDownloadable']),
  );
  export type PartialModelFromModelsResponse = UnwrapSchema<
    typeof PartialModelFromModelsResponseSchema
  >;

  export const ModelsResponseSchema = t.Object({
    results: t.Array(PartialModelFromModelsResponseSchema),
  });
  export type ModelsResponse = UnwrapSchema<typeof ModelsResponseSchema>;

  export const DownloadResponseSchema = t.Object({
    glb: t.Optional(
      t.Object({
        url: t.String(),
        size: t.Number(),
        expires: t.Number(),
      }),
    ),
  });
  export type DownloadResponse = UnwrapSchema<typeof DownloadResponseSchema>;
}
