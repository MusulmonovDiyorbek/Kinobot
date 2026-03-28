import { Router } from 'express';
import { healthCheck } from '../controllers/healthController.js';

export function createApiRouter() {
  const router = Router();
  router.get('/health', healthCheck);
  return router;
}
