import { Router } from 'express';
import type { Repository } from '../shared/contracts.js';
import { createController } from './controller.js';
export function createRoutes(repo: Repository): Router {
  const r = Router(); const c = createController(repo);
  r.get('/characters/:id/info', c.characterInfo);
  r.get('/characters/:id/stats', c.characterStats);
  r.get('/monsters/:id/info', c.monsterInfo);
  r.get('/monsters/:id/stats', c.monsterStats);
  r.get('/locations/:locationId/monster-spawns', c.monsterSpawns);
  r.get('/items/:id', c.item); r.get('/classes/:id', c.characterClass); r.get('/skills/:id', c.skill);
  return r;
}
