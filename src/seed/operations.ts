import type { SeedData } from './data.js';
export interface SeedOperation {
  collection: string;
  filter: Record<string, number | string>;
  update: { $set?: Record<string, unknown>; $setOnInsert?: Record<string, unknown>; $unset?: Record<string, string> };
}
function clean(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== '_id' && key !== '__v'));
}
export function createOperations(data: SeedData, mode: 'static' | 'dev' | 'skills' | 'items' | 'catalog-meta'): SeedOperation[] {
  if (mode === 'dev') return data.characters.map(doc => ({ collection: 'characters', filter: { id: doc.id }, update: { $setOnInsert: clean(doc) } }));
  const operations: SeedOperation[] = [];
  if (mode === 'static' || mode === 'catalog-meta') {
    for (const collection of ['itemSets','serverNotices'] as const)
      for (const doc of data[collection])
        operations.push({collection, filter:{id:doc.id}, update:{$setOnInsert:clean(doc)}});
    if (mode === 'catalog-meta') return operations;
  }
  const collections = mode === 'items' ? ['items'] as const : mode === 'skills' ? ['skills'] as const : ['skills','classes','items','monsters'] as const;
  for (const collection of collections)
    for (const doc of data[collection]) operations.push({ collection, filter: { id: doc.id }, update: { $set: clean(doc) } });
  if (mode === 'static') for (const doc of data.spawns)
    operations.push({ collection: 'monsterSpawns', filter: { locationId: doc.locationId }, update: { $set: clean(doc) } });
  return operations;
}
export interface SeedWriter { write(operation: SeedOperation): Promise<void> }
export async function applyOperations(operations: readonly SeedOperation[], writer: SeedWriter): Promise<void> {
  for (const operation of operations) await writer.write(operation);
}
