import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { Character } from '../characters/model.js';
import type { CharacterRecord, Repository } from '../../shared/contracts.js';
import { ApiError, found } from '../../http/errors.js';

export const gameServerOnly: RequestHandler = (req, _res, next) => {
  const token = process.env.GAME_SERVER_TOKEN;
  if (!token) return next(new ApiError(503, 'SERVER_TOKEN_MISSING', 'Configure GAME_SERVER_TOKEN'));
  const provided = req.get('X-Game-Server-Token') ?? '';
  const a = Buffer.from(token); const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return next(new ApiError(403, 'GAME_SERVER_ONLY', 'Trusted game server required'));
  next();
};
export async function snapshot(repo: Repository, id: number) {
  const d = found(await repo.character(id));
  const cls = found(await repo.characterClass(d.info.classId));
  return { id: d.id, revision: d.revision, info: d.info, progress: d.progress, actionBarSlots: d.actionBarSlots, baseStats: cls.baseStats, growthStats: cls.growthStats };
}
export async function validateState(repo: Repository, state: CharacterRecord) {
  const fail = (message: string): never => { throw new ApiError(400, 'INVALID_STATE', message); };
  const p = state.progress;
  const items = new Map((await repo.items()).map(v => [v.id, v]));
  const skills = new Map((await repo.skills()).map(v => [v.id, v]));
  const families = new Set([...skills.values()].filter(v => !v.modifierOfSkill).map(v => v.familyId));
  const slots = new Set<number>();
  for (const entry of p.inventory) {
    if (slots.has(entry.slot) || entry.slot >= p.inventoryCapacity) fail('Invalid inventory slot');
    slots.add(entry.slot);
    const item = items.get(entry.itemId);
    if (!item || entry.quantity > item.maxStack) fail('Unknown item or stack overflow');
  }
  if (p.accessible.some(f => !families.has(f))) fail('Unknown accessible family');
  const learnedFamilies = new Set<number>(); const suppressed = new Set<number>();
  const seen = new Set<number>();
  const visit = (id: number) => {
    if (seen.has(id)) return; seen.add(id);
    const s = skills.get(id); if (!s) return;
    if (s.prev) visit(s.prev);
    for (const rid of s.replaces) { const r = skills.get(rid); if (r) suppressed.add(r.familyId); visit(rid); }
  };
  for (const id of p.learned) {
    const s = skills.get(id);
    if (!s || s.modifierOfSkill || learnedFamilies.has(s.familyId)) fail('Invalid learned skills');
    learnedFamilies.add(s!.familyId); visit(id);
  }
  if ([...learnedFamilies].some(f => suppressed.has(f))) fail('Replaced families must not stay learned');
  const selected = new Set<number>();
  for (const m of p.selectedModifiers) {
    if (selected.has(m.familyId) || !learnedFamilies.has(m.familyId) || skills.get(m.skillId)?.modifierOfSkill !== m.familyId) fail('Invalid selected modifier');
    selected.add(m.familyId);
  }
  for (const slot of state.actionBarSlots) {
    if (slot.type === 'Skill' && !p.learned.includes(slot.id)) fail('Action bar references an unlearned skill');
    if (slot.type === 'Item' && !items.has(slot.id)) fail('Unknown action bar item');
  }
}
export async function saveSnapshot(repo: Repository, id: number, raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ApiError(400,'INVALID_STATE','Expected object');
  const body = raw as Record<string, unknown>;
  if (!Number.isInteger(body.expectedRevision) || Number(body.expectedRevision) < 0 || Number(body.expectedRevision) >= 2147483647) throw new ApiError(400,'INVALID_REVISION','Invalid revision');
  if (!body.info || !body.progress || !Array.isArray(body.actionBarSlots) || Object.keys(body).some(k => !['expectedRevision','info','progress','actionBarSlots'].includes(k))) throw new ApiError(400,'INVALID_STATE','Expected complete state');
  const requiredInfo=['level','experience','classId','skillPoints','gold','reputation','characterName','characterTitle','staff','clan','alliance','race','faction'];
  const requiredProgress=['inventoryCapacity','inventory','achievements','accessible','learned','selectedModifiers'];
  for(const [value,keys] of [[body.info,requiredInfo],[body.progress,requiredProgress]] as const) {
    if(typeof value!=='object'||value===null||Array.isArray(value)||keys.some(k=>!(k in value))) throw new ApiError(400,'INVALID_STATE','Snapshot fields must not be omitted');
  }
  let normalized: CharacterRecord;
  try {
    const doc = new Character({ id, revision: body.expectedRevision, info: body.info, progress: body.progress, actionBarSlots: body.actionBarSlots });
    await doc.validate(); normalized = doc.toObject();
  } catch { throw new ApiError(400,'INVALID_STATE','Invalid character fields'); }
  await validateState(repo, normalized);
  // Resolve class before mutation. A failed validation never writes a partial result.
  const cls = found(await repo.characterClass(normalized.info.classId));
  const saved = await repo.saveState(id, Number(body.expectedRevision), normalized);
  if (!saved) throw new ApiError(409,'STATE_CONFLICT','Reload character before retrying');
  return { id, revision: saved.revision, info: saved.info, progress: saved.progress, actionBarSlots: saved.actionBarSlots, baseStats: cls.baseStats, growthStats: cls.growthStats };
}
