import { resolve } from 'node:path';
import { loadData } from './data.js';
const data = await loadData(resolve(process.env.SEED_DIR || 'data'));
console.log('Validated without MongoDB:', Object.fromEntries(Object.entries(data).map(([key, values]) => [key, values.length])));
