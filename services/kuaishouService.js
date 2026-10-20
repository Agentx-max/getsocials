const oneApi = require("./oneApiClient");
const { runProbe } = require("./pythonBridge");

/**
 * Kuaishou media service.
 *
 * Two strategies:
 *   1. OneAPI (https://getoneapi.com) when the operator has a subscription
 *      configured — see `ONEAPI_BASE_URL` and `ONEAPI_KEY`.
 *   2. yt-dlp, which is used as a generic fallback. Kuaishou is not one of
 *      yt-dlp's native extractors, so this only succeeds when the upstream
 *      service can be reached.
 */

const KUAISHOU_HOSTS = ['kuaishou.com', 'gifshow.com', 'chenzhongtech.com', 'kwai.com'];

/**
 * Checks that the URL points at Kuaishou.
 * @param {string} url
 */
function isKuaishouUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return KUAISHOU_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Extracts the short video id from a Kuaishou URL.
 * @param {string} url
 * @returns {string|null}
 */
function extractPhotoId(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/short-video\/([A-Za-z0-9_-]+)/);
    if (match) return match[1];

    const photoId = parsed.searchParams.get('photoId');
    if (photoId) return photoId;

    const segments = parsed.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    return last && /^[A-Za-z0-9_-]{6,}$/.test(last) ? last : null;
  } catch {
    return null;
  }
}

/** Strategy 1 — OneAPI. */
async function viaOneApi(url) {
  const photoId = extractPhotoId(url);
  if (!photoId) throw new Error('Could not find the video id in that Kuaishou URL.');

  const payload = await oneApi.request('/kuaishou/video', { id: photoId });
  const data = oneApi.unwrap(payload);
  if (!data) throw new Error('The OneAPI service returned no data.');

  const videos = [];
  const audios = [];

  const add = (list, target) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const streamUrl = item?.url || item?.photoUrl || item?.playUrl;
      if (!streamUrl) continue;
      const size = item?.size;
      target.push({
        quality: item?.quality || item?.label || item?.id || 'Video',
        format: item?.format || 'mp4',
        url: streamUrl,
        sizeMB: size ? Math.round((size / 1024 / 1024) * 100) / 100 : null,
      });
    }
  };

  add(data.photo?.adaptationSet, videos);
  add(data.photo?.photoUrl ? [data.photo.photoUrl] : [], videos);
  add(data.photo?.audioSet, audios);
  add(data.video?.adaptationSet, videos);

  if (!videos.length && !audios.length) {
    throw new Error('The OneAPI service returned no downloadable media.');
  }

  return {
    type: 'video',
    title: data.photo?.caption || data.caption || null,
    thumbnail: data.photo?.coverUrl || data.coverUrl || null,
    duration: data.photo?.duration ? Math.round(data.photo.duration) : null,
    author: data.author?.name || null,
    videos,
    audios,
    images: [],
    downloads: [],
  };
}

/** Strategy 2 — yt-dlp as a generic fallback. */
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
 * Fetches media information for a Kuaishou video.
 *
 * @param {string} url
 * @returns {Promise<object>} media payload
 */
async function fetchKuaishouData(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('A Kuaishou URL must be provided');
  }

  if (!isKuaishouUrl(url)) {
    throw new Error('That does not look like a Kuaishou URL');
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

  throw lastError || new Error('Kuaishou extraction failed');
}

module.exports = { fetchKuaishouData, isKuaishouUrl, extractPhotoId };
