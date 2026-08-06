# CLAUDE.md

Context for Claude sessions working on Oscar. Read the README first for setup; this file covers what the code can't tell you.

## What this is

Internal curation tool for a Midjourney magazine. Three users (Daniel, Hongrae, Chase — hardcoded in `TEAM` in `Oscar.jsx`, no auth) browse, bookmark, vote on, and pair AI images per issue, then export pairs JSON for print. Deployed on Vercel; every push to `main` auto-deploys.

## Architecture

- `src/components/Oscar.jsx` — the entire UI and state, one large client component.
- `src/lib/db.ts` — the ONLY file that talks to Supabase. All reads/writes go through it.
- `/api/claude` — server-side proxy to the Anthropic API (keeps the key secret). `/api/image-proxy` — fetches Midjourney CDN images server-side to bypass hotlink protection.
- Image data is NOT in Postgres. Each project's images live as a JSON file in the Supabase Storage bucket `issue-json`; the list of projects is `projects.json` in the same bucket.
- Postgres tables (`issues`, `bookmarks`, `votes`, `vote_submissions`, `categories`, `ref_types`, `pairs`, `voting_state`, `prompt_edits`) are namespaced by `issue_id`. The current project is set at runtime via `setCurrentProject()` from the project picker.
- Realtime: Supabase postgres_changes subscriptions push everyone's actions live. Vote reloads are debounced 400ms; in-flight ops are tracked in `pendingVoteOpsRef` so optimistic updates aren't clobbered.

## Gotchas

- **Migrations never auto-apply.** There is no CI. New SQL in `supabase/migrations/` must be pasted into the Supabase SQL Editor by hand. (`20260527000000_add_prompt_edits.sql` was not yet confirmed run as of late May 2026.)
- The `images` table was dropped in May 2026 and all FK constraints to it removed — the old FKs caused silent insert failures (optimistic UI showed a vote; Postgres rolled it back). Do not reintroduce FKs on `image_id`.
- `issue_id` still has an FK to `issues(id)`, so every new project needs a row in `issues` — the add-project flow (`upsertIssue`) handles this.
- Known bug, low priority: on the vote tab a vote occasionally doesn't render until you switch tabs and back. Data is correct; likely the debounced reload calling `setVotes` non-functionally over optimistic state.

## Print pipeline (runs on Daniel's Mac only)

`scripts/oscar_pipeline.sh <pairs.json>` downloads full-res images from the MJ CDN (`download_images.py`, auth via Arc browser cookies), upscales 4x with Real-ESRGAN (`~/tools/realesrgan/`), and drives Photoshop (`convert_both.jsx`) to output two CMYK folders: `HH Links/` (SWOP, US press) and `KOPA Links/` (PSO, Euro press). Then in InDesign, `place_oscar_pairs.jsx` places pairs + prompts into the template and `place_qr_codes.jsx` adds QR codes (its folder path and username→file list are edited per issue).

- InDesign executes the copy in `~/Library/Preferences/Adobe InDesign/.../Scripts Panel/`, not the repo. After editing a placement script, copy it there — the repo copy is canonical; copies have drifted before.
- Daily-theme projects skip the pipeline and placement entirely (browser-side JPG zip download from the Export tab).

## Conventions

- Match the existing style in `Oscar.jsx`: inline styles, compact JSX, everything in one file.
- Secrets live in Vercel/`.env.local` env vars, never in the repo (the repo is public).
