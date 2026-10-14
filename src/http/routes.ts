import { gameServerOnly, snapshot, saveSnapshot } from '../modules/progression/service.js';
import { parseId } from './errors.js';
import { Router } from 'express';
import type { Repository } from '../shared/contracts.js';
import { createController } from './controller.js';
export function createRoutes(repo: Repository): Router {
  const r = Router(); const c = createController(repo);
  r.use('/characters', gameServerOnly);
  r.get('/characters/:id/state', async (req, res) => { res.json(await snapshot(repo, parseId(req.params.id))); });
  r.put('/characters/:id/state', async (req, res) => { res.json(await saveSnapshot(repo, parseId(req.params.id), req.body)); });
  r.get('/items', async (_req, res) => { res.json((await repo.items()).map(({_id, ...d}: any) => d)); });
  r.get('/characters/:id/info', c.characterInfo);
  r.get('/characters/:id/stats', c.characterStats);
  r.get('/characters/:id/action-bar', c.characterActionBar);
  r.put('/characters/:id/action-bar', (_req, res) => { res.status(410).json({ error: 'USE_CHARACTER_STATE' }); });
  r.get('/monsters/:id/info', c.monsterInfo);
  r.get('/monsters/:id/stats', c.monsterStats);
  r.get('/locations/:locationId/monster-spawns', c.monsterSpawns);
  r.get('/skills', c.skills);
  r.get('/items/:id', c.item); r.get('/classes/:id', c.characterClass); r.get('/skills/:id', c.skill);
  return r;
}
