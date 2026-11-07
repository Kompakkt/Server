import { ObjectId } from 'mongodb';
import { log } from 'src/logger';

const oldStructureClone = global.structuredClone;

// structuredClone flattens class instances into plain objects, which strips
// ObjectIds of their methods (toString becomes Object.prototype.toString, so
// _id serializes as "[object Object]"). Re-attach the original, immutable
// ObjectId instances at their positions in the clone instead of trying to
// rebuild them from the clone's internal representation, which changes
// between bson versions (buffer in <=7.1.x, i0..i3 in >=7.3.x).
// Requires a single bson module instance for `instanceof` to recognize them.
const restoreObjectIds = (original: unknown, cloned: unknown): void => {
  if (original === null || typeof original !== 'object' || original instanceof ObjectId) return;
  if (cloned === null || typeof cloned !== 'object') return;

  for (const key of Object.keys(original)) {
    if (!Object.hasOwn(cloned, key)) continue;
    const originalValue = (original as Record<string, unknown>)[key];
    if (originalValue instanceof ObjectId) {
      (cloned as Record<string, unknown>)[key] = originalValue;
    } else {
      restoreObjectIds(originalValue, (cloned as Record<string, unknown>)[key]);
    }
  }
};

const patchedStructureClone = <T = unknown>(
  obj: T,
  options?: Parameters<typeof oldStructureClone>[1],
): T => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const cloned = oldStructureClone(obj, options);

  if (cloned !== null && typeof cloned === 'object' && !Array.isArray(cloned)) {
    Object.keys(obj as Record<string, unknown>).forEach(key => {
      const isObjectId = (obj as Record<string, unknown>)[key] instanceof ObjectId;
      if (isObjectId)
        (cloned as Record<string, unknown>)[key] = (obj as Record<string, unknown>)[key];
      else restoreObjectIds((obj as Record<string, unknown>)[key], (cloned as Record<string, unknown>)[key]);
    });

    const id = (cloned as { _id?: unknown })._id;
    if (typeof id === 'string') {
      (cloned as { _id?: unknown })._id = new ObjectId(id);
    }
  }

  return cloned;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).structuredClone = patchedStructureClone;

log('Patched structured clone to support cloning ObjectId');
