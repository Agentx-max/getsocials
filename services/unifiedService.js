/**
 * Unified analysis service.
 *
 * Wraps the existing per-platform controllers behind a single, consistently
 * shaped contract so the frontend only has to deal with one response format.
 * The platform-specific extraction logic in `services/` is reused as-is.
 */

const {
  detectPlatform,
  getPlatformDisplayName,
  getPlatformHandler,
} = require('../config/platforms');
const { signMediaUrl } = require('./mediaToken');
const { fetchWithYtDlp, isSupported: ytDlpSupports } = require('./ytDlpService');

/**
 * Cleans up an upstream error so we never echo a whole HTML page or a long
 * stack trace back to the client.
 *
 * @param {unknown} error
 * @returns {string} a short, safe message
 */
function safeErrorMessage(error) {
  if (!error) return 'The upstream service could not be reached.';

  let message =
    typeof error === 'string'
      ? error
      : typeof error.message === 'string'
      ? error.message
      : String(error);

  // Upstream HTML pages are not useful and can be enormous.
  if (message.includes('<!DOCTYPE') || message.includes('<html')) {
    const title = message.match(/<title[^>]*>([^<]*)<\/title>/i);
    message = title
      ? `The upstream service returned an error page (${title[1].trim()}).`
      : 'The upstream service returned an error page.';
  }

  message = message.replace(/\s+/g, ' ').trim();

  if (message.length > 200) {
    message = `${message.slice(0, 197)}...`;
  }

  return message || 'The upstream service could not be reached.';
}

/**
 * Runs a platform controller against a mock req/res pair and captures the
 * result. This lets us reuse the existing controllers (which were written
 * for Express) without duplicating their logic.
 *
 * @param {Function} handler
 * @param {string} url
 * @returns {Promise<{status: number, body: any}>}
 */
async function invokeHandler(handler, url) {
  const mockReq = { query: { url }, requestId: 'internal' };
  const mockRes = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  await handler(mockReq, mockRes);

  return { status: mockRes.statusCode, body: mockRes.body };
}

/**
 * Converts the various raw platform response shapes into one MediaInfo shape.
 * Only values present in the upstream response are carried over.
 *
 * @param {any} data raw controller/service payload
 * @param {string} platform platform key
 * @param {string} originalUrl
 */
function normalizeMedia(data, platform, originalUrl) {
  const display = getPlatformDisplayName(platform);

  const empty = {
    type: 'video',
    title: null,
    thumbnail: null,
    duration: null,
    platform: display,
    url: originalUrl,
    videos: [],
    audios: [],
    images: [],
    downloads: [],
  };

  // Some endpoints (e.g. reddit) return a bare download URL string.
  if (typeof data === 'string') {
    return {
      ...empty,
      type: 'mixed',
      downloads: [{ url: data, quality: 'Original', format: 'unknown' }],
    };
  }

  if (!data || typeof data !== 'object') return empty;

  const toFormats = (list) => {
    if (!Array.isArray(list)) return [];
    return list
      .map((item) => {
        if (typeof item === 'string') return { url: item };
        if (!item || typeof item !== 'object') return null;
        const o = item;
        const url = o.url || o.download_url || o.src;
        if (typeof url !== 'string' || !url) return null;
        return {
          url,
          quality: o.quality || o.resolution || null,
          format: o.format || o.ext || null,
          sizeMB:
            typeof o.sizeMB === 'number'
              ? o.sizeMB
              : typeof o.size === 'number'
              ? Math.round((o.size / 1024 / 1024) * 100) / 100
              : null,
          text: o.text || null,
        };
      })
      .filter(Boolean);
  };

  const media = {
    type: typeof data.type === 'string' ? data.type : 'video',
    title: data.title || null,
    thumbnail: data.thumbnail || null,
    duration: typeof data.duration === 'number' ? data.duration : null,
    platform: display,
    url: originalUrl,
    videos: toFormats(data.videos),
    audios: toFormats(data.audios),
    images: toFormats(data.images),
    downloads: toFormats(data.downloads),
  };

  if (media.videos.length > 0) media.type = 'video';
  else if (media.audios.length > 0) media.type = 'audio';
  else if (media.images.length > 0) media.type = 'photo';
  else if (media.downloads.length > 0) media.type = 'mixed';

  // Attach a signed token to every format so the streaming endpoint can
  // serve it without turning this service into an open proxy. The source page
  // is included so an expired media URL can be re-resolved on demand.
  const attachTokens = (list) =>
    list.map((format) => ({
      ...format,
      token:
        typeof format.url === 'string'
          ? signMediaUrl(format.url, originalUrl)
          : null,
    }));

  media.videos = attachTokens(media.videos);
  media.audios = attachTokens(media.audios);
  media.images = attachTokens(media.images);
  media.downloads = attachTokens(media.downloads);

  return media;
}

