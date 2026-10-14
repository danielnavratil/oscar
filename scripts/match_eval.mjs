// How well the Pair tab's matcher (src/lib/match.js) predicted the pairs actually made.
// For each confirmed pair, ranks the partner among all bookmarked images, both directions.
//
// Usage: node scripts/match_eval.mjs 44[,45,...]   (reads Supabase settings from .env.local)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildMatchIndex, rankPartners } from "../src/lib/match.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(fs.readFileSync(path.join(root, ".env.local"), "utf8").split("\n")
  .filter(l => l.includes("=")).map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function q(p) {
  let rows = [], off = 0;
  for (;;) {
    const d = await (await fetch(`${U}/rest/v1/${p}`, { headers: { apikey: K, Authorization: `Bearer ${K}`, Range: `${off}-${off + 999}` } })).json();
    rows = rows.concat(d);
    if (d.length < 1000) return rows;
    off += 1000;
  }
}
const storage = async p => {
  const r = await fetch(`${U}/storage/v1/object/public/issue-json/${p.split("/").map(encodeURIComponent).join("/")}?n=${Date.now()}`);
  return r.ok ? r.json() : null;
};

const issues = (process.argv[2] || "").split(",").filter(Boolean);
if (!issues.length) { console.log("Usage: node scripts/match_eval.mjs 44[,45,...]"); process.exit(1); }
const files = Object.fromEntries((await storage("projects.json")).map(p => [p.id, p.file]));
const cats = Object.fromEntries((await q("categories?select=image_id,category&order=image_id")).map(c => [c.image_id, c.category]));

const all = [];
for (const iss of issues) {
  const raw = await storage(files[iss]);
  const imgs = (Array.isArray(raw) ? raw : raw.images).map(i => ({ id: i.id, prompt: i.prompt, user_name: i.user_name ?? i.username ?? i.display_name }));
  const bm = new Set((await q(`bookmarks?select=image_id&issue_id=eq.${iss}&order=image_id`)).map(b => b.image_id));
  const votes = {};
  for (const v of await q(`votes?select=image_id&issue_id=eq.${iss}&order=image_id`)) votes[v.image_id] = (votes[v.image_id] || 0) + 1;
  const pairs = await q(`pairs?select=image_a_id,image_b_id&issue_id=eq.${iss}&type=eq.confirmed&order=id`);
  const notes = (await storage(`match-notes/${files[iss]}`)) || {};
  const pool = imgs.filter(i => bm.has(i.id)), byId = Object.fromEntries(pool.map(i => [i.id, i]));
  const index = buildMatchIndex(pool, notes);
  const ranks = [];
  for (const { image_a_id: a, image_b_id: b } of pairs) {
    if (!byId[a] || !byId[b]) continue;
    for (const [x, y] of [[a, b], [b, a]]) {
      const order = rankPartners(byId[x], pool, index, { categories: cats, voteCount: id => votes[id] || 0 });
      ranks.push(order.findIndex(o => o.img.id === y) + 1 || Infinity);
    }
  }
  all.push(...ranks);
  console.log(`issue ${iss}: ${pool.length} bookmarked, notes for ${pool.filter(i => notes[i.id]).length} | ${summary(ranks)}`);
}
if (issues.length > 1) console.log(`all: ${summary(all)}`);

function summary(ranks) {
  const pct = k => `${Math.round(100 * ranks.filter(r => r <= k).length / ranks.length)}%`;
  const s = [...ranks].sort((a, b) => a - b);
  return `partner in top 5 ${pct(5)}, top 10 ${pct(10)}, top 20 ${pct(20)}, median rank ${s[Math.floor(s.length / 2)]} (${ranks.length} lookups)`;
}
