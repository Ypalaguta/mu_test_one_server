import { readStats } from '../../shared/statFields.js';
import type { ItemRecord, Repository } from '../../shared/contracts.js';

export type ItemSet = {id:number; name:string; pieceIds:number[]; bonuses:{pieces:number; skillId:number}[]};
export function setMembership(itemSets: ItemSet[]) {
 const membership = new Map<number, number>();
 for (const set of itemSets) {
  for (const id of set.pieceIds) {
    if (membership.has(id)) throw Error('Duplicate set piece ' + id);
    membership.set(id, set.id);
  }
  const thresholds = new Set<number>();
  for (const tier of set.bonuses) {
    if (!Number.isInteger(tier.pieces) || tier.pieces < 1 || thresholds.has(tier.pieces) ||
        !Number.isInteger(tier.skillId) || tier.skillId < 1) throw Error('Invalid bonus in set ' + set.id);
    thresholds.add(tier.pieces);
  }
 }
 return membership;
}
export const goldId = 900000;
function withSet(item: ItemRecord, membership: Map<number, number>): ItemRecord {
  return {...item, stats: readStats(item.stats), setId: item.setId || membership.get(item.id) || 0};
}
export async function catalogItems(repo: Repository, sets?: ItemSet[]) {
  const membership = setMembership(sets ?? await repo.itemSets());
  return (await repo.items()).map(item => withSet(item, membership));
}
export async function catalogItem(repo: Repository, id: number) {
  const item = await repo.item(id);
  return item && withSet(item, setMembership(await repo.itemSets()));
}
export function grantedSkills(equipment: {itemId:number}[], items: Map<number, ItemRecord>, itemSets: ItemSet[]) {
  const counts = new Map<number, number>();
  for (const id of new Set(equipment.map(entry => entry.itemId))) {
    const setId = items.get(id)?.setId;
    if (setId) counts.set(setId, (counts.get(setId) ?? 0) + 1);
  }
  const skills = new Set<number>();
  for (const set of itemSets)
    for (const bonus of set.bonuses)
      if ((counts.get(set.id) ?? 0) >= bonus.pieces) skills.add(bonus.skillId);
  return skills;
}
