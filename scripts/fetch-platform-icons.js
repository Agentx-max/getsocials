#!/usr/bin/env node

/**
 * Downloads the real brand icons for every supported platform into
 * `frontend/public/platforms/` so the site does not depend on a third-party
 * favicon service at runtime.
 *
 * Run it whenever a platform is added or renamed:
 *   node scripts/fetch-platform-icons.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'frontend', 'public', 'platforms');

const PLATFORMS = [
  { id: 'snapchat', domain: 'snapchat.com' },
  { id: 'douyin', domain: 'douyin.com' },
  { id: 'youtube', domain: 'youtube.com' },
  { id: 'bilibili', domain: 'bilibili.com' },
  { id: 'kuaishou', domain: 'kuaishou.com' },
  { id: 'instagram', domain: 'instagram.com' },
  { id: 'facebook', domain: 'facebook.com' },
  { id: 'twitter', domain: 'x.com' },
  { id: 'threads', domain: 'threads.net' },
  { id: 'pinterest', domain: 'pinterest.com' },
  { id: 'reddit', domain: 'reddit.com' },
  { id: 'bluesky', domain: 'bsky.app' },
  { id: 'pornhub', domain: 'pornhub.com' },
  { id: 'ytmusic', domain: 'music.youtube.com' },
  { id: 'terabox', domain: 'terabox.com' },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let saved = 0;
  let failed = 0;

  for (const platform of PLATFORMS) {
    const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
      platform.domain
    )}&sz=128`;

    try {
      const { data, headers } = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 20000,
        headers: { 'user-agent': 'Mozilla/5.0' },
      });

      const type = headers['content-type'] || 'image/png';
      const ext = type.includes('jpeg') ? 'jpg' : type.includes('svg') ? 'svg' : 'png';
      const file = path.join(OUT_DIR, `${platform.id}.${ext}`);

      fs.writeFileSync(file, Buffer.from(data));
      console.log(`✅ ${platform.id.padEnd(12)} ${ext} ${data.byteLength}b`);
      saved++;
    } catch (err) {
      console.log(`❌ ${platform.id.padEnd(12)} ${err.message.slice(0, 60)}`);
      failed++;
    }
  }

  console.log(`\n${saved} icons saved, ${failed} failed -> ${OUT_DIR}`);
}

main();
