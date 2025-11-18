import {
  Collection,
  type IAddress,
  type IAnnotation,
  type ICompilation,
  type IContact,
  type IDigitalEntity,
  type IDocument,
  type IEntity,
  type IGroup,
  type IInstitution,
  type IPerson,
  type IPhysicalEntity,
  type ITag,
  type IUserData,
} from 'src/common';
import { info } from 'src/logger';
import type { ServerDocument } from 'src/util/document-with-objectid-type';

export type HookFn<T extends ServerDocument<IDocument>> = (
  doc: T,
  userdata?: ServerDocument<IUserData>,
) => Promise<T>;
export type HookType = 'onTransform' | 'onResolve' | 'onDelete' | 'afterSave';

const createHookGroup = <T extends ServerDocument<IDocument>>(): Record<
  HookType,
  Array<HookFn<T>>
> => {
  const hooks = {
    onTransform: [],
    onResolve: [],
    onDelete: [],
    afterSave: [],
  };
  return hooks;
};

export const HookManager = new (class {
  public readonly hooks = {
    [Collection.address]: createHookGroup<ServerDocument<IAddress>>(),
    [Collection.annotation]: createHookGroup<ServerDocument<IAnnotation>>(),
    [Collection.compilation]: createHookGroup<ServerDocument<ICompilation>>(),
    [Collection.contact]: createHookGroup<ServerDocument<IContact>>(),
    [Collection.digitalentity]: createHookGroup<ServerDocument<IDigitalEntity>>(),
    [Collection.entity]: createHookGroup<ServerDocument<IEntity>>(),
    [Collection.group]: createHookGroup<ServerDocument<IGroup>>(),
    [Collection.institution]: createHookGroup<ServerDocument<IInstitution>>(),
    [Collection.person]: createHookGroup<ServerDocument<IPerson>>(),
    [Collection.physicalentity]: createHookGroup<ServerDocument<IPhysicalEntity>>(),
    [Collection.tag]: createHookGroup<ServerDocument<ITag>>(),
  };

  public addHook<T extends ServerDocument<IDocument>>(hook: {
    collection: Collection;
    callback: HookFn<T>;
    type: HookType;
  }) {
    (this.hooks[hook.collection][hook.type] as unknown as Array<HookFn<T>>).push(hook.callback);
  }

  public async runHooks<T extends ServerDocument<IDocument>>(
    collection: Collection,
    type: HookType,
    doc: T,
    userdata?: ServerDocument<IUserData>,
  ): Promise<T> {
    const hooks = this.hooks[collection][type] as unknown as Array<HookFn<T>>;

    let currentDoc = doc;

    for (const hook of hooks) {
      try {
        currentDoc = await hook(structuredClone(currentDoc), userdata);
      } catch (error) {
        info('Failed to run hook', error);
      }
    }

    return currentDoc;
  }
})();
