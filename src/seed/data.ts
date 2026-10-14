import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Character } from '../modules/characters/model.js';
import { Monster } from '../modules/monsters/model.js';
import { MonsterSpawns } from '../modules/spawns/model.js';
import { CharacterClass } from '../modules/classes/model.js';
import { Item } from '../modules/items/model.js';
import { validateSkillGraph } from '../modules/skills/service.js';
import { Skill } from '../modules/skills/model.js';

async function records<T>(directory: string, filename: string, parse: (row: object) => Promise<T>): Promise<T[]> {
  const raw: unknown = JSON.parse(await readFile(resolve(directory, filename), 'utf8'));
  if (!Array.isArray(raw)) throw new Error(`${filename}: expected an array`);
  const result: T[] = [];
  for (const row of raw as unknown[]) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`${filename}: expected object`);
    if ('_id' in row || '__v' in row) throw new Error(`${filename}: do not include Mongo metadata`);
    result.push(await parse(row));
  }
  return result;
}
function unique(values: readonly (number | string)[], label: string): void {
  if (values.length !== new Set(values).size) throw new Error(`Duplicate IDs in ${label}`);
}
function reference(ids: ReadonlySet<number>, value: number, label: string): void {
  if (!ids.has(value)) throw new Error(`Unknown reference ${label}: ${value}`);
}
export async function loadData(directory: string) {
  const skills = await records(directory, 'skills.json', async row => { const doc = new Skill(row); await doc.validate(); return doc.toObject(); });
  validateSkillGraph(skills);
  const classes = await records(directory, 'classes.json', async row => { const doc = new CharacterClass(row); await doc.validate(); return doc.toObject(); });
  const items = await records(directory, 'items.json', async row => { const doc = new Item(row); await doc.validate(); return doc.toObject(); });
  const monsters = await records(directory, 'monsters.json', async row => { const doc = new Monster(row); await doc.validate(); return doc.toObject(); });
  const spawns = await records(directory, 'spawns.json', async row => { const doc = new MonsterSpawns(row); await doc.validate(); return doc.toObject(); });
  const characters = await records(directory, 'characters.json', async row => { const doc = new Character(row); await doc.validate(); return doc.toObject(); });
  for (const [label, values] of Object.entries({ skills, classes, items, monsters, characters }))
    unique(values.map(v => v.id), label);
  unique(spawns.map(v => v.locationId), 'spawns');
  const skillIds = new Set(skills.map(v => v.id));
  const classIds = new Set(classes.map(v => v.id));
  const monsterIds = new Set(monsters.map(v => v.id));
  for (const definition of [...classes, ...monsters])
    for (const id of definition.skillIds) reference(skillIds, id, 'skill');
  for (const item of items) for (const id of item.requirements.classIds) reference(classIds, id, 'item class');
  for (const character of characters) reference(classIds, character.info.classId, 'character class');
  for (const location of spawns) for (const camp of location.camps)
    for (const member of camp.monsters) reference(monsterIds, Number(member.enemyId), 'spawn monster');
  return { skills, classes, items, monsters, spawns, characters };
}
export type SeedData = Awaited<ReturnType<typeof loadData>>;
