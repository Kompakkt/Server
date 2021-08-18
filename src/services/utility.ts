// prettier-ignore
import { IAnnotation, ICompilation, IEntity, isAnnotation, IUserData } from '../common';
// prettier-ignore
import { Entities, Repo, Users, Accounts, query, queryIn, stripUserData, isValidId, lockCompilation } from './db';
import { Request, Response } from 'express';
import { ObjectId, Filter } from 'mongodb';

interface IIdentifierParam {
  identifier?: string;
}

interface IAnnotationListBody {
  annotations?: string[];
}

interface IPromoteBody {
  command?: string;
  ownerUsername?: string;
  entityId?: string;
}

// Query helpers
// TODO: This can be cached without trouble
const userInWhitelistQuery = async (user: IUserData) => {
  // Get groups containing the user
  const groups = await Repo.group.find(userInGroupQuery(user));

  // Build query for whitelist containing the user in persons or in groups
  const query: Filter<ICompilation> = {
    'whitelist.enabled': { $eq: true },
    '$or': [{ 'whitelist.persons': { $elemMatch: { _id: queryIn(user._id) } } }],
  };
  if (groups && groups.length > 0) {
    const groupQuery = { $elemMatch: { _id: { $in: groups.flatMap(g => queryIn(g._id).$in) } } };
    query.$or!.push({ 'whitelist.groups': groupQuery });
  }

  return query;
};

const userInGroupQuery = (user: IUserData) => {
  const _idQuery = queryIn(user._id);
  return {
    $or: [
      { 'creator._id': _idQuery },
      { members: { $elemMatch: { _id: _idQuery } } },
      { owners: { $elemMatch: { _id: _idQuery } } },
    ],
  };
};

const findEntityOwnersQuery = async (_id: string | ObjectId) => {
  const accounts = (await Accounts.users.find({ 'data.entity': queryIn(_id) })) ?? [];
  return accounts.map(stripUserData);
};

const findAllEntityOwnersRequest = async (req: Request<IIdentifierParam>, res: Response) => {
  const _id = req.params.identifier;
  if (!isValidId(_id)) return res.status(400).send('Invalid entity _id ');
  return res.status(200).send(await findEntityOwnersQuery(_id));
};

const countEntityUses = async (req: Request<IIdentifierParam>, res: Response) => {
  const _id = req.params.identifier;
  if (!isValidId(_id)) return res.status(400).send('Invalid entity _id ');

  const user = await Users.getBySession(req);

  // Build query for:
  // (Not password protected || user is creator || user is whitelisted) && has entity
  const filter: Filter<ICompilation> = { $or: [{ password: { $eq: '' } }] };
  if (user) {
    filter.$or!.push({ 'creator._id': queryIn(user._id) });
    filter.$or!.push(await userInWhitelistQuery(user));
  }
  filter[`entities.${_id}`] = { $exists: true };

  const result = (await Repo.compilation.find(filter)) ?? [];
  const compilations = result.map(lockCompilation);
  const occurences = compilations.length;

  return res.status(200).send({ occurences, compilations });
};

