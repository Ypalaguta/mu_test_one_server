import type { EquipmentSlot } from './types.js';
import { equipmentSlots } from './types.js';
import type { ItemRecord } from '../../shared/contracts.js';

export function fitsEquipment(item: Pick<ItemRecord, 'slot' | 'maxStack'>, target: string): boolean {
  if (item.maxStack !== 1 || !equipmentSlots.includes(target as EquipmentSlot)) return false;
  switch (item.slot) {
    case 'None': return false;
    case 'Accessory': return target === 'Accessory1' || target === 'Accessory2';
    case 'Ring': return target === 'Ring1' || target === 'Ring2';
    case 'Earring': return target === 'Earring1' || target === 'Earring2';
    case 'OneHand': return target === 'MainHand' || target === 'OffHand';
    case 'TwoHands': return target === 'MainHand';
    default: return item.slot === target;
  }
}

export function equipmentError(entries: readonly {slot: string; itemId: number}[], items: ReadonlyMap<number, ItemRecord>): string | null {
  if (entries.length > 17) return 'Too many equipment entries';
  const occupied = new Set<string>();
  let twoHands = false;
  for (const entry of entries) {
    const item = items.get(entry.itemId);
    if (occupied.has(entry.slot) || !item || !fitsEquipment(item, entry.slot)) return 'Invalid equipment slot or item';
    occupied.add(entry.slot);
    twoHands ||= item.slot === 'TwoHands';
  }
  if (twoHands && occupied.has('OffHand')) return 'Two-handed weapon occupies both hands';
  return null;
}
