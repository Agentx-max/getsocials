const { runProbe } = require("./pythonBridge");

/**
 * Instagram media service.
 *
 * Uses instaloader through the Python bridge, which is the same extraction
 * engine the Instagram-Video-Downloader-API project relies on. Only public
 * posts are reachable — instaloader reports private and login-gated posts as
 * errors, which are surfaced to the user verbatim.
 */

const INSTAGRAM_HOSTS = ["instagram.com", "instagr.am"];

/**
 * Checks that the URL actually points at Instagram.
 * @param {string} url
 */
function isInstagramUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return INSTAGRAM_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Extracts the post shortcode from an Instagram URL.
 * @param {string} url
 * @returns {string|null}
 */
function extractShortcode(url) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const index = segments.indexOf("p");
    if (index > -1 && segments[index + 1]) return segments[index + 1];
    if (index === -1 && segments.length === 1 && /^[\w-]{5,}$/.test(segments[0])) {
      return segments[0];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches media information for an Instagram post.
 *
 * @param {string} url
 * @returns {Promise<object>} media payload
 */
async function fetchInstagramData(url) {
  if (!url || typeof url !== "string") {
    throw new Error("An Instagram URL must be provided");
  }

  if (!isInstagramUrl(url)) {
    throw new Error("That does not look like an Instagram URL");
  }

  if (!extractShortcode(url)) {
    throw new Error(
      "That Instagram URL does not contain a post. Expected https://www.instagram.com/p/<shortcode>/"
    );
  }

  const data = await runProbe("instagram", url);

  const videos = Array.isArray(data.videos) ? data.videos : [];
  const images = Array.isArray(data.images) ? data.images : [];

  if (!videos.length && !images.length) {
    throw new Error("No downloadable media was found for this Instagram post.");
  }

  return {
    type: videos.length ? "video" : "photo",
    title: data.title || null,
    thumbnail: data.thumbnail || null,
    duration: typeof data.duration === "number" ? Math.round(data.duration) : null,
    author: data.author || null,
    videos,
    audios: [],
    images,
    downloads: [],
  };
}

module.exports = { fetchInstagramData, isInstagramUrl, extractShortcode };