const addAnnotationsToAnnotationList = async (
  req: Request<IIdentifierParam, any, IAnnotationListBody>,
  res: Response,
) => {
  const list = req.body.annotations;
  if (!list || !Array.isArray(list)) return res.status(400).send('No annotation array sent');

  const _id = req.params.identifier;
  if (!isValidId(_id)) return res.status(400).send('Invalid compilation _id ');

  const compilation = await Repo.compilation.findOne(query(_id));
  if (!compilation) return res.status(404).send('Compilation not found');

  const resolvedList = await Promise.all(list.map(a => Entities.resolve(a, 'annotation')));
  const filteredList = resolvedList.filter(_ => _) as IAnnotation[];
  const correctedList = filteredList.map(ann => {
    ann._id = new ObjectId();
    ann.target.source.relatedCompilation = _id;
    ann.lastModificationDate = new Date().toISOString();
    return ann;
  });

  const insertResult = await Repo.annotation.insertMany(correctedList);
  if (!insertResult) return res.status(500).send('Failed inserting Annotations');

  for (const anno of correctedList) {
    if (!isAnnotation(anno)) continue;
    compilation.annotations[anno._id.toString()] = anno;
  }

  const updateResult = await Repo.compilation.updateOne(query(_id), {
    $set: { annotations: compilation.annotations },
  });
  if (!updateResult) return res.status(500).send('Failed updating annotations');

  // Add Annotations to LDAP user
  correctedList.forEach(ann => Users.makeOwnerOf(req, ann._id, 'annotation'));
  return res.status(200).send(await Entities.resolve<ICompilation>(_id, 'compilation'));
};

const applyActionToEntityOwner = async (req: Request<any, any, IPromoteBody>, res: Response) => {
  const { entityId: _id, command, ownerUsername: username } = req.body;

  if (!isValidId(_id) || (await Repo.entity.findOne(query(_id))) === undefined)
    return res.status(400).send('Invalid entity identifier');

  if (!(await Users.isOwner(req, _id)))
    return res.status(400).send('User sending the request is not owner of the object');

  if (command !== 'add' && command !== 'remove')
    return res.status(400).send('Invalid command. Use "add" or "remove"');

  if (!username) return res.status(400).send('No user given');

  const user = await Users.getByUsername(username);
  if (!user) return res.status(400).send('User not found by username');

  user.data.entity = user.data.entity?.filter(_ => _) ?? [];

  let changed: undefined | boolean = undefined;
  if (command === 'add') {
    changed = await Users.makeOwnerOf(user, _id, 'entity');
  } else if (command === 'remove') {
    const entityUses = (await findEntityOwnersQuery(_id)).length;
    if (entityUses <= 1) return res.status(403).send('Cannot remove last owner');
    changed = await Users.undoOwnerOf(user, _id, 'entity');
  }

  return res.status(200).send({ changed });
};

const findUserInGroups = async (req: Request, res: Response) => {
  const user = await Users.getBySession(req);
  if (!user) return res.status(404).send('Failed getting user by SessionId');

  const groups = await Repo.group.find(userInGroupQuery(user));

  return res.status(200).send(groups);
};

const findUserInCompilations = async (req: Request, res: Response) => {
  const user = await Users.getBySession(req);
  if (!user) return res.status(404).send('Failed getting user by SessionId');

  // Only show compilations where the user is in the whitelist
  const filter = await userInWhitelistQuery(user);
  const compilations = await Repo.compilation.find(filter);
  if (!compilations) return res.status(200).send([]);

  const resolved = await Promise.all(
    compilations.map(comp => Entities.resolve<ICompilation>(comp, 'compilation')),
  );
  const filtered = resolved.filter(_ => _) as ICompilation[];

  return res.status(200).send(filtered.map(lockCompilation));
};

const findUserInMetadata = async (req: Request, res: Response) => {
  const user = await Users.getBySession(req);
  if (!user) return res.status(404).send('Failed getting user by SessionId');
  const entities = await Repo.entity.findAll();

  const resolvedEntities = (
    await Promise.all(entities.map(e => Entities.resolve<IEntity>(e, 'entity')))
  ).filter(entity => {
    if (!entity) return false;
    const stringified = JSON.stringify(entity.relatedDigitalEntity);
    return stringified.includes(user.fullname) || stringified.includes(user.mail);
  });

  return res.status(200).send(resolvedEntities);
};

const Utility = {
  findAllEntityOwnersRequest,
  findEntityOwnersQuery,
  countEntityUses,
  addAnnotationsToAnnotationList,
  applyActionToEntityOwner,
  findUserInGroups,
  findUserInCompilations,
  findUserInMetadata,
};

export { Utility };
