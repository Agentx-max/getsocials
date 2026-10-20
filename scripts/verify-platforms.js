#!/usr/bin/env node

/**
 * Verifies that every supported platform can actually extract media.
 *
 * Each platform is probed with a public URL. The script reports whether URL
 * validation, metadata extraction and format discovery work, and whether the
 * returned media URLs are reachable.
 *
 * Usage:  node scripts/verify-platforms.js
 *         BASE=http://localhost:3000 node scripts/verify-platforms.js
 */

const http = require("http");
const https = require("https");
const { URL } = require("url");

const BASE = process.env.BASE || "http://localhost:3000";

/** A public URL per platform. Replace with fresh links when they expire. */
const TEST_URLS = {
  youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  bluesky: 'https://bsky.app/profile/bsky.app/post/3myapuxlwxk22',
  facebook: 'https://www.facebook.com/reel/10153317450565268',
  instagram: 'https://www.instagram.com/p/DLHQfPiyucu/',
  tumblr: 'https://www.tumblr.com/animalsarecool/170736080806',
  tiktok: 'https://www.tiktok.com/@tiktok/video/7241234567890123456',
  twitter: 'https://twitter.com/abc/status/1649311822720901126',
  reddit: 'https://www.reddit.com/r/videos/comments/1c3eb0q/dog_is_very_good_at_math/',
  soundcloud: 'https://soundcloud.com/uiceheidd/lucid-dream-forget-me',
  pinterest: 'https://www.pinterest.com/pin/98195702006833785/',
  linkedin: 'https://www.linkedin.com/posts/activity-7005761811640320000',
  threads: 'https://www.threads.net/@zuck/post/1789332131168243400',
  snapchat: 'https://www.snapchat.com/spotlight/W5W8nWLNyI',
  dailymotion: 'https://www.dailymotion.com/video/x2jvvep',
  capcut: 'https://www.capcut.com/tiktok/71Kw3Jq2/',
  douyin: 'https://www.douyin.com/video/7305804131080345902',
  kuaishou: 'https://www.kuaishou.com/short-video/3x8yz2nbm9cbty/',
  terabox: 'https://www.terabox.com/s/1d4be0c02c8d4f4a9d2a',
  spotify: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
};

function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const payload = body ? JSON.stringify(body) : null;

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
        timeout: 45000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

/** Checks that a media URL actually serves bytes. */
function headCheck(mediaUrl) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(mediaUrl);
    } catch {
      return resolve({ ok: false, error: 'invalid url' });
    }

    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'HEAD',
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          accept: '*/*',
        },
        timeout: 20000,
      },
      (res) => {
        res.resume();
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          length: Number(res.headers['content-length'] || 0),
          type: res.headers['content-type'],
        });
      }
    );

    req.on('error', (e) => resolve({ ok: false, error: e.code || e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
    req.end();
  });
}

async function main() {
  console.log('\n🔎 FluxSave platform verification');
  console.log(`   API: ${BASE}\n`);

  // Declared status per platform, straight from the backend registry.
  let declared = {};
  try {
    const r = await apiRequest('GET', '/api/platforms');
    declared = Object.fromEntries((r.body.data || []).map((p) => [p.id, p.status]));
  } catch (e) {
    console.log('   (could not read /api/platforms:', e.message, ')');
  }

  // Instagram and Facebook share the "meta" backend platform.
  const ALIAS = { facebook: 'meta', instagram: 'meta' };

  const results = [];

  for (const [platform, url] of Object.entries(TEST_URLS)) {
    process.stdout.write(`  ${platform.padEnd(12)} `);

    const key = ALIAS[platform] || platform;
    let validate = { ok: false, detail: '' };
    let media = { ok: false, detail: '' };
    let formats = 0;
    let reachable = null;

    try {
      const v = await apiRequest('POST', '/api/validate', { url });
      validate.ok = v.status === 200 && v.body?.success === true;
      validate.detail = validate.ok
        ? v.body.data.platform
        : v.body?.error || `HTTP ${v.status}`;
    } catch (e) {
      validate.detail = e.message;
    }

    try {
      const a = await apiRequest('POST', '/api/analyze', { url });
      if (a.status === 200 && a.body?.success) {
        const d = a.body.data;
        formats =
          (d.videos?.length || 0) +
          (d.audios?.length || 0) +
          (d.images?.length || 0) +
          (d.downloads?.length || 0);
        media.ok = true;
        media.detail = `${d.platform}${d.title ? ` — ${d.title.slice(0, 40)}` : ''}`;

        const first =
          d.videos?.[0] || d.audios?.[0] || d.images?.[0] || d.downloads?.[0];
        if (first?.url) {
          reachable = await headCheck(first.url);
        }
      } else {
        media.detail = a.body?.error || `HTTP ${a.status}`;
      }
    } catch (e) {
      media.detail = e.message;
    }

    results.push({
      platform,
      declared: declared[key] || '?',
      validate,
      media,
      formats,
      reachable,
    });

    const mediaIcon = media.ok ? (formats > 0 ? '✅' : '⚠️ ') : '❌';
    const reachIcon = reachable ? (reachable.ok ? '✅' : '⚠️ ') : '—';
    console.log(
      `${mediaIcon} ${String(declared[key] || '?').padEnd(9)} ${String(media.detail)
        .slice(0, 44)
        .padEnd(46)} formats=${String(formats).padStart(2)} media=${reachIcon}${
        reachable ? ` ${reachable.status || reachable.error}` : ''
      }`
    );
  }

  const working = results.filter((r) => r.formats > 0);
  const reachable = results.filter((r) => r.reachable?.ok);

  console.log('\n─────────────────────────────────────────');
  console.log(`  Platforms probed   : ${results.length}`);
  console.log(`  Returned formats  : ${working.length}`);
  console.log(`  Media reachable   : ${reachable.length}/${results.filter((r) => r.reachable).length}`);
  console.log('─────────────────────────────────────────');

  const mismatch = results.filter(
    (r) => r.declared === 'working' && r.formats === 0
  );
  if (mismatch.length) {
    console.log('\n  Declared working but returned no formats:');
    mismatch.forEach((m) => console.log(`    - ${m.platform}: ${m.media.detail}`));
  }

  const unexpected = results.filter(
    (r) => r.declared === 'blocked' && r.formats > 0
  );
  if (unexpected.length) {
    console.log('\n  Blocked but returned formats:');
    unexpected.forEach((m) => console.log(`    - ${m.platform}: ${m.formats} formats`));
  }
  console.log('');
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exitCode = 1;
});
