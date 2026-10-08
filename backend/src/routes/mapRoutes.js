import { Router } from 'express';
import { createMapController } from '../controllers/mapController.js';
import { requireAuth } from '../middleware/session.js';

export function createMapRoutes(mapTileProvider, reverseGeocodeProvider, citySearchProvider) {
  const router = Router();
  const controller = createMapController(mapTileProvider, reverseGeocodeProvider, citySearchProvider);
  router.get('/tiles/:z/:x/:y.png', requireAuth, controller.tile);
  router.post('/reverse', requireAuth, controller.reverse);
  router.post('/city-centers', requireAuth, controller.cityCenters);
  return router;
}
