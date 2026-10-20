const { runProbe } = require("./pythonBridge");

/**
 * Generic yt-dlp extraction service.
 *
 * yt-dlp has maintained, up-to-date extractors for most of the platforms
 * here. It is used as a fallback when a platform's own scraper fails, which
 * keeps the service working when an upstream site changes its markup.
 *
 * If the operator provides their own session cookie file (see
 * `IG_COOKIE_FILE`) it is used for the platforms that refuse anonymous
 * access. Visitor cookies are never used or accepted.
 */

const SUPPORTED_HOSTS = [
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'instagram.com',
  'instagr.am',
  'facebook.com',
  'fb.watch',
  'fb.com',
  'twitter.com',
  'x.com',
  'reddit.com',
  'redd.it',
  'threads.net',
  'threads.com',
  'soundcloud.com',
  'spotify.com',
  'pinterest.com',
  'pin.it',
  'tumblr.com',
  'linkedin.com',
  'dailymotion.com',
  'douyin.com',
  'bilibili.com',
  'vk.com',
  'ted.com',
  'vimeo.com',
];

/**
 * Checks that the URL is one yt-dlp could plausibly handle.
 * @param {string} url
 */
function isSupported(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return SUPPORTED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Extracts media information for a URL using yt-dlp.
 *
 * @param {string} url
 * @returns {Promise<object>} media payload
 */
async function fetchWithYtDlp(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('A URL must be provided');
  }

  if (!isSupported(url)) {
    throw new Error('This URL is not supported by the fallback extractor');
  }

  const data = await runProbe('ytdlp', url, { timeout: 60000 });

  const videos = Array.isArray(data.videos) ? data.videos : [];
  const audios = Array.isArray(data.audios) ? data.audios : [];
  const images = Array.isArray(data.images) ? data.images : [];

  if (!videos.length && !audios.length && !images.length) {
    throw new Error('No downloadable media was found for this post.');
  }

  return {
    type: videos.length ? 'video' : images.length ? 'photo' : 'audio',
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

module.exports = { fetchWithYtDlp, isSupported, SUPPORTED_HOSTS };
