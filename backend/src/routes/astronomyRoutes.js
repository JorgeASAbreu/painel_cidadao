import { Router } from 'express';
import { createAstronomyController } from '../controllers/astronomyController.js';
import { requireAuth } from '../middleware/session.js';

export function createAstronomyRoutes(observabilityProvider) {
  const router = Router();
  router.post('/observability', requireAuth, createAstronomyController(observabilityProvider).observability);
  return router;
}
