const axios = require("axios");
const oneApi = require("./oneApiClient");
const { runProbe } = require("./pythonBridge");

/**
 * Bilibili media service.
 *
 * Two strategies:
 *   1. OneAPI (https://getoneapi.com) when the operator has a subscription
 *      configured — see `ONEAPI_BASE_URL` and `ONEAPI_KEY`.
 *   2. yt-dlp, which ships a maintained set of Bilibili extractors and
 *      needs no account.
 */

const BILIBILI_HOSTS = ["bilibili.com", "b23.tv", "bilibili.tv", "acg.tv"];

/**
 * Checks that the URL points at Bilibili.
 * @param {string} url
 */
function isBilibiliUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return BILIBILI_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Extracts the BV id from a Bilibili URL.
 * @param {string} url
 * @returns {string|null}
 */
function extractBvId(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/(BV[0-9A-Za-z]{10})/);
    if (match) return match[1];

    // b23.tv short links carry the id in the path.
    const short = parsed.pathname.split('/').filter(Boolean)[0];
    if (short && /^BV[0-9A-Za-z]{10}$/.test(short)) return short;

    return null;
  } catch {
    return null;
  }
}

/** Strategy 1 — OneAPI. */
async function viaOneApi(url) {
  const bvId = extractBvId(url);
  if (!bvId) throw new Error('Could not find the BV id in that Bilibili URL.');

  const payload = await oneApi.request('/bilibili/video', { id: bvId });
  const data = oneApi.unwrap(payload);
  if (!data) throw new Error('The OneAPI service returned no data.');

  const videos = [];
  const audios = [];

  const add = (list, target) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const streamUrl = item?.url || item?.base_url || item?.backup_url_1;
      if (!streamUrl) continue;
      const size = item?.size || item?.bandwidth;
      target.push({
        quality:
          item?.quality ||
          item?.height ||
          item?.id ||
          (item?.codecid === 30280 ? 'Audio' : 'Video'),
        format: item?.codecs || 'mp4',
        url: streamUrl,
        sizeMB: size ? Math.round((size / 1024 / 1024) * 100) / 100 : null,
      });
    }
  };

  add(data.durl, videos);
  add(data.dash?.video, videos);
  add(data.dash?.audio, audios);

  if (!videos.length && !audios.length) {
    throw new Error('The OneAPI service returned no downloadable media.');
  }

  return {
    type: 'video',
    title: data.title || data.bvid || null,
    thumbnail: data.pic || data.cover || null,
    duration: data.duration ? Math.round(data.duration) : null,
    author: data.owner?.name || data.owner?.mid || null,
    videos,
    audios,
    images: [],
    downloads: [],
  };
}

/** Strategy 2 — yt-dlp. */
async function viaYtDlp(url) {
  const data = await runProbe('ytdlp', url, { timeout: 60000 });

  const videos = Array.isArray(data.videos) ? data.videos : [];
  const audios = Array.isArray(data.audios) ? data.audios : [];
  const images = Array.isArray(data.images) ? data.images : [];

  if (!videos.length && !audios.length && !images.length) {
    throw new Error('No downloadable media was found for this video.');
  }

  return {
    type: 'video',
    title: data.title || null,
    thumbnail: data.thumbnail || null,
    duration: typeof data.duration === 'number' ? Math.round(data.duration) : null,
    author: data.author || null,
    videos,
    audios,
    images,
    downloads: [],
  };
}

/**
 * Fetches media information for a Bilibili video.
 *
 * @param {string} url
 * @returns {Promise<object>} media payload
 */
async function fetchBilibiliData(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('A Bilibili URL must be provided');
  }

  if (!isBilibiliUrl(url)) {
    throw new Error('That does not look like a Bilibili URL');
  }

  const strategies = oneApi.isConfigured()
    ? [viaOneApi, viaYtDlp]
    : [viaYtDlp];

  let lastError = null;

  for (const strategy of strategies) {
    try {
      return await strategy(url);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Bilibili extraction failed');
}

module.exports = { fetchBilibiliData, isBilibiliUrl, extractBvId };
