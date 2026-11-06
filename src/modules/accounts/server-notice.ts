import { readFile } from 'node:fs/promises';

export interface ServerNotice {
  id: string;
  enabled: boolean;
  title: string;
  message: string;
  news: string[];
  upcomingEvents: string[];
}

export function parseServerNotice(value: unknown): ServerNotice {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid server notice');
  const v = value as Record<string, unknown>;
  const string = (key: string, max: number) => {
    const s = v[key];
    if (typeof s !== 'string' || s.length > max) throw new Error('Invalid server notice field');
    return s.trim();
  };
  const list = (key: string) => {
    const rows = v[key];
    if (!Array.isArray(rows) || rows.length > 20 || rows.some(s => typeof s !== 'string' || s.length > 512))
      throw new Error('Invalid server notice section');
    return (rows as string[]).map(s => s.trim()).filter(Boolean);
  };
  const id = string('id', 128);
  if (!id || typeof v.enabled !== 'boolean') throw new Error('Invalid server notice identity');
  return { id, enabled: v.enabled, title: string('title', 256), message: string('message', 4096),
    news: list('news'), upcomingEvents: list('upcomingEvents') };
}

// Same relative layout in src and dist. A missing/broken optional notice must not prevent login.
export async function loadServerNotice(file = new URL('../../../data/server-notice.json', import.meta.url)): Promise<ServerNotice> {
  try { return parseServerNotice(JSON.parse(await readFile(file, 'utf8'))); }
  catch {
    console.warn('Server notice unavailable or invalid; omitted from presentation.');
    return { id: '', enabled: false, title: '', message: '', news: [], upcomingEvents: [] };
  }
}
