// Pair-partner matching: per-image notes (Claude tags from fixed word lists +
// a pixel palette), scored together with prompt words, category and votes.
// Kept apart from Oscar.jsx so the tuning script can import the same code.

// ── NOTE VOCABULARY ────────────────────────────────────────────
// Fixed lists so the same thing gets the same word on every image; only
// `subjects` is free text. Bump NOTES_VERSION when the lists or prompt change.
export const NOTES_VERSION = 1;
export const NOTES_MODEL = "claude-sonnet-5-5";

export const VOCAB = {
  subject_kinds: ["person","woman","man","child","elderly person","face","eyes","hands","body","crowd","fashion model","character","creature","monster","robot","animal","mammal","cat","dog","horse","bird","fish","sea creature","insect","reptile","dinosaur","skeleton","skull","plant","flower","tree","mushroom","fruit","food","drink","building","house","interior","room","furniture","city","street","landscape","mountain","desert","forest","ocean","water","sky","clouds","space","planet","moon","sun","vehicle","car","train","aircraft","boat","machine","weapon","toy","doll","mask","clothing","shoes","hat","jewelry","bag","object","product","book","text","pattern","abstract form","sculpture","statue","religious","mythological","fantasy","miniature","giant scale"],
  medium: ["photo","film photo","studio photo","fashion photo","product photo","3d render","claymation","digital illustration","digital painting","oil painting","watercolor","gouache","pastel or crayon","pen and ink","pencil drawing","engraving","screen print","collage","flat vector graphic","pixel art","anime","comic","storybook illustration","poster","sculpture","papercraft","textile","ceramic","glass art","low poly","isometric","typography"],
  era: ["ancient","medieval","renaissance","baroque","victorian","art nouveau","1920s","art deco","1950s","1960s","1970s","1980s","1990s","y2k","contemporary","futuristic","retro-futurism","surrealism","bauhaus","modernism","mid-century modern","pop art","minimalism","brutalism","ukiyo-e","impressionism","expressionism","cyberpunk","steampunk","vaporwave","gothic","folk art","psychedelic","memphis design","soviet"],
  mood: ["playful","whimsical","absurd","cute","eerie","uncanny","ominous","menacing","grotesque","dreamy","serene","calm","melancholy","lonely","nostalgic","mysterious","dramatic","epic","romantic","sensual","elegant","luxurious","energetic","joyful","tense","cozy","cold","solemn","ethereal","bold"],
  materials: ["chrome","metal","gold","brass or copper","glass","translucent","plastic","glossy","matte","rubber or latex","fabric","knit or wool","fur","feathers","leather","paper","cardboard","wood","stone","marble","concrete","ceramic","porcelain","clay","crystal","ice","snow","water","liquid","smoke or fog","fire","sand","foliage","flowers","skin","hair","bone","neon","light or glow","pearls or beads","jelly or gummy","inflatable","foam or sponge"],
  light: ["soft daylight","golden hour","blue hour","night","neon light","studio light","flash","high-key","low-key","chiaroscuro","backlit","silhouette","glow","lens flare or starburst","haze or fog","candlelight","spotlight","harsh shadows","overcast"],
  shapes: ["single centered subject","symmetry","circles","spheres","concentric rings","spirals","waves","grid","repetition","stripes","checkerboard","dots","diagonal lines","vertical lines","horizontal lines","radiating lines","organic curves","blobs","spikes or points","arches","triangles","cubes","cylinders","scattered small elements","crowd of figures","negative space","frame within frame","reflection","close-up crop","wide vista","overhead view","low angle","tall vertical form","horizon line","tangled lines"],
  color_families: ["red","orange","yellow","green","teal","blue","navy","purple","pink","magenta","brown","beige","cream","black","white","gray","gold","silver"],
  color_character: ["pastel","muted","vivid","neon","monochrome","black and white","sepia","duotone","high contrast","low contrast","warm","cool","dark","light","earthy","metallic","rainbow","complementary colors"],
};