/**
 * Analyses a media URL.
 *
 * @param {string} url
 * @returns {Promise<{ok: boolean, status: number, media?: object, error?: string}>}
 */
async function analyzeUrl(url) {
  const platform = detectPlatform(url);

  if (!platform) {
    return { ok: false, status: 400, error: 'Unsupported platform' };
  }

  const handler = getPlatformHandler(platform);
  if (!handler) {
    return {
      ok: false,
      status: 501,
      error: `Platform "${platform}" is not available on this deployment`,
    };
  }

  /**
   * yt-dlp keeps independent extractors for most platforms. When the
   * platform's own scraper fails or finds nothing, this is the second
   * chance. It only ever reads metadata.
   *
   * `linkedUrl` is used when a post points at another site (for example a
   * Reddit post linking to a YouTube video).
   */
  const tryFallback = async (linkedUrl) => {
    const target = linkedUrl || url;
    if (!ytDlpSupports(target)) return null;
    try {
      const fallback = await fetchWithYtDlp(target);
      const media = normalizeMedia(fallback, platform, url);
      const hasFormat =
        media.videos.length > 0 ||
        media.audios.length > 0 ||
        media.images.length > 0 ||
        media.downloads.length > 0;
      return hasFormat ? media : null;
    } catch (err) {
      console.warn(`yt-dlp fallback for ${platform} failed: ${err.message}`);
      return null;
    }
  };

  let status = 200;
  let body = null;

  try {
    const result = await invokeHandler(handler, url);
    status = result.status;
    body = result.body;
  } catch (err) {
    status = 500;
    body = { error: err.message };
  }

  if (status >= 400) {
    const fallbackMedia = await tryFallback();
    if (fallbackMedia) {
      return { ok: true, status: 200, media: fallbackMedia, empty: false, viaFallback: true };
    }

    return {
      ok: false,
      status,
      error: safeErrorMessage((body && body.error) || 'Failed to analyze media'),
    };
  }

  const raw = body && typeof body === 'object' && 'data' in body ? body.data : body;

  if (raw === null || raw === undefined) {
    const fallbackMedia = await tryFallback();
    if (fallbackMedia) {
      return { ok: true, status: 200, media: fallbackMedia, empty: false, viaFallback: true };
    }
    return { ok: false, status: 502, error: 'Upstream service returned an empty response' };
  }

  const media = normalizeMedia(raw, platform, url);

  const hasAnyFormat =
    media.videos.length > 0 ||
    media.audios.length > 0 ||
    media.images.length > 0 ||
    media.downloads.length > 0;

  if (hasAnyFormat) {
    return {
      ok: true,
      status: 200,
      media,
      empty: false,
    };
  }

  // The platform's own scraper answered but found no media. yt-dlp keeps
  // independent extractors for most of these platforms, so try it before
  // giving up.
  {
    // If the post points at another site, follow that link instead.
    const linked = media.downloads.find((d) => d.url && d.url !== url)?.url;
    const fallbackMedia = await tryFallback(linked);
    if (fallbackMedia) {
      return {
        ok: true,
        status: 200,
        media: fallbackMedia,
        empty: false,
        viaFallback: true,
      };
    }
  }

  return {
    ok: true,
    status: 200,
    media,
    empty: true,
  };
}

/**
 * Collects every available output format for a URL.
 *
 * @param {string} url
 */
async function listFormats(url) {
  const result = await analyzeUrl(url);
  if (!result.ok) return result;

  const { media } = result;
  return {
    ok: true,
    status: 200,
    formats: [
      ...media.videos,
      ...media.audios,
      ...media.images,
      ...media.downloads,
    ],
  };
}

module.exports = {
  analyzeUrl,
  listFormats,
  normalizeMedia,
  safeErrorMessage,
};
