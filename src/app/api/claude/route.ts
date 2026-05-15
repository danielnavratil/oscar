import { NextRequest, NextResponse } from 'next/server';

async function resolveImageUrl(url: string): Promise<{ type: 'base64'; media_type: string; data: string }> {
  const res = await fetch(url, {
    headers: {
      'Referer': 'https://www.midjourney.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const media_type = res.headers.get('Content-Type') ?? 'image/webp';
  const data = Buffer.from(buffer).toString('base64');
  return { type: 'base64', media_type, data };
}

// Walk message content blocks and replace url image sources with base64
async function resolveImages(body: any): Promise<any> {
  if (!Array.isArray(body.messages)) return body;
  const messages = await Promise.all(body.messages.map(async (msg: any) => {
    if (!Array.isArray(msg.content)) return msg;
    const content = await Promise.all(msg.content.map(async (block: any) => {
      if (block.type === 'image' && block.source?.type === 'url') {
        const source = await resolveImageUrl(block.source.url);
        return { ...block, source };
      }
      return block;
    }));
    return { ...msg, content };
  }));
  return { ...body, messages };
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 });
  }

  const raw = await req.json();
  const body = await resolveImages(raw);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('[claude route] Anthropic error', response.status, JSON.stringify(data));
  }
  return NextResponse.json(data, { status: response.status });
}