export const NOTES_SYSTEM = `You tag Midjourney AI images for a print magazine. Editors pair images into two-page spreads by shared subject matter, style, mood, color, material, or shapes. Your tags are compared across hundreds of images to find partners, so consistency matters more than eloquence: pick from the given lists, and tag the same thing the same way every time.

For every list, pick each item that clearly applies, usually 1 to 4. Tag what is visible; the prompt is only secondary context.

subjects: every notable thing in the image, including small or background details, as plain singular nouns or short noun phrases ("toy dinosaur", "carabiner", "armchair", "red headscarf"). Use the everyday word a person would use. No style or mood words here.
subject_kinds: the broad kinds of subject present.
medium: how the image is made.
era: period or movement the look belongs to; empty if none stands out.
mood: the feeling.
materials: surfaces and substances that stand out, including finishes like glossy or matte.
light: the lighting.
shapes: repeated forms, motifs and composition.
color_families: the 2 to 4 dominant colors.
color_character: the overall palette.`;

const list = items => ({ type: "array", items: { type: "string", enum: items } });
export const NOTES_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["subjects", ...Object.keys(VOCAB)],
  properties: { subjects: { type: "array", items: { type: "string" } }, ...Object.fromEntries(Object.entries(VOCAB).map(([k, v]) => [k, list(v)])) },
};

// ── SCORING ────────────────────────────────────────────────────
// Relative weight of each note field inside the notes similarity.
export const NOTE_FIELD_WEIGHTS = { subjects: 1, subject_kinds: 1, medium: 1, era: 1, mood: 0.7, materials: 1, light: 0.7, shapes: 0.7, color_families: 0.5, color_character: 0.7 };
// How the signals add up. Starting guesses; tune against new issues with scripts/match_eval.mjs.
export const MATCH_WEIGHTS = { notes: 1, palette: 0.3, prompt: 0.5, category: 0.35, similarCategory: 0.15, votes: 0.35 };

// Categories paired across often in issues 39–43 (4+ times, above chance), plus sci-fi + transportation.
export const SIMILAR_CATEGORIES = [
  ["characters", "humor"], ["characters", "sci-fi"], ["characters", "design"], ["characters", "animals"],
  ["people", "surreal + horror"], ["people", "fine art"], ["environments", "surreal + horror"],
  ["architecture + interiors", "sci-fi"], ["sci-fi", "transportation"],
];
const similarCats = new Set(SIMILAR_CATEGORIES.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));

const stem = w => w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;

function noteTerms(n, fieldWeights) {
  const t = {};
  const add = (k, w) => { t[k] = (t[k] || 0) + w; };
  for (const [f, w] of Object.entries(fieldWeights)) {
    for (const raw of n[f] || []) {
      const p = String(raw).toLowerCase().trim();
      if (f !== "subjects") { add(`${f}:${p}`, w); continue; }
      // whole phrase plus its words, so "toy dinosaur" meets "dinosaur figurine"
      add(`s:${p}`, w);
      for (const word of p.split(/[^a-z0-9]+/)) if (word.length > 2) add(`w:${stem(word)}`, w);
    }
  }
  return t;
}

function promptTerms(prompt) {
  const body = (prompt || "").replace(/https?:\/\/\S+/g, "").split(/\s--/)[0].toLowerCase();
  const t = {};
  for (const w of body.match(/[a-z]{3,}/g) || []) t[stem(w)] = (t[stem(w)] || 0) + 1;
  return t;
}

// tf-idf: a term shared by few images counts for more than one everyone has
function tfidf(docs) {
  const ids = Object.keys(docs), N = ids.length, df = {};
  for (const id of ids) for (const k in docs[id]) df[k] = (df[k] || 0) + 1;
  const out = {};
  for (const id of ids) {
    const v = {}; let n2 = 0;
    for (const [k, tf] of Object.entries(docs[id])) {
      const x = tf * Math.log(N / df[k]);
      if (x > 0) { v[k] = x; n2 += x * x; }
    }
    out[id] = { v, n: Math.sqrt(n2) || 1 };
  }
  return out;
}
const cosine = (a, b) => {
  if (!a || !b) return 0;
  let s = 0;
  for (const k in a.v) if (b.v[k]) s += a.v[k] * b.v[k];
  return s / a.n / b.n;
};

