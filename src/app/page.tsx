'use client';

/**
 * Entry point. Oscar is a client-side app (state, keyboard events, etc.)
 * so we mark this as 'use client'.
 *
 * TODO: Wire up Supabase by passing db functions as props to Oscar,
 * or integrate directly in Oscar.jsx using lib/db.ts.
 * See README.md and lib/db.ts for the full integration guide.
 */

import Oscar from '@/components/Oscar';

export default function Page() {
  return <Oscar />;
}
