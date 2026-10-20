import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 255);
}

/**
 * Hostname -> display name.
 *
 * This mirrors the backend registry (`config/platforms.js`) so the panel can
 * tell the user straight away that a link belongs to a platform we support.
 */
const PLATFORM_DOMAINS: Record<string, string> = {
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'music.youtube.com': 'YouTube Music',
  'instagram.com': 'Instagram',
  'facebook.com': 'Facebook',
  'fb.watch': 'Facebook',
  'fb.com': 'Facebook',
  'twitter.com': 'Twitter',
  'x.com': 'Twitter',
  'reddit.com': 'Reddit',
  'redd.it': 'Reddit',
  'pinterest.com': 'Pinterest',
  'pin.it': 'Pinterest',
  'threads.net': 'Threads',
  'threads.com': 'Threads',
  'snapchat.com': 'Snapchat',
  'story.snapchat.com': 'Snapchat',
  'douyin.com': 'Douyin',
  'iesdouyin.com': 'Douyin',
  'kuaishou.com': 'Kuaishou',
  'v.kuaishou.com': 'Kuaishou',
  'terabox.com': 'Terabox',
  'teraboxapp.com': 'Terabox',
  'terabox.app': 'Terabox',
  '4funbox.cn': 'Terabox',
  'bluesky.app': 'Bluesky',
  'bsky.app': 'Bluesky',
  'pornhub.com': 'Pornhub',
  'pornhubpremium.com': 'Pornhub',
  'bilibili.com': 'Bilibili',
  'b23.tv': 'Bilibili',
  'bilibili.tv': 'Bilibili',
};

/**
 * Returns the display name of the platform a URL belongs to, or null when the
 * platform is not supported.
 */
export function getPlatformFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');

    // Exact match first, then a subdomain match.
    if (PLATFORM_DOMAINS[hostname]) return PLATFORM_DOMAINS[hostname];

    for (const [domain, platform] of Object.entries(PLATFORM_DOMAINS)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return platform;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  };
}