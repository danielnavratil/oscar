/**
 * db.ts — All database operations for Oscar.
 *
 * This is the ONLY file that talks to Supabase.
 * To swap to a different backend, replace the implementations here.
 * The Oscar component imports from this file and doesn't know about Supabase.
 */

import { supabase } from './supabase';

const ISSUE_ID = '38'; // TODO: make dynamic when supporting multiple issues

export type BookmarkImage = {
  id: string;
  prompt?: string;
  user_name?: string;
  aspect?: string;
  parent_grid?: number;
  likes?: number;
  enqueue_time?: string;
};

function imageRow(img: BookmarkImage) {
  return {
    id: img.id,
    issue_id: ISSUE_ID,
    prompt: img.prompt,
    user_name: img.user_name,
    aspect: img.aspect,
    parent_grid: img.parent_grid,
    likes: img.likes ?? 0,
    enqueue_time: img.enqueue_time,
  };
}

// ── IMAGES ────────────────────────────────────────────────────

/** Upload the full JSON array of images for the issue */
export async function uploadImages(images: BookmarkImage[]) {
  const rows = images.map(imageRow);

  // Upsert in batches of 500 to avoid request size limits
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from('images')
      .upsert(rows.slice(i, i + 500), { onConflict: 'id' });
    if (error) throw error;
  }
}

