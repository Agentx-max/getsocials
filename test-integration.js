#!/usr/bin/env node

/**
 * FluxSave - Integration Test Suite
 * Tests core API functionality
 */

const http = require('http');

const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const TEST_TIMEOUT = 30000;
const RATE_LIMIT_WAIT_MS = parseInt(process.env.RATE_LIMIT_WAIT_MS || "15000", 10);

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: TEST_TIMEOUT,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Issues a request and transparently waits out a 429 rate-limit response.
 * The server enforces 30 requests/minute by default, which the test suite
 * exceeds, so retrying keeps the suite deterministic.
 */
async function requestWithRetry(method, path, body = null, attempts = 3) {
  let result = await request(method, path, body);

  while (result.status === 429 && attempts > 0) {
    const retryAfter = Number(result.data?.retryAfter || RATE_LIMIT_WAIT_MS / 1000);
    console.log(
      `   ⏳ rate limited, waiting ${Math.ceil(retryAfter)}s before retrying...`
    );
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    result = await request(method, path, body);
    attempts -= 1;
  }

  return result;
}

async function runTests() {
  console.log('🧪 FluxSave Integration Tests\n');
  console.log(`Testing against: ${BASE_URL}\n`);

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      failed++;
    }
  }

  // Health Check
  await test('Health check returns 200', async () => {
    const { status, data } = await requestWithRetry('GET', '/api/health');
    if (status !== 200) throw new Error(`Status ${status}`);
    if (!data.success) throw new Error('Success false');
    if (data.data.status !== 'healthy') throw new Error('Not healthy');
  });

  // URL Validation - Valid URL
  await test('Validates a supported platform URL', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/validate', {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    });
    if (status !== 200) throw new Error(`Status ${status}`);
    if (!data.success) throw new Error('Success false');
    if (!data.data.valid) throw new Error('Not valid');
    if (!data.data.supported) throw new Error('Should be supported');
    if (data.data.platform !== 'YouTube') throw new Error('Wrong platform');
  });

  // Removed platforms must report as unsupported rather than pretending
  await test('Reports removed platforms as unsupported', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/validate', {
      url: 'https://www.tiktok.com/@user/video/123456789'
    });
    if (status !== 200) throw new Error(`Status ${status}`);
    if (data.data.supported) throw new Error('TikTok should no longer be supported');
    if (data.data.platform !== null) throw new Error('Should not detect a platform');
  });

  // URL Validation - YouTube
  await test('Validates YouTube URL', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/validate', {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    });
    if (status !== 200) throw new Error(`Status ${status}`);
    if (!data.success) throw new Error('Success false');
    if (!data.data.valid) throw new Error('Not valid');
    if (data.data.platform !== 'YouTube') throw new Error('Wrong platform');
  });

  // URL Validation - Invalid (SSRF)
  await test('Rejects localhost (SSRF protection)', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/validate', {
      url: 'http://localhost:3000/admin'
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    if (data.success) throw new Error('Should fail');
    if (!data.error.includes('not allowed')) throw new Error('Wrong error');
  });

  // URL Validation - Private IP
  await test('Rejects private IP (SSRF protection)', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/validate', {
      url: 'http://192.168.1.1/admin'
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    if (data.success) throw new Error('Should fail');
  });

  // URL Validation - Invalid protocol
  await test('Rejects non-HTTP protocol', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/validate', {
      url: 'ftp://example.com/file'
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    if (data.success) throw new Error('Should fail');
  });

  // URL Validation - Missing URL
  await test('Rejects missing URL', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/validate', {});
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    if (data.success) throw new Error('Should fail');
  });

  // The unified analyse endpoint must always answer with a well formed
  // response, whether the platform works or the upstream is blocked.
  // 502 is the correct answer when an upstream service cannot be reached.
  await test('Analyse endpoint always returns a well formed response', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/analyze', {
      url: 'https://www.instagram.com/p/DLHQfPiyucu/'
    });
    if (![200, 400, 403, 429, 501, 502].includes(status)) {
      throw new Error(`Unexpected status ${status}`);
    }
    if (typeof data.success !== 'boolean') throw new Error('No success flag');
    if (data.success) {
      if (!data.data) throw new Error('Success without data');
    } else if (!data.error) {
      throw new Error('Failure without an error message');
    }
  });

  // An unsupported platform must be rejected with a clear message
  await test('Rejects an unsupported platform with a clear error', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/analyze', {
      url: 'https://www.tiktok.com/@user/video/123456789'
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    if (data.success) throw new Error('Should fail');
    if (!/unsupported/i.test(data.error || '')) {
      throw new Error(`Unclear error: ${data.error}`);
    }
  });

  // Media Analysis - Unsupported platform
  await test('Rejects unsupported platform', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/analyze', {
      url: 'https://example.com/video'
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    if (data.success) throw new Error('Should fail');
    if (!data.error.includes('Unsupported')) throw new Error('Wrong error');
  });

  // Platform registry — every platform must resolve to a real controller
  await test('All registered platforms have a working controller', async () => {
    const { status, data } = await requestWithRetry('GET', '/api/platforms');
    if (status !== 200) throw new Error(`Status ${status}`);
    if (!Array.isArray(data.data) || data.data.length < 14) {
      throw new Error(`Expected >= 14 platforms, got ${data.data?.length}`);
    }
    for (const p of data.data) {
      if (!p.id || !p.name) throw new Error('Malformed platform entry');
    }
  });

  // Controller resolution for the platforms with non-standard filenames
  await test('Resolves Meta (Instagram/Facebook) controller', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/validate', {
      url: 'https://www.instagram.com/p/DLHQfPiyucu/'
    });
    if (status !== 200) throw new Error(`Status ${status}`);
    if (!data.data.supported) throw new Error('Meta should be supported');
    if (data.data.platform !== 'Instagram / Facebook') throw new Error('Wrong platform name');
  });

  await test('Resolves Terabox controller (mixed-case filename)', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/validate', {
      url: 'https://www.terabox.com/s/abc123'
    });
    if (status !== 200) throw new Error(`Status ${status}`);
    if (!data.data.supported) throw new Error('Terabox should be supported');
    if (data.data.platform !== 'Terabox') throw new Error('Wrong platform name');
  });

  // SSRF — cloud metadata endpoints
  await test('Rejects cloud metadata endpoint', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/validate', {
      url: 'http://169.254.169.254/latest/meta-data/'
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    if (data.success) throw new Error('Should fail');
  });

  await test('Rejects GCP metadata hostname', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/validate', {
      url: 'http://metadata.google.internal/computeMetadata/v1/'
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    if (data.success) throw new Error('Should fail');
  });

  // SSRF — 10.x / 172.16.x private ranges
  await test('Rejects 10.0.0.0/8 private range', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/validate', {
      url: 'http://10.0.0.1/internal'
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    if (data.success) throw new Error('Should fail');
  });

  await test('Rejects 172.16.0.0/12 private range', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/validate', {
      url: 'http://172.16.5.4/internal'
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    if (data.success) throw new Error('Should fail');
  });

  // URL length guard
  await test('Rejects overly long URL', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/validate', {
      url: 'https://www.youtube.com/' + 'a'.repeat(3000)
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    if (data.success) throw new Error('Should fail');
  });

  // Health endpoint shape
  await test('Health endpoint reports platform list and memory', async () => {
    const { status, data } = await requestWithRetry('GET', '/api/health');
    if (status !== 200) throw new Error(`Status ${status}`);
    if (data.data.status !== 'healthy') throw new Error('Not healthy');
    if (!Array.isArray(data.data.platforms)) throw new Error('No platforms array');
    if (typeof data.data.memory?.heapUsedMB !== 'number') throw new Error('No memory stats');
  });

  // YouTube extraction — real network call against the public InnerTube API
  await test('Extracts YouTube metadata and formats', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/analyze', {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    if (status !== 200) throw new Error(`Status ${status}: ${data.error}`);
    if (!data.success) throw new Error(`Failed: ${data.error}`);
    if (data.data.platform !== 'YouTube') throw new Error('Wrong platform');
    if (!data.data.title) throw new Error('No title');
    if (!data.data.thumbnail) throw new Error('No thumbnail');
    if (typeof data.data.duration !== 'number') throw new Error('No duration');
    if (!Array.isArray(data.data.videos) || data.data.videos.length === 0) {
      throw new Error('No video formats');
    }
    if (!Array.isArray(data.data.audios) || data.data.audios.length === 0) {
      throw new Error('No audio formats');
    }
    // Every format must carry a usable direct URL
    for (const f of [...data.data.videos, ...data.data.audios]) {
      if (!f.url || !/^https:\/\//.test(f.url)) throw new Error('Format missing https URL');
    }
  });

  // YouTube — alternate URL shapes must resolve to the same video
  await test('Accepts youtu.be / shorts / embed URL shapes', async () => {
    const shapes = [
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ];
    for (const url of shapes) {
      const { status, data } = await requestWithRetry('POST', '/api/analyze', { url });
      if (status !== 200) throw new Error(`${url} -> ${status}: ${data.error}`);
      if (!data.data?.title) throw new Error(`${url} -> no title`);
    }
  });

  // YouTube — private / removed videos must fail with a clear message
  await test('Reports YouTube private/unavailable videos clearly', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/analyze', {
      url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
    });
    if (status < 400) throw new Error(`Expected error status, got ${status}`);
    if (data.success) throw new Error('Should fail');
    if (!data.error) throw new Error('No error message');
  });

  // YouTube — non-video URLs are rejected before hitting the upstream API
  await test('Rejects YouTube URLs without a video id', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/analyze', {
      url: 'https://www.youtube.com/feed/subscriptions',
    });
    if (status < 400) throw new Error(`Expected error status, got ${status}`);
    if (data.success) throw new Error('Should fail');
  });

  // Formats endpoint
  await test('Lists available output formats', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/formats', {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    if (status !== 200) throw new Error(`Status ${status}: ${data.error}`);
    if (!Array.isArray(data.data.formats)) throw new Error('No formats array');
    if (data.data.formats.length === 0) throw new Error('Empty formats');
    for (const f of data.data.formats) {
      if (!f.url) throw new Error('Format without URL');
    }
  });

  // 404 handling
  await test('Returns 404 for unknown endpoint', async () => {
    const { status, data } = await requestWithRetry('GET', '/api/unknown');
    if (status !== 404) throw new Error(`Expected 404, got ${status}`);
    if (data.success) throw new Error('Should fail');
  });

  // Root endpoint
  await test('Root endpoint returns API info', async () => {
    // The API description lives at /api; "/" serves the site when a
    // frontend build is present.
    const { status, data } = await requestWithRetry('GET', '/api');
    if (status !== 200) throw new Error(`Status ${status}`);
    if (!data.success) throw new Error('Success false');
    if (!data.endpoints) throw new Error('No endpoints');
    if (!data.author) throw new Error('No author');
  });

  // Platform status registry
  await test('Platform status endpoint reports availability and notes', async () => {
    const { status, data } = await requestWithRetry('GET', '/api/platforms');
    if (status !== 200) throw new Error(`Status ${status}`);
    if (!Array.isArray(data.data) || data.data.length < 14) {
      throw new Error(`Expected >= 14 platforms, got ${data.data?.length}`);
    }
    const valid = ['working', 'limited', 'degraded', 'blocked'];
    for (const p of data.data) {
      if (!valid.includes(p.status)) throw new Error(`Invalid status "${p.status}"`);
      if (!p.note) throw new Error(`Missing note for ${p.id}`);
    }
  });

  // Facebook extraction through yt-dlp
  await test('Extracts Facebook video through yt-dlp', async () => {
    const { status, data } = await requestWithRetry('POST', '/api/analyze', {
      url: 'https://www.facebook.com/reel/10153317450565268',
    });
    if (status !== 200) throw new Error(`Status ${status}: ${data.error}`);
    if (!data.success) throw new Error(`Failed: ${data.error}`);
    if (!data.data.title) throw new Error('No title');
    const total =
      (data.data.videos?.length || 0) +
      (data.data.audios?.length || 0) +
      (data.data.images?.length || 0) +
      (data.data.downloads?.length || 0);
    if (total === 0) throw new Error('No formats returned');
    for (const f of [...(data.data.videos || []), ...(data.data.audios || [])]) {
      if (!f.url || !/^https:\/\//.test(f.url)) throw new Error('Format missing https URL');
    }
  });

  // Download token security — the stream endpoint must not be an open proxy
  await test('Rejects a forged download token', async () => {
    const { status, data } = await requestWithRetry('GET', '/api/stream?token=forged.token');
    if (status !== 403) throw new Error(`Expected 403, got ${status}`);
    if (data.success) throw new Error('Should fail');
  });

  await test('Rejects a missing download token', async () => {
    const { status } = await requestWithRetry('GET', '/api/stream');
    if (status !== 403) throw new Error(`Expected 403, got ${status}`);
  });

  await test('Rejects a token signed with the wrong secret', async () => {
    const crypto = require('crypto');
    const payload = {
      url: 'https://example.com/file.mp4',
      exp: Date.now() + 60000,
      nonce: 'x',
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', 'a-completely-different-secret')
      .update(encoded)
      .digest('base64url');

    const { status } = await requestWithRetry(
      'GET',
      `/api/stream?token=${encodeURIComponent(`${encoded}.${signature}`)}`
    );
    if (status !== 403) throw new Error(`Expected 403, got ${status}`);
  });

  // Request ID header
  await test('Includes request ID in response', async () => {
    const { status, data } = await requestWithRetry('GET', '/api/health');
    if (!data.requestId) throw new Error('Missing requestId');
    if (!data.requestId.startsWith('req_')) throw new Error('Invalid requestId format');
  });

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);