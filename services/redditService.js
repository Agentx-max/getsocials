const axios = require("axios");

/**
 * Reddit media service.
 *
 * Reddit's own JSON API is aggressively rate limited and blocks many hosting
 * providers, so the post is resolved through the authless RedDownloader API
 * instead — the same service the RedDownloader project uses.
 *
 * That service returns the post's real media target:
 *   - `v.redd.it/...`  → Reddit hosted video
 *   - `i.redd.it/...`  → Reddit hosted image or gif
 *   - `/gallery/...`   → gallery post
 *   - a YouTube / Imgur link → handed to yt-dlp by the caller
 */

const API = "https://jackhammer.pythonanywhere.com";

const REDDIT_HOSTS = ["reddit.com", "old.reddit.com", "redd.it"];

/**
 * Checks that the URL points at Reddit.
 * @param {string} url
 */
function isRedditUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return REDDIT_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Queries one of the RedDownloader API endpoints.
 *
 * @param {string} path
 * @param {string} url
 * @returns {Promise<string>}
 */
async function query(path, url) {
  const { data } = await axios.get(`${API}${path}`, {
    params: { url },
    timeout: 30000,
    headers: { accept: "text/plain, */*" },
    transformResponse: [(d) => d],
  });

  const text = String(data).trim();
  if (!text || text.length > 500) {
    throw new Error("The Reddit resolver returned an empty response");
  }
  return text;
}

/**
 * Builds a quality list for a Reddit hosted video.
 *
 * Reddit serves DASH streams, so every available resolution is offered.
 */
function redditVideoFormats(baseUrl) {
  // https://v.redd.it/<id> → https://v.redd.it/<id>/DASH_1080.mp4
  const match = baseUrl.match(/^(https?:\/\/v\.redd\.it\/[^/?#]+)/);
  if (!match) return [];

  const base = match[1];
  const qualities = [
    { label: '1080p', file: 'DASH_1080.mp4' },
    { label: '720p', file: 'DASH_720.mp4' },
    { label: '480p', file: 'DASH_480.mp4' },
    { label: '360p', file: 'DASH_360.mp4' },
    { label: '240p', file: 'DASH_240.mp4' },
    { label: '144p', file: 'DASH_144.mp4' },
  ];

  return qualities.map((q) => ({
    quality: q.label,
    format: 'mp4',
    url: `${base}/${q.file}`,
    sizeMB: null,
  }));
}

/**
 * Fetches media information for a Reddit post.
 *
 * @param {string} url
 * @returns {Promise<object>} media payload
 */
async function redditDownloader(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('A Reddit URL must be provided');
  }

  if (!isRedditUrl(url)) {
    throw new Error(
      'That does not look like a Reddit post URL. Expected https://www.reddit.com/r/<subreddit>/comments/<id>/...'
    );
  }

  const [mediaTarget, title, author] = await Promise.all([
    query('/reddit/media/downloader', url).catch(() => null),
    query('/reddit/media/title', url).catch(() => null),
    query('/reddit/media/author', url).catch(() => null),
  ]);

  if (!mediaTarget) {
    throw new Error(
      'No media was found for this Reddit post. It may have been removed or contain only text.'
    );
  }

  const videos = [];
  const images = [];
  const downloads = [];

  if (mediaTarget.includes('v.redd.it')) {
    videos.push(...redditVideoFormats(mediaTarget));
  } else if (mediaTarget.includes('/gallery/')) {
    const gallery = await query('/reddit/media/gallery', url).catch(() => '');
    const found = gallery.match(/https?:\/\/[^\s"']+?\.(?:jpe?g|png|gif)/gi) || [];
    found.forEach((imageUrl) => {
      images.push({ quality: 'Original', format: 'jpg', url: imageUrl, sizeMB: null });
    });
  } else if (mediaTarget.includes('i.redd.it')) {
    const isGif = /\.gifv?$/i.test(mediaTarget);
    images.push({
      quality: 'Original',
      format: isGif ? 'gif' : 'jpg',
      url: mediaTarget,
      sizeMB: null,
    });
  } else if (/^https?:\/\//.test(mediaTarget)) {
    // The post links out (YouTube, Imgur, ...). Hand it to the generic
    // extractor, which knows how to handle those.
    downloads.push({
      quality: title || 'Linked media',
      format: 'mp4',
      url: mediaTarget,
      sizeMB: null,
    });
  }

  if (!videos.length && !images.length && !downloads.length) {
    throw new Error('No downloadable media was found for this Reddit post.');
  }

  return {
    type: videos.length ? 'video' : 'photo',
    title: title || null,
    thumbnail: images[0]?.url || null,
    duration: null,
    author: author || null,
    videos,
    audios: [],
    images,
    downloads,
  };
}

module.exports = { redditDownloader, isRedditUrl };
