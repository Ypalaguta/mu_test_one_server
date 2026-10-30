import { ApiError } from '../../http/errors.js';
import { actionBarItemTypes } from './model.js';
import type { ActionBarItemType, ActionBarSlot } from './model.js';

const allowedTypes = new Set<string>(actionBarItemTypes);

function invalidActionBar(): never {
  throw new ApiError(
    400,
    'INVALID_ACTION_BAR',
    'slots must contain at most 100 unique slots with slotNum 0-99, a positive id and a valid type'
  );
}

export function parseActionBarSlots(body: unknown): ActionBarSlot[] {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !('slots' in body)) {
    return invalidActionBar();
  }

  const slots = (body as { slots?: unknown }).slots;
  if (!Array.isArray(slots) || slots.length > 100) return invalidActionBar();

  const usedSlots = new Set<number>();
  const result: ActionBarSlot[] = [];

  for (const value of slots) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidActionBar();

    const slot = value as Record<string, unknown>;
    const slotNum = slot.slotNum;
    const id = slot.id;
    const type = slot.type;

    if (!Number.isInteger(slotNum) || (slotNum as number) < 0 || (slotNum as number) > 99 ||
        !Number.isInteger(id) || (id as number) < 1 || (id as number) > 2147483647 ||
        typeof type !== 'string' || !allowedTypes.has(type) || usedSlots.has(slotNum as number)) {
      return invalidActionBar();
    }

    usedSlots.add(slotNum as number);
    result.push({
      slotNum: slotNum as number,
      id: id as number,
      type: type as ActionBarItemType
    });
  }

  return result.sort((left, right) => left.slotNum - right.slotNum);
}
