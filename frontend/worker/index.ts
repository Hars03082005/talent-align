import { collectFeed } from './feed';
import snapshot from '../src/workspace/jobs.snapshot.json';
import type { Feed } from '../src/workspace/model';
import { serveAsset } from './assets.generated';
import { assessmentStore } from './assessmentStore';
import type { AssessmentEnv } from './assessmentStore';

const cold = snapshot as Feed;
const MAX_AGE = 30 * 60 * 1000;
let cached: Feed | undefined;

export async function marketFeed(refresh = false) {
  if (!refresh && cached && Date.now() - Date.parse(cached.checked) < MAX_AGE) return cached;
  const feed = await collectFeed();
  if (feed.jobs.length) {
    cached = feed;
    return feed;
  }
  return { ...(cached ?? cold), unavailable: feed.unavailable, status: 'snapshot' as const };
}

export default {
  async fetch(request: Request, env: AssessmentEnv = {}) {
    const url = new URL(request.url);
    if (url.pathname === '/api/workspace/assessment') return assessmentStore(request, env);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    if (url.pathname === '/api/workspace/jobs') {
      const result = await marketFeed(url.searchParams.get('refresh') === '1');
      return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (url.pathname.startsWith('/api/')) return Response.json({ error: 'Endpoint unavailable on this deployment' }, { status: 404 });
    const frontend = serveAsset(url.pathname) ?? (url.pathname.includes('.') ? null : serveAsset('/'));
    if (!frontend) return new Response('Not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : frontend.body, {
      headers: { 'Content-Type': frontend.type, 'Cache-Control': url.pathname.startsWith('/assets/') ? 'private, max-age=31536000, immutable' : 'private, no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' },
    });
  },
};
