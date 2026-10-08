import { Router } from 'express';
import { createFavoriteController } from '../controllers/favoriteController.js';
import { requireAuth } from '../middleware/session.js';

export function createFavoriteRoutes(db, locationService) {
  const router = Router();
  const controller = createFavoriteController(db, locationService);
  router.use(requireAuth);
  router.get('/', controller.list);
  router.get('/:id', controller.detail);
  router.post('/', controller.save);
  router.put('/:id/refresh', controller.refresh);
  router.delete('/:id', controller.remove);
  return router;
}
