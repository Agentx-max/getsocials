const { runProbe } = require("./pythonBridge");

/**
 * Facebook media service.
 *
 * Uses yt-dlp through the Python bridge, which is the same extraction engine
 * the Facebook-Video-Download-API project relies on. Only public videos are
 * reachable — private, members-only and login-gated videos are reported as
 * such by yt-dlp and surfaced to the user as an error.
 */

const FACEBOOK_HOSTS = ["facebook.com", "fb.com", "fb.watch", "fb.com"];

/**
 * Checks that the URL actually points at Facebook.
 * @param {string} url
 */
function isFacebookUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return FACEBOOK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Fetches media information for a Facebook post.
 *
 * @param {string} url
 * @returns {Promise<object>} media payload
 */
async function fetchFacebookData(url) {
  if (!url || typeof url !== "string") {
    throw new Error("A Facebook URL must be provided");
  }

  if (!isFacebookUrl(url)) {
    throw new Error("That does not look like a Facebook URL");
  }

  const data = await runProbe("facebook", url);

  const videos = Array.isArray(data.videos) ? data.videos : [];
  const audios = Array.isArray(data.audios) ? data.audios : [];
  const images = Array.isArray(data.images) ? data.images : [];

  if (!videos.length && !audios.length && !images.length) {
    throw new Error(
      "No downloadable media was found for this Facebook post. It may be private, live, or require a login."
    );
  }

  return {
    type: videos.length ? "video" : "photo",
    title: data.title || null,
    thumbnail: data.thumbnail || null,
    duration: typeof data.duration === "number" ? Math.round(data.duration) : null,
    author: data.author || null,
    videos,
    audios,
    images,
    downloads: [],
  };
}

module.exports = { fetchFacebookData, isFacebookUrl };
