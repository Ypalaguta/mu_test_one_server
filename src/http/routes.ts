import { login, register, authenticate, ownCharacter } from '../modules/accounts/service.js';
import { addItem } from '../modules/accounts/admin.js';
import { catalogItems } from '../modules/items/catalog.js';
import { tokenHash } from '../modules/accounts/password.js';
import { ApiError } from './errors.js';
import { gameServerOnly, snapshot, saveSnapshot } from '../modules/progression/service.js';
import { parseId } from './errors.js';
import { Router } from 'express';
import type { Repository } from '../shared/contracts.js';
import { createController } from './controller.js';
export function createRoutes(repo: Repository): Router {
  const r = Router(); const c = createController(repo);
  // Credentials are relayed by UE's owned PlayerController; Node trusts only the game server.
  r.use('/auth', gameServerOnly);
  const attempts = new Map<string,{start:number,count:number}>();
  r.use('/auth', (req,_res,next)=>{
    if(req.path!=='/login' && req.path!=='/register')return next();
    const key=req.ip??'local';const now=Date.now();
    for(const [k,v] of attempts)if(now-v.start>60000)attempts.delete(k);
    const a=attempts.get(key)??{start:now,count:0};a.count++;attempts.set(key,a);
    if(a.count>30)return next(new ApiError(429,'RATE_LIMIT','Too many authentication attempts'));next();
  });
  r.post('/auth/register', async(req,res)=>{res.json(await register(repo,req.body));});
  r.post('/auth/login', async(req,res)=>{res.json(await login(repo,req.body));});
  r.post('/auth/session', async(req,res)=>{const a=await authenticate(repo,req.get('X-Account-Session'));res.json({id:a.id,role:a.role});});
  r.post('/auth/logout', async(req,res)=>{
    const token=req.get('X-Account-Session');await authenticate(repo,token);
    if(repo.deleteSession)await repo.deleteSession(tokenHash(token!));res.json({success:true});
  });
  r.use('/admin', gameServerOnly);
  r.put('/admin/characters/:id/items',async(req,res)=>{res.json(await addItem(repo,req.get('X-Account-Session'),parseId(req.params.id),req.body));});
  r.use('/admin',(_req,res)=>{res.status(501).json({error:'NOT_IMPLEMENTED',message:'Not implemented'});});
  r.use('/characters', gameServerOnly);
  r.use('/characters/:id',async(req,_res,next)=>{await ownCharacter(repo,req.get('X-Account-Session'),parseId(req.params.id));next();});
  r.get('/characters/:id/state', async (req, res) => { res.json(await snapshot(repo, parseId(req.params.id))); });
  r.put('/characters/:id/state', async (req, res) => { res.json(await saveSnapshot(repo, parseId(req.params.id), req.body)); });
  r.get('/items', async (_req, res) => { res.json((await catalogItems(repo)).map(({_id, ...d}: any) => d)); });
  r.get('/item-sets', async (_req, res) => {
    const itemSets = await repo.itemSets();
    const items = await catalogItems(repo, itemSets);
    res.json(itemSets.map(set => ({...set, pieceIds: items.filter(item => item.setId === set.id).map(item => item.id)})));
  });
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
