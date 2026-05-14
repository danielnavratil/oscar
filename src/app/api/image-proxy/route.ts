/**
 * /api/image-proxy — Proxies Midjourney CDN images to avoid CORS issues.
 *
 * Usage in Oscar: /api/image-proxy?url=https://cdn.midjourney.com/...
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !url.startsWith('https://cdn.midjourney.com/')) {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  const response = await fetch(url);
  if (!response.ok) {
    return new NextResponse('Image not found', { status: 404 });
  }

  const buffer = await response.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'image/webp',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
