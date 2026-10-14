import { skillSchema } from './model.js';
import type { SkillRecord } from '../../shared/contracts.js';
export function skillResponse(d: SkillRecord) {
  return { ...Object.fromEntries(Object.keys(skillSchema.paths).filter(k => k !== '_id').map(k => [k, (d as unknown as Record<string,unknown>)[k]])), icon: null };
}
export function validateSkillGraph(skills: SkillRecord[]) {
  const byId = new Map(skills.map(s => [s.id, s]));
  const next = new Map<number, number>();
  const roots = new Set<number>();
  for (const s of skills) {
    if (s.modifierOfSkill) {
      if (s.familyId || s.prev || s.replaces.length || !skills.some(v => !v.modifierOfSkill && v.familyId === s.modifierOfSkill)) throw new Error(`Invalid modifier ${s.id}`);
    } else {
      if (!s.familyId) throw new Error(`Missing family ${s.id}`);
      if (s.prev) {
        const p = byId.get(s.prev);
        if (!p || p.modifierOfSkill || p.familyId !== s.familyId || next.has(s.prev)) throw new Error(`Invalid prev ${s.id}`);
        next.set(s.prev, s.id);
      } else {
        if (roots.has(s.familyId)) throw new Error(`Multiple roots in family ${s.familyId}`);
        roots.add(s.familyId);
      }
    }
    for (const c of [...s.requirements, ...s.cost]) if (c.type === 'Skill' && !byId.has(c.id)) throw new Error(`Unknown required skill ${c.id}`);
  }
  const done = new Set<number>(); const active = new Set<number>();
  const visit = (id: number) => {
    if (active.has(id)) throw new Error(`Skill dependency cycle ${id}`);
    if (done.has(id)) return;
    const s = byId.get(id); if (!s) throw new Error(`Unknown replacement ${id}`);
    active.add(id);
    if (s.prev) visit(s.prev);
    const families = new Set<number>();
    for (const rid of s.replaces) {
      const r = byId.get(rid);
      if (!r || r.modifierOfSkill || r.familyId === s.familyId || next.has(rid) || families.has(r.familyId)) throw new Error(`Replacement must be terminal rank of distinct family: ${s.id}/${rid}`);
      families.add(r.familyId); visit(rid);
    }
    active.delete(id); done.add(id);
  };
  for (const s of skills) visit(s.id);
}
