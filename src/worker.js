// Nicotine landing page: counts downloads in D1, then redirects to the APK.
//
// Static files in ./public are served by Cloudflare before this runs, so the
// Worker only sees paths that aren't files: /download, /api/stats and 404s.

// Link-preview bots (Facebook, WhatsApp, ...) open shared links. Don't count them.
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|skype|headless|lighthouse/i;

// Bangladesh is UTC+6 all year (no daylight saving).
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/download') return download(request, env, ctx);
    if (pathname === '/api/stats') return stats(env);
    return env.ASSETS.fetch(request);
  },
};

function download(request, env, ctx) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const target = env.DOWNLOAD_URL;
  if (!target || !target.startsWith('https://')) {
    return new Response('The download link isn\'t set yet.', { status: 503 });
  }

  if (shouldCount(request)) {
    const day = new Date(Date.now() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
    // Count after the redirect has gone out, and never let a database
    // problem block the download.
    ctx.waitUntil(
      env.DB.prepare(
        'INSERT INTO downloads (day, count) VALUES (?1, 1) ' +
          'ON CONFLICT(day) DO UPDATE SET count = count + 1',
      )
        .bind(day)
        .run()
        .catch((err) => console.error('Download count failed:', err)),
    );
  }

  return new Response(null, {
    status: 302,
    headers: { Location: target, 'Cache-Control': 'no-store' },
  });
}

function shouldCount(request) {
  if (request.method !== 'GET') return false;
  // Browsers prefetching a link the user hasn't clicked.
  const purpose = request.headers.get('Sec-Purpose') || request.headers.get('Purpose') || '';
  if (purpose.includes('prefetch')) return false;
  return !BOTS.test(request.headers.get('User-Agent') || '');
}

async function stats(env) {
  try {
    const row = await env.DB.prepare('SELECT COALESCE(SUM(count), 0) AS total FROM downloads').first();
    return Response.json(
      { total: row.total },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  } catch (err) {
    console.error('Stats failed:', err);
    return Response.json({ error: 'unavailable' }, { status: 503 });
  }
}
