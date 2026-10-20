/**
 * Platform metadata shared by the landing page, the URL panel and the
 * supported-platforms grid.
 *
 * `domain` is used to load the platform's real brand icon through Google's
 * favicon service, which serves the original artwork for every platform.
 *
 * `status` mirrors the backend registry (see `config/platforms.js`) and
 * reflects what has actually been verified end to end.
 */

export type SupportLevel = 'working' | 'limited' | 'degraded' | 'blocked';

export interface PlatformMeta {
  /** Stable identifier, matches the backend platform keys. */
  id: string;
  /** Short display name. */
  name: string;
  /** Domain used for URL matching. */
  domain: string;
  /** Self-hosted brand icon file name in /public/platforms. */
  icon: string;
  /** Grouping used on the landing page. */
  category: string;
  /** How complete the integration is. */
  support: SupportLevel;
  /** Output types the platform can deliver. */
  outputs: string[];
  /** Short, honest explanation of the current state. */
  note: string;
  /** Marks platforms that are only for adults. */
  adult?: boolean;
}

export const SUPPORT_LABELS: Record<SupportLevel, string> = {
  working: 'Full support',
  limited: 'Limited',
  degraded: 'Unreliable',
  blocked: 'Unavailable',
};

export const SUPPORT_DESCRIPTIONS: Record<SupportLevel, string> = {
  working: 'Verified end to end — metadata and downloadable media.',
  limited: 'Works, but only for some posts or media types.',
  degraded: 'Works intermittently; the upstream service changes often.',
  blocked: 'The platform now requires a signed-in session, which we do not use.',
};

export const PLATFORMS: PlatformMeta[] = [
  // Short video
  {
    id: 'snapchat',
    icon: 'snapchat.png',
    name: 'Snapchat',
    domain: 'snapchat.com',
    category: 'Short video',
    support: 'limited',
    outputs: ['Spotlight'],
    note: 'Spotlight posts only.',
  },
  {
    id: 'douyin',
    icon: 'douyin.png',
    name: 'Douyin',
    domain: 'douyin.com',
    category: 'Short video',
    support: 'degraded',
    outputs: ['Video', 'Audio'],
    note: 'Depends on a third-party extractor that changes often.',
  },

  // Long form video
  {
    id: 'youtube',
    icon: 'youtube.png',
    name: 'YouTube',
    domain: 'youtube.com',
    category: 'Long-form video',
    support: 'working',
    outputs: ['Up to 4K', 'Audio', 'Shorts'],
    note: 'Up to 4K, plus separate audio tracks.',
  },
  {
    id: 'bilibili',
    icon: 'bilibili.jpg',
    name: 'Bilibili',
    domain: 'bilibili.com',
    category: 'Long-form video',
    support: 'working',
    outputs: ['Video', 'Audio', 'Multi-part'],
    note: 'Video and audio streams via yt-dlp, or OneAPI when it is configured.',
  },
  {
    id: 'kuaishou',
    icon: 'kuaishou.png',
    name: 'Kuaishou',
    domain: 'kuaishou.com',
    category: 'Long-form video',
    support: 'working',
    outputs: ['Video', 'Audio'],
    note: 'Needs a OneAPI subscription; falls back to yt-dlp.',
  },

  // Social media
  {
    id: 'meta',
    icon: 'instagram.png',
    name: 'Instagram',
    domain: 'instagram.com',
    category: 'Social media',
    support: 'limited',
    outputs: ['Reels', 'Posts', 'Stories'],
    note: 'Instagram needs the server operator’s own session (IG_SESSION_FILE).',
  },
  {
    id: 'meta-fb',
    icon: 'facebook.png',
    name: 'Facebook',
    domain: 'facebook.com',
    category: 'Social media',
    support: 'working',
    outputs: ['Video', 'Photos', 'Reels'],
    note: 'Extracted with yt-dlp, including DASH audio and video streams.',
  },
  {
    id: 'twitter',
    icon: 'twitter.png',
    name: 'Twitter / X',
    domain: 'x.com',
    category: 'Social media',
    support: 'working',
    outputs: ['Video', 'GIF', 'Images'],
    note: 'Media is served by the X web client, with yt-dlp as a fallback.',
  },
  {
    id: 'threads',
    icon: 'threads.png',
    name: 'Threads',
    domain: 'threads.net',
    category: 'Social media',
    support: 'working',
    outputs: ['Video', 'Images'],
    note: 'Media is served by the Threads web client, with yt-dlp as a fallback.',
  },
  {
    id: 'pinterest',
    icon: 'pinterest.png',
    name: 'Pinterest',
    domain: 'pinterest.com',
    category: 'Social media',
    support: 'working',
    outputs: ['Video', 'Images', 'GIFs'],
    note: 'Original images, GIFs and video pins via the PinterestDownloader engine.',
  },
  {
    id: 'reddit',
    icon: 'reddit.png',
    name: 'Reddit',
    domain: 'reddit.com',
    category: 'Social media',
    support: 'working',
    outputs: ['Video', 'Images', 'GIFs'],
    note: 'Video, images and galleries via the authless RedDownloader API.',
  },
  {
    id: 'bluesky',
    icon: 'bluesky.png',
    name: 'Bluesky',
    domain: 'bsky.app',
    category: 'Social media',
    support: 'working',
    outputs: ['Video', 'Images'],
    note: 'Uses the public Bluesky API.',
  },
  {
    id: 'pornhub',
    icon: 'pornhub.png',
    name: 'Pornhub',
    domain: 'pornhub.com',
    category: 'Social media',
    support: 'working',
    outputs: ['Video', 'Multiple qualities'],
    note: 'Video in every available quality. 18+ only.',
    adult: true,
  },

  // Audio and music
  {
    id: 'ytmusic',
    icon: 'ytmusic.png',
    name: 'YouTube Music',
    domain: 'music.youtube.com',
    category: 'Audio & music',
    support: 'working',
    outputs: ['MP3', 'M4A', 'Original bitrate'],
    note: 'Audio streams only, with the original bitrate.',
  },

  // Files
  {
    id: 'terabox',
    icon: 'terabox.png',
    name: 'Terabox',
    domain: 'terabox.com',
    category: 'Files & cloud',
    support: 'working',
    outputs: ['Files', 'Video'],
    note: 'Direct file links via Terabox’s own share API.',
  },
];

export const PLATFORM_CATEGORIES = [
  'Short video',
  'Long-form video',
  'Social media',
  'Audio & music',
  'Files & cloud',
];

/**
 * Builds the URL for a platform's real brand icon.
 *
 * The icons are self-hosted in `/public/platforms` so the site does not
 * depend on a third-party favicon service and nothing is tracked.
 */
export function platformIconUrl(platform: PlatformMeta): string {
  return `/platforms/${platform.icon}`;
}

/**
 * Platform entries with duplicate domains removed. The same service can back
 * more than one product, and the icon strip should only show one mark per
 * domain.
 */
export const UNIQUE_PLATFORM_ICONS = PLATFORMS.filter(
  (platform, index, all) =>
    all.findIndex((p) => p.domain === platform.domain) === index
);

/** Counts of each support level, used for the summary line. */
export const SUPPORT_COUNTS = PLATFORMS.reduce(
  (acc, platform) => {
    acc[platform.support] = (acc[platform.support] || 0) + 1;
    return acc;
  },
  {} as Record<SupportLevel, number>
);
