import type { IAnnotation } from 'src/common';
import type { ServerDocument } from 'src/util/document-with-objectid-type';

type Position = {
  x: number;
  y: number;
  z: number;
};

type Selector = {
  _isDirty: boolean;
  _x: number;
  _y: number;
  _z: number;
};

type OldAnnotation = {
  bodyType: string;
  contentType: string;
  created: Date;
  creator: {
    type: string;
    name: string;
    _id: string;
    homepage?: string;
  };
  generated: Date;
  generator: {
    type: string;
    name: string;
    _id: string;
    homepage?: string;
  };
  lastModificationDate: Date;
  lastModifiedBy: {
    _id: string;
    name: string;
    type: string;
  };
  ranking: number;
  relatedPerspective: {
    cameraType: string;
    position: Position;
    target: Position;
    preview: string;
  };
  selectorNormal: Selector | null;
  selectorPoint: Selector;
  targetCompilation: string;
  targetEntity: string;
  wikibase_id: null | string;
};

const isOldAnnotation = (annotation: unknown): annotation is OldAnnotation => {
  return (
    typeof annotation === 'object' &&
    annotation !== null &&
    'bodyType' in annotation &&
    typeof annotation.bodyType === 'string'
  );
};

export const restoreOriginalAnnotation = (annotation: ServerDocument<IAnnotation>) => {
  if (!isOldAnnotation(annotation)) return annotation;
  return {
    // @ts-expect-error - Intentionally overwriting body and target from old annotation format
    body: {
      type: annotation.bodyType,
      content: {
        title: '',
        description: '',
        type: annotation.contentType,
        relatedPerspective: annotation.relatedPerspective,
      },
    },
    // @ts-expect-error - Intentionally overwriting body and target from old annotation format
    target: {
      selector: {
        referenceNormal: annotation.selectorNormal ?? { x: 0, y: -1, z: 0 },
        referencePoint: annotation.selectorPoint,
      },
      source: {
        relatedEntity: annotation.targetEntity,
        relatedCompilation: annotation.targetCompilation,
      },
    },
    ...annotation,
  };
};
