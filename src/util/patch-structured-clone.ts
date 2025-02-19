import { ObjectId } from 'mongodb';
import { log } from 'src/logger';

const oldStructureClone = global.structuredClone;

const patchedStructureClone = <T = unknown>(
  obj: T,
  options?: Parameters<typeof oldStructureClone>[1],
): T => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const hasId = (obj: object): obj is { _id: string | ObjectId | { buffer: Uint8Array } } => {
    return Object.hasOwn(obj, '_id');
  };

  const cloned = oldStructureClone(obj, options);
  if (Array.isArray(cloned)) {
    return cloned;
  }

  if (!hasId(cloned)) return cloned;

  if (typeof cloned._id === 'string') {
    cloned._id = new ObjectId(cloned._id);
  }

  if (typeof cloned._id === 'object' && 'buffer' in cloned._id) {
    cloned._id = new ObjectId(cloned._id.buffer);
  }

  return cloned;
};

// biome-ignore lint: Any is expected here to overwrite the global variable
(global as any).structuredClone = patchedStructureClone;

log('Patched structured clone to support cloning ObjectId');
