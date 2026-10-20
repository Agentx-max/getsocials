/**
 * Platform registry.
 *
 * Each entry maps a platform key to the controller that handles it, the
 * exported handler name, and a human readable display name. An explicit map
 * is used instead of deriving the controller filename from the platform key
 * because several controllers do not follow the `<platform>Controller` naming
 * convention (e.g. Meta is `metaController`), and filename casing differs
 * between platforms (e.g. `TeraboxController`).
 */

/**
 * Per-platform availability.
 *
 * `working`  — extraction verified end to end (metadata + downloadable media)
 * `limited`  — the integration answers, but only some media types come back
 * `degraded` — the integration works, but the upstream service is unreliable
 * `blocked`  — the platform no longer allows anonymous extraction
 */
const STATUS = {
  working: 'working',
  limited: 'limited',
  degraded: 'degraded',
  blocked: 'blocked',
};

const PLATFORMS = {
  bilibili: {
    controller: '../controllers/bilibiliController',
    handler: 'handleBilibiliDownload',
    display: 'Bilibili',
    status: STATUS.working,
    note: 'Video and audio streams via yt-dlp, or OneAPI when it is configured.',
  },
  bluesky: {
    controller: '../controllers/blueskyController',
    handler: 'handleBlueskyDownload',
    display: 'Bluesky',
    status: STATUS.working,
    note: 'Uses the public Bluesky API — no third-party scraper.',
  },
  douyin: {
    controller: '../controllers/douyinController',
    handler: 'handleDouyinDownload',
    display: 'Douyin',
    status: STATUS.degraded,
    note: 'Depends on a third-party extractor that changes often.',
  },
  kuaishou: {
    controller: '../controllers/kuaishouController',
    handler: 'handleKuaishouDownload',
    display: 'Kuaishou',
    status: STATUS.working,
    note: 'Needs a OneAPI subscription (ONEAPI_BASE_URL); falls back to yt-dlp.',
  },
  meta: {
    controller: '../controllers/metaController',
    handler: 'handleMetaDownload',
    display: 'Instagram / Facebook',
    status: STATUS.limited,
    note: 'Instagram needs the operator’s own session (IG_SESSION_FILE); Facebook works via yt-dlp.',
  },
  pinterest: {
    controller: '../controllers/pinterestController',
    handler: 'handlePinterestDownload',
    display: 'Pinterest',
    status: STATUS.working,
    note: 'Original images, GIFs and video pins via the PinterestDownloader engine.',
  },
  pornhub: {
    controller: '../controllers/pornhubController',
    handler: 'handlePornhubDownload',
    display: 'Pornhub',
    status: STATUS.working,
    note: 'Video in every available quality. 18+ only.',
  },
  reddit: {
    controller: '../controllers/redditController',
    handler: 'handleRedditDownload',
    display: 'Reddit',
    status: STATUS.working,
    note: 'Video, images and galleries via the authless RedDownloader API.',
  },
  snapchat: {
    controller: '../controllers/snapchatController',
    handler: 'handleSnapchat',
    display: 'Snapchat',
    status: STATUS.limited,
    note: 'Spotlight posts only.',
  },
  terabox: {
    controller: '../controllers/TeraboxController',
    handler: 'handleTeraboxDownload',
    display: 'Terabox',
    status: STATUS.working,
    note: 'Direct file links via Terabox’s own share API.',
  },
  threads: {
    controller: '../controllers/threadsController',
    handler: 'handleThreadsDownload',
    display: 'Threads',
    status: STATUS.working,
    note: 'Media is served by the Threads web client, with yt-dlp as a fallback.',
  },
  twitter: {
    controller: '../controllers/twitterController',
    handler: 'handleTwitterDownload',
    display: 'Twitter / X',
    status: STATUS.working,
    note: 'Media is served by the X web client, with yt-dlp as a fallback.',
  },
  youtube: {
    controller: '../controllers/youtubeController',
    handler: 'handleYouTubeDownload',
    display: 'YouTube',
    status: STATUS.working,
    note: 'Up to 4K, plus separate audio tracks.',
  },
  ytmusic: {
    controller: '../controllers/ytmusicController',
    handler: 'handleYtMusicDownload',
    display: 'YouTube Music',
    status: STATUS.working,
    note: 'Audio streams only, with the original bitrate.',
  },
};

/** Hostname fragment -> platform key */
const HOST_MAP = {
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'instagram.com': 'meta',
  'facebook.com': 'meta',
  'fb.watch': 'meta',
  'fb.com': 'meta',
  'twitter.com': 'twitter',
  'x.com': 'twitter',
  'reddit.com': 'reddit',
  'redd.it': 'reddit',
  'pinterest.com': 'pinterest',
  'pin.it': 'pinterest',
  'threads.net': 'threads',
  'threads.com': 'threads',
  'snapchat.com': 'snapchat',
  'story.snapchat.com': 'snapchat',
  'douyin.com': 'douyin',
  'iesdouyin.com': 'douyin',
  'kuaishou.com': 'kuaishou',
  'v.kuaishou.com': 'kuaishou',
  'terabox.com': 'terabox',
  'teraboxapp.com': 'terabox',
  'terabox.app': 'terabox',
  '4funbox.cn': 'terabox',
  'bluesky.app': 'bluesky',
  'bsky.app': 'bluesky',
  'music.youtube.com': 'ytmusic',
  'music.youtube.co.uk': 'ytmusic',
  'pornhub.com': 'pornhub',
  'pornhubpremium.com': 'pornhub',
  'bilibili.com': 'bilibili',
  'b23.tv': 'bilibili',
  'bilibili.tv': 'bilibili',
};

/**
 * Detects the platform key for a given URL.
 * @param {string} url
 * @returns {string|null} platform key or null when unsupported
 */
function detectPlatform(url) {
  let hostname;
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }

  // Exact host match first
  if (HOST_MAP[hostname]) return HOST_MAP[hostname];

  // Then a suffix match so subdomains (e.g. m.tiktok.com) are handled
  for (const [host, platform] of Object.entries(HOST_MAP)) {
    if (hostname === host || hostname.endsWith('.' + host)) {
      return platform;
    }
  }

  return null;
}

/**
 * @param {string} platform
 * @returns {string} human readable platform name
 */
function getPlatformDisplayName(platform) {
  return PLATFORMS[platform]?.display || platform;
}

/**
 * Resolves the controller handler for a platform.
 * @param {string} platform
 * @returns {Function|null}
 */
function getPlatformHandler(platform) {
  const entry = PLATFORMS[platform];
  if (!entry) return null;

  try {
    // eslint-disable-next-line global-require
    const controller = require(entry.controller);
    const handler = controller[entry.handler];
    return typeof handler === 'function' ? handler : null;
  } catch (err) {
    console.error(`Failed to load controller for platform "${platform}":`, err.message);
    return null;
  }
}

module.exports = {
  PLATFORMS,
  STATUS,
  HOST_MAP,
  detectPlatform,
  getPlatformDisplayName,
  getPlatformHandler,
};
