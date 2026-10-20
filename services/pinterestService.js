const { runProbe } = require("./pythonBridge");

/**
 * Pinterest media service.
 *
 * Uses the `pinterest-downloader` library through the Python bridge — the
 * same engine the PinterestDownloader project ships. It needs no API key and
 * works with public pins.
 */

const PINTEREST_HOSTS = ["pinterest.com", "pin.it"];

/**
 * Checks that the URL points at Pinterest.
 * @param {string} url
 */
function isPinterestUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return PINTEREST_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Fetches media information for a Pinterest pin.
 *
 * @param {string} url
 * @returns {Promise<object>} media payload
 */
async function fetchPinterestMedia(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('A Pinterest URL must be provided');
  }

  if (!isPinterestUrl(url)) {
    throw new Error('That does not look like a Pinterest URL');
  }

  const data = await runProbe('pinterest', url, { timeout: 45000 });

  const videos = Array.isArray(data.videos) ? data.videos : [];
  const images = Array.isArray(data.images) ? data.images : [];

  if (!videos.length && !images.length) {
    throw new Error('No downloadable media was found for this pin.');
  }

  return {
    type: videos.length ? 'video' : 'photo',
    title: data.title || null,
    thumbnail: data.thumbnail || null,
    duration: null,
    author: data.author || null,
    videos,
    audios: [],
    images,
    downloads: [],
  };
}

module.exports = { fetchPinterestMedia, isPinterestUrl };
