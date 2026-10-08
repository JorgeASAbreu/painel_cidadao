import { Router } from 'express';
import { createAuthController } from '../controllers/authController.js';

export function createAuthRoutes(db) {
  const router = Router();
  const controller = createAuthController(db);
  router.post('/register', controller.register);
  router.post('/login', controller.login);
  router.get('/me', controller.me);
  router.post('/logout', controller.logout);
  return router;
}