// ── COLOR ──────────────────────────────────────────────────────
export function rgbToLab(r, g, b) {
  const lin = c => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505), y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const hexToLab = h => rgbToLab(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Dominant colors from RGBA pixel data (k-means in Lab). Returns [[hex, share], ...], biggest first.
export function paletteFromPixels(data, k = 6) {
  const px = [], rgb = [];
  for (let i = 0; i < data.length; i += 4) { px.push(rgbToLab(data[i], data[i + 1], data[i + 2])); rgb.push([data[i], data[i + 1], data[i + 2]]); }
  if (!px.length) return [];
  // farthest-point seeding keeps it deterministic
  const cents = [px[0]];
  while (cents.length < Math.min(k, px.length)) {
    let best = 0, bestD = -1;
    px.forEach((p, i) => { const d = Math.min(...cents.map(c => dist(p, c))); if (d > bestD) { bestD = d; best = i; } });
    cents.push(px[best]);
  }
  let assign = new Array(px.length).fill(0);
  for (let it = 0; it < 12; it++) {
    assign = px.map(p => { let bi = 0, bd = Infinity; cents.forEach((c, j) => { const d = dist(p, c); if (d < bd) { bd = d; bi = j; } }); return bi; });
    cents.forEach((_, j) => {
      const m = px.filter((_, i) => assign[i] === j);
      if (m.length) cents[j] = [0, 1, 2].map(d => m.reduce((s, p) => s + p[d], 0) / m.length);
    });
  }
  const out = cents.map((_, j) => {
    const idx = assign.map((a, i) => a === j ? i : -1).filter(i => i >= 0);
    if (!idx.length) return null;
    const avg = [0, 1, 2].map(d => Math.round(idx.reduce((s, i) => s + rgb[i][d], 0) / idx.length));
    return ["#" + avg.map(v => v.toString(16).padStart(2, "0")).join(""), +(idx.length / px.length).toFixed(3)];
  }).filter(Boolean);
  return out.sort((a, b) => b[1] - a[1]);
}

// 0..1: each color finds its closest color in the other palette, weighted by how much of the image it covers
function paletteSim(a, b) {
  if (!a?.length || !b?.length) return 0;
  const side = (x, y) => x.reduce((s, [lab, w]) => s + w * Math.min(...y.map(([l]) => dist(lab, l))), 0);
  const d = (side(a, b) + side(b, a)) / 2;
  return Math.max(0, 1 - d / 50);
}

// ── INDEX + RANK ───────────────────────────────────────────────
// images: the candidate pool ({id, prompt, user_name}); notes: {id: notes}
export function buildMatchIndex(images, notes, fieldWeights = NOTE_FIELD_WEIGHTS) {
  const withNotes = images.filter(i => notes[i.id]);
  return {
    notes: tfidf(Object.fromEntries(withNotes.map(i => [i.id, noteTerms(notes[i.id], fieldWeights)]))),
    prompt: tfidf(Object.fromEntries(images.map(i => [i.id, promptTerms(i.prompt)]))),
    palette: Object.fromEntries(withNotes.map(i => [i.id, (notes[i.id].palette || []).map(([h, w]) => [hexToLab(h), w])])),
  };
}

// Candidates for `a`, best first, as [{img, score}]. Same artist never pairs.
export function rankPartners(a, images, index, { categories = {}, voteCount = () => 0, weights = MATCH_WEIGHTS } = {}) {
  const catA = categories[a.id];
  return images
    .filter(c => c.id !== a.id && c.user_name !== a.user_name)
    .map(c => ({
      img: c,
      score: weights.notes * cosine(index.notes[a.id], index.notes[c.id])
        + weights.palette * paletteSim(index.palette[a.id], index.palette[c.id])
        + weights.prompt * cosine(index.prompt[a.id], index.prompt[c.id])
        + weights.category * (catA && catA === categories[c.id] ? 1 : 0)
        + weights.similarCategory * (similarCats.has(`${catA}|${categories[c.id]}`) ? 1 : 0)
        + weights.votes * Math.min(voteCount(c.id), 3) / 3,
    }))
    .sort((x, y) => y.score - x.score);
}
