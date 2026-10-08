import express from 'express';
import { createDatabase } from './database/database.js';
import { createSessionMiddleware } from './middleware/session.js';
import { createLocationService } from './providers/locationProviders.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createLocationRoutes } from './routes/locationRoutes.js';
import { createFavoriteRoutes } from './routes/favoriteRoutes.js';
import { createMapRoutes } from './routes/mapRoutes.js';
import { createMapTileProvider } from './providers/mapTileProvider.js';
import { createReverseGeocodeProvider } from './providers/reverseGeocodeProvider.js';

export function createApp({
  db = createDatabase(),
  locationService = createLocationService(),
  mapTileProvider = createMapTileProvider(),
  reverseGeocodeProvider = createReverseGeocodeProvider(),
  citySearchProvider,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(createSessionMiddleware(db));

  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ data: { status: 'ok', database: 'ok' } });
    } catch {
      res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Banco local indisponível.' } });
    }
  });
  app.use('/api/auth', createAuthRoutes(db));
  app.use('/api/locations', createLocationRoutes(locationService));
  app.use('/api/favorites', createFavoriteRoutes(db, locationService));
  app.use('/api/map', createMapRoutes(mapTileProvider, reverseGeocodeProvider, citySearchProvider));
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } }));

  app.use((error, _req, res, _next) => {
    if (res.headersSent) return;
    if (error?.code === 'INVALID_CEP') {
      return res.status(400).json({ error: { code: error.code, message: error.message } });
    }
    if (error?.code === 'CEP_NOT_FOUND') {
      return res.status(404).json({ error: { code: error.code, message: error.message } });
    }
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'O conteúdo enviado não é um JSON válido.' } });
    }
    console.error('Falha interna na API:', error?.message || 'erro desconhecido');
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a solicitação.' } });
  });
  return app;
}
