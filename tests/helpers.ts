import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useTestDB } from '../src/lib/db';
import { installSeed, type SeedFile } from '../src/lib/seed';

let n = 0;
export function freshDB() {
  return useTestDB(`test-${Date.now()}-${n++}`);
}

export function loadSeed(): SeedFile {
  return JSON.parse(readFileSync(join(__dirname, '..', 'public', 'seed', 'seed.json'), 'utf8')) as SeedFile;
}

export async function seededDB() {
  const db = freshDB();
  await installSeed(loadSeed());
  return db;
}
