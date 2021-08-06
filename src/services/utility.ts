// prettier-ignore
import { IAnnotation, ICompilation, IEntity, IStrippedUserData, IGroup, isAnnotation } from '../common/interfaces';
import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { Entities, Repo, Users, Accounts, query } from './db';

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

const Utility: IUtility = {
  findAllEntityOwnersRequest: async (req, res) => {
    const entityId = req.params.identifier;
    if (!ObjectId.isValid(entityId)) return res.status(400).send('Invalid entity _id ');

    const accounts = await Utility.findAllEntityOwners(entityId);
    return res.status(200).send(accounts);
  },
  findAllEntityOwners: async (entityId: string) => {
    const accounts = (await Accounts.users.findAll())
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

    const user = await Users.getBySession(req);

    const isUserOwnerOfCompilation = (comp: ICompilation) =>
      JSON.stringify(user?.data?.compilation)?.includes(comp._id.toString());

    const isCompilationNotPWProtected = (comp: ICompilation) =>
      comp.password === '' || comp.password === false || !comp.password;

    const isValid = (comp: ICompilation) =>
      isUserOwnerOfCompilation(comp) || isCompilationNotPWProtected(comp);

    const includesEntity = (comp: ICompilation) => comp.entities[entityId] !== undefined;

    const compilations = await Promise.all(
      (
        await Repo.compilation.findAll()
      )
        .filter(isValid)
        .filter(includesEntity)
        .map(async comp => {
          for (const id in comp.annotations) {
            const resolved = await Entities.resolve<IAnnotation>(id, 'annotation');
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
      (await Entities.resolve(compId, 'compilation')) === undefined
    ) {
      return res.status(400).send('Invalid compilation given');
    }

    const compilation = await Repo.compilation.findOne(query(compId));
    if (!compilation) return res.status(404).send('Compilation not found');

    const resolvedAnnotations = (
      await Promise.all(
        annotations
          .filter(ann => ObjectId.isValid(ann))
          .map(ann => Entities.resolve<IAnnotation>(ann, 'annotation')),
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

    const insertResult = await Repo.annotation.insertMany(validAnnotations);
    if (!insertResult) return res.status(500).send('Failed inserting Annotations');

    for (const anno of validAnnotations) {
      if (!isAnnotation(anno)) continue;
      compilation.annotations[anno._id.toString()] = anno;
    }

    const updateResult = await Repo.compilation.updateOne(query(compId), {
      $set: { annotations: compilation.annotations },
    });
    if (!updateResult) return res.status(500).send('Failed updating annotations');

    // Add Annotations to LDAP user
    validAnnotations.forEach(ann => Users.makeOwnerOf(req, ann._id, 'annotation'));
    return res.status(200).send(await Entities.resolve<ICompilation>(compId, 'compilation'));
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
      (await Entities.resolve<IEntity>(entityId, 'entity')) === undefined
    ) {
      return res.status(400).send('Invalid entity identifier');
    }

    const findUserQuery = ownerId ? query(ownerId) : { username: ownerUsername };
    const user = await Accounts.users.findOne(findUserQuery);
    if (!user) return res.status(400).send('Incorrect owner _id or username given');

    user.data.entity = user.data.entity ?? [];
    user.data.entity = user.data.entity.filter((_: any) => _);

    if (command === 'add') {
      if (!(user.data.entity as IEntity[]).find(obj => obj.toString() === entityId.toString())) {
        user.data.entity.push(new ObjectId(entityId));
      }
    } else if (command === 'remove') {
      const entityUses = (await Utility.findAllEntityOwners(entityId)).length;
      if (entityUses === 1) return res.status(403).send('Cannot remove last owner');

      user.data.entity = (user.data.entity as IEntity[]).filter(
        entity => entity.toString() !== entityId.toString(),
      );
    }

    const updateResult = await Accounts.users.updateOne(findUserQuery, {
      $set: { data: user.data },
    });

    if (!updateResult) return res.status(500).send('Failed updating entity array');

    return res.status(200);
  },
  findUserInGroups: async (req, res) => {
    const user = await Users.getBySession(req);
    if (!user) return res.status(404).send('Failed getting user by SessionId');
    const groups = await Repo.group.findAll();

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
    const user = await Users.getBySession(req);
    if (!user) return res.status(404).send('Failed getting user by SessionId');
    const compilations = await Promise.all(
      (
        await Repo.compilation.findAll()
      )
        .filter(comp => comp.whitelist.enabled)
        .map(async comp => {
          // Get latest versions of groups
          comp.whitelist.groups = (
            await Promise.all(
              comp.whitelist.groups.map(group => Entities.resolve<IGroup>(group, 'group')),
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
        filteredCompilations.map(comp => Entities.resolve<ICompilation>(comp, 'compilation')),
      )
    ).filter(comp => comp) as ICompilation[];

    return res.status(200).send(resolvedCompilations);
  },
  findUserInMetadata: async (req, res) => {
    const user = await Users.getBySession(req);
    if (!user) return res.status(404).send('Failed getting user by SessionId');
    const entities = await Repo.entity.findAll();

    const resolvedEntities = (
      await Promise.all(entities.map(entity => Entities.resolve<IEntity>(entity, 'entity')))
    ).filter(entity => {
      if (!entity) return false;
      const stringified = JSON.stringify(entity.relatedDigitalEntity);
      return stringified.includes(user.fullname) || stringified.includes(user.mail);
    });

    return res.status(200).send(resolvedEntities);
  },
};

export { Utility };
