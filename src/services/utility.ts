import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';

import {
  IAnnotation,
  ICompilation,
  IEntity,
  IUserData,
  IStrippedUserData,
  IGroup,
  isAnnotation,
} from '../common/interfaces';

import { Mongo, getCurrentUserBySession, updateOne } from './mongo';

interface IUtility {
  findAllEntityOwnersRequest(req: Request, res: Response): any;
  findAllEntityOwners(entityId: string): Promise<IStrippedUserData[]>;
  countEntityUses(req: Request, res: Response): any;
  addAnnotationsToAnnotationList(req: Request, res: Response): any;
  applyActionToEntityOwner(req: Request, res: Response): any;

  findUserInGroups(req: Request, res: Response): any;
  findUserInCompilations(req: Request, res: Response): any;

  findUserInMetadata(req: Request, res: Response): any;
}

const collectionAsArray = <T extends unknown>(collection: string, query = {}) =>
  Mongo.getEntitiesRepository().collection<T>(collection).find(query).toArray();

const Utility: IUtility = {
  findAllEntityOwnersRequest: async (req, res) => {
    const entityId = req.params.identifier;
    if (!ObjectId.isValid(entityId)) return res.status(400).send('Invalid entity _id ');

    const accounts = await Utility.findAllEntityOwners(entityId);
    return res.status(200).send(accounts);
  },
  findAllEntityOwners: async (entityId: string) => {
    const AccDB = Mongo.getAccountsRepository();
    const users = AccDB.collection<IUserData>('users');
    const accounts = (await users.find({}).toArray())
      .filter(userData => {
        const Entities = JSON.stringify(userData.data.entity);
        return Entities ? Entities.indexOf(entityId) !== -1 : false;
      })
      .map(
        userData =>
          ({
            fullname: userData.fullname,
            username: userData.username,
            _id: userData._id,
          } as IStrippedUserData),
      );
    return accounts;
  },
  countEntityUses: async (req, res) => {
    const entityId = req.params.identifier;
    if (!ObjectId.isValid(entityId)) return res.status(404).send('Invalid entity _id ');

    const user = await getCurrentUserBySession(req.sessionID);

    const isUserOwnerOfCompilation = (comp: ICompilation) =>
      JSON.stringify(user?.data?.compilation)?.includes(comp._id.toString());

    const isCompilationNotPWProtected = (comp: ICompilation) =>
      comp.password === '' || comp.password === false || !comp.password;

    const isValid = (comp: ICompilation) =>
      isUserOwnerOfCompilation(comp) || isCompilationNotPWProtected(comp);

    const includesEntity = (comp: ICompilation) => comp.entities[entityId] !== undefined;

    const compilations = await Promise.all(
      (await collectionAsArray<ICompilation>('compilation'))
        .filter(isValid)
        .filter(includesEntity)
        .map(async comp => {
          for (const id in comp.annotations) {
            const resolved = await Mongo.resolve<IAnnotation>(id, 'annotation');
            if (!isAnnotation(resolved)) {
              delete comp.annotations[id];
              continue;
            }
            comp.annotations[id] = resolved;
          }
          return comp;
        }),
    );
    const occurences = compilations.length;

    return res.status(200).send({ occurences, compilations });
  },
  addAnnotationsToAnnotationList: async (req, res) => {
    const annotations = req.body.annotations as string[] | undefined;
    if (!annotations || !Array.isArray(annotations))
      return res.status(400).send('No annotation array sent');

    const compId = req.params.identifier;
    if (
      !compId ||
      !ObjectId.isValid(compId) ||
      (await Mongo.resolve(compId, 'compilation')) === undefined
    ) {
      return res.status(400).send('Invalid compilation given');
    }

    const ObjDB = Mongo.getEntitiesRepository();
    const CompColl = ObjDB.collection<ICompilation>('compilation');
    const compilation = await CompColl.findOne({ _id: new ObjectId(compId) });
    if (!compilation) return res.status(404).send('Compilation not found');

    const resolvedAnnotations = (
      await Promise.all(
        annotations
          .filter(ann => ObjectId.isValid(ann))
          .map(ann => Mongo.resolve<IAnnotation>(ann, 'annotation')),
      )
    ).filter(ann => ann) as IAnnotation[];
    const validAnnotations = resolvedAnnotations
      .filter(ann => ann !== undefined && ann)
      .map(ann => {
        ann['_id'] = new ObjectId();
        ann['target']['source']['relatedCompilation'] = req.params.identifier;
        ann['lastModificationDate'] = new Date().toISOString();
        return ann;
      });
    const AnnColl = ObjDB.collection<IAnnotation>('annotation');
    const insertResult = await AnnColl.insertMany(validAnnotations);
    if (insertResult.result.ok !== 1) return res.status(500).send('Failed inserting Annotations');

    for (const anno of validAnnotations) {
      if (!isAnnotation(anno)) continue;
      compilation.annotations[anno._id.toString()] = anno;
    }

    const updateResult = await updateOne(
      CompColl,
      { _id: new ObjectId(compId) },
      { $set: { annotations: compilation.annotations } },
    );
    if (updateResult.result.ok !== 1) return res.status(500).send('Failed updating annotations');

    // Add Annotations to LDAP user
    validAnnotations.forEach(ann => Mongo.insertCurrentUserData(req, ann['_id'], 'annotation'));
    return res.status(200).send(await Mongo.resolve<ICompilation>(compId, 'compilation'));
  },
  applyActionToEntityOwner: async (req, res) => {
    const command = req.body.command;
    if (!['add', 'remove'].includes(command))
      return res.status(400).send('Invalid command. Use "add" or "remove"');
    const ownerUsername = req.body.ownerUsername;
    const ownerId = req.body.ownerId;
    if (!ownerId && !ownerUsername) return res.status(400).send('No owner _id or username given');
    if (ownerId && !ownerUsername && !ObjectId.isValid(ownerId))
      return res.status(400).send('Incorrect owner _id given');
    const entityId = req.body.entityId;
    if (
      !entityId ||
      !ObjectId.isValid(entityId) ||
      (await Mongo.resolve<IEntity>(entityId, 'entity')) === undefined
    ) {
      return res.status(400).send('Invalid entity identifier');
    }
    const AccDB = Mongo.getAccountsRepository();
    const users = AccDB.collection<IUserData>('users');
    const findUserQuery = ownerId ? { _id: new ObjectId(ownerId) } : { username: ownerUsername };
    const account = await users.findOne(findUserQuery);
    if (!account) {
      return res.status(400).send('Incorrect owner _id or username given');
    }

    account.data.entity = account.data.entity ? account.data.entity : [];
    account.data.entity = account.data.entity.filter(entity => entity);

    if (command === 'add') {
      if (!(account.data.entity as IEntity[]).find(obj => obj.toString() === entityId.toString())) {
        account.data.entity.push(new ObjectId(entityId));
      }
    } else if (command === 'remove') {
      const entityUses = (await Utility.findAllEntityOwners(entityId)).length;
      if (entityUses === 1) return res.status(403).send('Cannot remove last owner');

      account.data.entity = (account.data.entity as IEntity[]).filter(
        entity => entity.toString() !== entityId.toString(),
      );
    }

    const updateResult = await users.updateOne(findUserQuery, {
      $set: { data: account.data },
    });

    if (updateResult.result.ok !== 1) return res.status(500).send('Failed updating entity array');

    return res.status(200);
  },
  findUserInGroups: async (req, res) => {
    const user = await getCurrentUserBySession(req.sessionID);
    if (!user) return res.status(404).send('Failed getting user by SessionId');
    const groups = await collectionAsArray<IGroup>('group');

    return res
      .status(200)
      .send(
        groups.filter(
          group =>
            JSON.stringify(group.members).includes(`${user._id}`) ||
            JSON.stringify(group.owners).includes(`${user._id}`),
        ),
      );
  },
  findUserInCompilations: async (req, res) => {
    const user = await getCurrentUserBySession(req.sessionID);
    if (!user) return res.status(404).send('Failed getting user by SessionId');
    const compilations = await Promise.all(
      (await collectionAsArray<ICompilation>('compilation'))
        .filter(comp => comp.whitelist.enabled)
        .map(async comp => {
          // Get latest versions of groups
          comp.whitelist.groups = (
            await Promise.all(
              comp.whitelist.groups.map(group => Mongo.resolve<IGroup>(group, 'group')),
            )
          ).filter(group => group) as IGroup[];
          return comp;
        }),
    );

    const filteredCompilations = compilations.filter(
      compilation =>
        JSON.stringify(compilation.whitelist.groups).includes(`${user._id}`) ||
        JSON.stringify(compilation.whitelist.persons).includes(`${user._id}`),
    );

    const resolvedCompilations = (
      await Promise.all(
        filteredCompilations.map(comp => Mongo.resolve<ICompilation>(comp, 'compilation')),
      )
    ).filter(comp => comp) as ICompilation[];

    return res.status(200).send(resolvedCompilations);
  },
  findUserInMetadata: async (req, res) => {
    const user = await getCurrentUserBySession(req.sessionID);
    if (!user) return res.status(404).send('Failed getting user by SessionId');
    const entities = await collectionAsArray<IEntity>('entity');

    const resolvedEntities = (
      await Promise.all(entities.map(entity => Mongo.resolve<IEntity>(entity, 'entity')))
    ).filter(entity => {
      if (!entity) return false;
      const stringified = JSON.stringify(entity.relatedDigitalEntity);
      return stringified.includes(user.fullname) || stringified.includes(user.mail);
    });

    return res.status(200).send(resolvedEntities);
  },
};

export { Utility };
