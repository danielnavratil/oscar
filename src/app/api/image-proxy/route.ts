import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url || !url.startsWith('https://cdn.midjourney.com/')) {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  const response = await fetch(url, {
    headers: {
      'Referer': 'https://www.midjourney.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

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