/** Load all images for the current issue */
export async function loadImages() {
  const { data, error } = await supabase
    .from('images')
    .select('*')
    .eq('issue_id', ISSUE_ID)
    .order('enqueue_time', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ── BOOKMARKS ─────────────────────────────────────────────────

export async function loadBookmarks(): Promise<Record<string, Set<string>>> {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('image_id, voter_name')
    .eq('issue_id', ISSUE_ID);
  if (error) throw error;

  const result: Record<string, Set<string>> = {};
  for (const row of data ?? []) {
    if (!result[row.voter_name]) result[row.voter_name] = new Set();
    result[row.voter_name].add(row.image_id);
  }
  return result;
}

export async function addBookmark(imageId: string, voterName: string) {
  const { error } = await supabase
    .from('bookmarks')
    .insert({ image_id: imageId, voter_name: voterName, issue_id: ISSUE_ID });
  if (error && error.code !== '23505') throw error; // ignore duplicate
}

export async function removeBookmark(imageId: string, voterName: string) {
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('image_id', imageId)
    .eq('voter_name', voterName)
    .eq('issue_id', ISSUE_ID);
  if (error) throw error;
}

// ── CATEGORIES ────────────────────────────────────────────────

export async function loadCategories(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('categories')
    .select('image_id, category');
  if (error) throw error;
  return Object.fromEntries((data ?? []).map(r => [r.image_id, r.category]));
}

export async function setCategory(imageId: string, category: string) {
  const { error } = await supabase
    .from('categories')
    .upsert({ image_id: imageId, category, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ── REFERENCE TYPES ───────────────────────────────────────────

export async function loadRefTypes(): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from('ref_types')
    .select('image_id, types');
  if (error) throw error;
  return Object.fromEntries((data ?? []).map(r => [r.image_id, r.types ?? []]));
}

export async function setRefTypes(imageId: string, types: string[]) {
  const { error } = await supabase
    .from('ref_types')
    .upsert({ image_id: imageId, types, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ── VOTES ─────────────────────────────────────────────────────

export async function loadVotes(): Promise<Record<string, Set<string>>> {
  const { data, error } = await supabase
    .from('votes')
    .select('image_id, voter_name')
    .eq('issue_id', ISSUE_ID);
  if (error) throw error;

  const result: Record<string, Set<string>> = {};
  for (const row of data ?? []) {
    if (!result[row.voter_name]) result[row.voter_name] = new Set();
    result[row.voter_name].add(row.image_id);
  }
  return result;
}

export async function addVote(imageId: string, voterName: string) {
  const { error } = await supabase
    .from('votes')
    .insert({ image_id: imageId, voter_name: voterName, issue_id: ISSUE_ID });
  if (error && error.code !== '23505') throw error;
}

export async function removeVote(imageId: string, voterName: string) {
  const { error } = await supabase
    .from('votes')
    .delete()
    .eq('image_id', imageId)
    .eq('voter_name', voterName)
    .eq('issue_id', ISSUE_ID);
  if (error) throw error;
}

// ── VOTE SUBMISSIONS ──────────────────────────────────────────

export async function loadSubmissions(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('vote_submissions')
    .select('voter_name')
    .eq('issue_id', ISSUE_ID);
  if (error) throw error;
  return new Set((data ?? []).map(r => r.voter_name));
}

export async function submitVotes(voterName: string) {
  const { error } = await supabase
    .from('vote_submissions')
    .upsert({ voter_name: voterName, issue_id: ISSUE_ID });
  if (error) throw error;
}

// ── VOTING STATE ──────────────────────────────────────────────

export async function loadVotingState(): Promise<boolean> {
  const { data } = await supabase
    .from('voting_state')
    .select('is_open')
    .eq('issue_id', ISSUE_ID)
    .single();
  return data?.is_open ?? false;
}

export async function setVotingOpen(isOpen: boolean) {
  const { error } = await supabase
    .from('voting_state')
    .upsert({ issue_id: ISSUE_ID, is_open: isOpen, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ── PAIRS ─────────────────────────────────────────────────────

export async function loadPairs() {
  const { data, error } = await supabase
    .from('pairs')
    .select('*')
    .eq('issue_id', ISSUE_ID)
    .order('created_at', { ascending: true });
  if (error) throw error;

  // Reshape to match Oscar's internal pair format
  return (data ?? []).map(p => ({
    id: p.id,
    a: { id: p.image_a_id, side: p.side_a, size: p.size_a },
    b: { id: p.image_b_id, side: p.side_b, size: p.size_b },
    creator: p.creator,
    type: p.type,
  }));
}

export async function createPair(pair: {
  id: string;
  a: { id: string; side: string; size: string };
  b: { id: string; side: string; size: string };
  creator: string;
  type: string;
}) {
  const { error } = await supabase.from('pairs').insert({
    id: pair.id,
    issue_id: ISSUE_ID,
    image_a_id: pair.a.id,
    image_b_id: pair.b.id,
    side_a: pair.a.side,
    size_a: pair.a.size,
    side_b: pair.b.side,
    size_b: pair.b.size,
    creator: pair.creator,
    type: pair.type,
  });
  if (error) throw error;
}

export async function updatePair(pairId: string, updates: {
  side_a?: string; size_a?: string;
  side_b?: string; size_b?: string;
  type?: string;
}) {
  const { error } = await supabase
    .from('pairs')
    .update(updates)
    .eq('id', pairId);
  if (error) throw error;
}

export async function deletePair(pairId: string) {
  const { error } = await supabase
    .from('pairs')
    .delete()
    .eq('id', pairId);
  if (error) throw error;
}

// ── REAL-TIME SUBSCRIPTIONS ───────────────────────────────────
/**
 * Subscribe to all collaborative tables and call handlers on changes.
 * Call this once in the App component on mount.
 * Returns an unsubscribe function to call on unmount.
 *
 * Usage:
 *   const unsub = subscribeToChanges({ onBookmark, onVote, onPair, ... });
 *   return () => unsub();
 */
export function subscribeToChanges(handlers: {
  onBookmarkChange?: () => void;
  onVoteChange?: () => void;
  onSubmissionChange?: () => void;
  onPairChange?: () => void;
  onCategoryChange?: () => void;
  onVotingStateChange?: () => void;
}) {
  const channel = supabase
    .channel('oscar-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookmarks' },
      () => handlers.onBookmarkChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' },
      () => handlers.onVoteChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vote_submissions' },
      () => handlers.onSubmissionChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pairs' },
      () => handlers.onPairChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' },
      () => handlers.onCategoryChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'voting_state' },
      () => handlers.onVotingStateChange?.())
    .subscribe();

  return () => channel.unsubscribe();
}
