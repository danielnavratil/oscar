#!/usr/bin/env node
// Add an Oscar project from the command line, the same way the project picker's
// "add project" does (src/components/Oscar.jsx handleAddProject + src/lib/db.ts).
//
//   node .claude/skills/mj-kickoff/scripts/upload.mjs list
//   node .claude/skills/mj-kickoff/scripts/upload.mjs add --id 45 --name "Issue 45" --file <json> [--apply]
//
// list: read-only. Prints projects.json and the next issue number (highest numeric id + 1).
// add:  dry run by default (prints exactly what would change). --apply uploads the JSON to
//       Storage `issue-json/<id>.json`, upserts the `issues` row, and appends to projects.json.
//       Refuses an id or file name already in use (a reused id overwrites that project's images).
// Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from the repo's .env.local.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const BUCKET = 'issue-json';
const MANIFEST = 'projects.json';

function env() {
  const vars = { ...process.env };
  const file = resolve(REPO, '.env.local');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) vars[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  const url = vars.NEXT_PUBLIC_SUPABASE_URL, key = vars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) fail(`No Supabase URL/key: expected NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in ${file}`);
  return { url, key };
}

function fail(msg) { console.error(msg); process.exit(1); }

function explain(e) {
  const m = String(e?.message ?? e);
  if (/fetch failed|ENOTFOUND|getaddrinfo/i.test(m)) return `${m}\nSupabase unreachable. If the hostname doesn't resolve, the project is paused (free tier): restore it in the Supabase dashboard.`;
  return m;
}

const fileFor = id => `${id.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}.json`;

// Same filter as db.ts parseIssueJson; used only to validate and count.
function parseIssueJson(raw) {
  let d;
  try { d = JSON.parse(raw); }
  catch { d = raw.split('\n').map(l => l.trim()).filter(Boolean).map(l => JSON.parse(l)); }
  const arr = Array.isArray(d) ? d : Object.values(d);
  const seen = new Set();
  return arr.filter(img => {
    if (seen.has(img.id)) return false;
    seen.add(img.id);
    const hasGridRef = img.parent_grid != null || img.grid_index != null;
    return hasGridRef && (img.event_type ?? '') !== 'video_diffusion';
  });
}

async function listProjects(sb) {
  const { data, error } = await sb.storage.from(BUCKET).download(MANIFEST, { cacheNonce: String(Date.now()) });
  if (error) {
    if (error.statusCode == 404 || /not found|does not exist/i.test(error.message ?? '')) return [];
    throw error;
  }
  return JSON.parse(await data.text());
}

function nextIssue(projects) {
  const nums = projects.map(p => p.id).filter(id => /^\d+$/.test(id)).map(Number);
  return nums.length ? Math.max(...nums) + 1 : null;
}

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--apply') out.apply = true;
    else if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[++i];
  }
  return out;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!['list', 'add'].includes(cmd)) fail('usage: upload.mjs list | add --id <id> --name <name> --file <json> [--apply]');
  const { url, key } = env();
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const projects = await listProjects(sb);

  if (cmd === 'list') {
    console.log(JSON.stringify({ projects, nextIssue: nextIssue(projects) }, null, 2));
    return;
  }

  const a = args(rest);
  if (!a.id || !a.name || !a.file) fail('add needs --id, --name and --file');
  const id = a.id.trim(), name = a.name.trim(), file = fileFor(id);
  const path = resolve(a.file.replace(/^~(?=\/)/, process.env.HOME));
  if (!existsSync(path)) fail(`No such file: ${path}`);

  const clash = projects.find(p => p.id.toLowerCase() === id.toLowerCase() || p.file === file);
  if (clash) fail(`Refusing: "${clash.name}" (id ${clash.id}, ${clash.file}) already uses that id/file. Pick a different id.`);

  const raw = readFileSync(path, 'utf8');
  let images;
  try { images = parseIssueJson(raw); } catch (e) { fail(`Not valid issue JSON (${path}): ${e.message}`); }
  if (!images.length) fail(`No usable images in ${path} (none with parent_grid/grid_index).`);
  const mb = (Buffer.byteLength(raw) / 1e6).toFixed(1);

  const plan = [
    `Upload ${path} (${mb} MB, ${images.length} images) -> Storage ${BUCKET}/${file}`,
    `Upsert issues row { id: "${id}", name: "${name}" }`,
    `Append { id: "${id}", name: "${name}", file: "${file}" } to ${BUCKET}/${MANIFEST} (${projects.length} -> ${projects.length + 1} projects)`,
  ];
  if (!a.apply) {
    console.log(`DRY RUN (nothing changed). With --apply this will:\n- ${plan.join('\n- ')}`);
    return;
  }

  const up = await sb.storage.from(BUCKET).upload(file, Buffer.from(raw), { upsert: true, contentType: 'application/json' });
  if (up.error) throw up.error;
  console.log(`done: ${plan[0]}`);

  const iss = await sb.from('issues').upsert({ id, name, created_at: new Date().toISOString() });
  if (iss.error) throw iss.error;
  console.log(`done: ${plan[1]}`);

  // Re-read right before writing so a project someone added meanwhile isn't dropped.
  const latest = await listProjects(sb);
  if (latest.some(p => p.id.toLowerCase() === id.toLowerCase())) {
    console.log(`projects.json already lists ${id}; left as is.`);
    return;
  }
  const updated = [...latest, { id, name, file }];
  const blob = Buffer.from(JSON.stringify(updated, null, 2));
  const man = await sb.storage.from(BUCKET).upload(MANIFEST, blob, { upsert: true, contentType: 'application/json' });
  if (man.error) throw man.error;
  console.log(`done: ${plan[2]}`);
}

main().catch(e => fail(explain(e)));
