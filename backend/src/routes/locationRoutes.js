import { Router } from 'express';
import { createLocationController } from '../controllers/locationController.js';
import { requireAuth } from '../middleware/session.js';

export function createLocationRoutes(locationService) {
  const router = Router();
  router.get('/cep/:cep', requireAuth, createLocationController(locationService).byCep);
  return router;
}
