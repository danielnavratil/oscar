# Oscar

Internal curation tool for the Midjourney magazine. Used by the editorial team to browse, bookmark, categorize, vote on, and pair AI-generated images for each monthly issue.

## What it does

| Tab | Purpose |
|-----|---------|
| **Browse** | Upload the monthly JSON, browse 10k images in grid or fullscreen tinder mode, bookmark favorites |
| **Collection** | Pooled bookmarks from all voters, AI auto-categorization, reference type tagging, unlock voting |
| **Vote** | Vote on bookmarked images, submit when done, see team submission status |
| **Pair** | Pair voted images for magazine spreads, assign L/R and size, AI pair suggestions, Chase proposal flow |
| **Export** | Download confirmed pairs as JSON with cleaned prompts, categories, ref types, MJ links |

## Stack

- **Next.js 14** — React framework, handles routing + API routes
- **Supabase** — Postgres database + real-time subscriptions (collaborative without page refresh)
- **Tailwind CSS** — styling
- **Anthropic API** — AI categorization and pair suggestions (called server-side via `/api/claude`)
- **Vercel** — deployment

## Local setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd oscar
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/schema.sql`
3. **Existing DBs only:** run `supabase/migrations/20260520140000_drop_images_foreign_keys.sql`
4. Go to **Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key → `ANTHROPIC_API_KEY`

### 4. Environment variables

```bash
cp .env.local.example .env.local
# Fill in your values
```

### 5. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

## Deploy to Vercel

1. Push to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add the three environment variables from `.env.local`
4. Deploy — Vercel auto-deploys on every push to `main`

## Project structure

```
oscar/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Entry point — renders Oscar
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Tailwind + custom CSS
│   │   └── api/
│   │       ├── claude/           # Anthropic API proxy (keeps key server-side)
│   │       └── image-proxy/      # Midjourney CDN proxy (fixes CORS)
│   ├── components/
│   │   └── Oscar.jsx             # Main app — all UI and logic
│   └── lib/
│       ├── supabase.ts           # Supabase client init
│       └── db.ts                 # ALL database operations — swap this to change backend
└── supabase/
    └── schema.sql                # Full DB schema — run once in Supabase SQL editor
```

## Notes for devs

- **`Oscar.jsx`** is the single-file component with all UI and state. It currently uses local React state. Data persistence calls are marked with `// SUPABASE:` comments showing exactly where to wire in `db.ts` functions.
- **`lib/db.ts`** is the data layer. All Supabase calls live here. To swap to a different backend later, only this file changes.
- **Real-time** collaboration (bookmarks/votes appearing without refresh) uses Supabase's built-in Postgres CDC. See `lib/db.ts` for subscription setup.
- **Images** load via `/api/image-proxy` to avoid CORS issues with the Midjourney CDN.
- **AI calls** go through `/api/claude` so the Anthropic key is never exposed to the client.

## Phase 2 (not yet built)

- JPEG batch export with prompt + username in EXIF metadata
- QR code generation for image reference links
- InDesign handoff automation
