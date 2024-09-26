import { Router } from 'express';
import { ExploreCache } from '../services/cache';
import { Express } from '../services/express';
import { Admin } from '../services/admin';
import { DBClient, Entities, Users, Repo } from '../services/db';

const router = Router();

// Subpath: /api/v1

// These routes are accessible to anyone

// Find a specific entry in the repository and optionally provide a password for access
router.get(
  '/get/find/:collection/:identifier/:password?',
  (req, _, next) => {
    const identifier = req.params.identifier.toString();
    const hash = ExploreCache.hash(`popularity::${identifier}`);
    ExploreCache.incr(hash).then(pop => console.log('Popularity increased to', pop));
    next();
  },
  Entities.getEntityFromCollection,
);

// Find all *public* entries in a specific collection
router.get('/get/findall/:collection', Entities.getAllEntitiesFromCollection);

// Get a new unused ObjectId
router.get('/get/id', DBClient.getUnusedObjectId);

// Returns all matching entries from a collection with a simple text search
router.post('/post/search/:collection', Entities.searchByTextFilter);

// Returns all matching entries that match a given filter-mask
router.post('/post/searchentity/:collection', Entities.searchByEntityFilter);

// Returns pages of the main paginator
router.post('/post/explore', Entities.explore);

// This route is username and password protected by forcing re-authentication
router.post(
  '/post/remove/:collection/:identifier',
  Express.authenticate(),
  Users.validateSession,
  Entities.removeEntityFromCollection,
);

// Only logged-in users with a valid session can access the routes below
router.use(Users.validateSession);

// Get the data of the current logged in user
router.get(['/get/ldata', '/auth'], Users.getCurrentUserData);

// Get a list of all users, reduced to username and fullname
router.get('/get/users', Users.getStrippedUsers);

// Get a list of all groups
router.get('/get/groups', (_, res) => Repo.group.findAll().then(groups => res.json(groups)));

// Add or update a document to a collection
router.post('/post/push/:collection', Users.isAllowedToEdit, Entities.addEntityToCollection);

// Update the settings of a specific entity
router.post('/post/settings/:identifier', Entities.updateEntitySettings);

// Toggle the published state of a specific entity
router.post('/post/publish', Users.isOwnerMiddleware, Admin.toggleEntityPublishedState);

export default router;
