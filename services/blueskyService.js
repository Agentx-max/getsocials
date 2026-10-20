const axios = require("axios");

/**
 * Bluesky media service.
 *
 * Uses Bluesky's public, documented API (public.api.bsky.app) rather than a
 * third-party scraper. The API is open for public posts and returns the
 * original CDN URLs for images and videos, so no signature handling is needed.
 */

const API = "https://public.api.bsky.app/xrpc";
const CDN = "https://cdn.bsky.app/img-feed";

/**
 * Extracts the handle and post id from a Bluesky URL.
 * @param {string} url
 * @returns {{handle: string, rkey: string} | null}
 */
function parseBlueskyUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "bsky.app" && host !== "bsky.social") return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  // /profile/<handle>/post/<rkey>
  if (segments.length >= 4 && segments[2] === "post") {
    return { handle: segments[1], rkey: segments[3] };
  }
  // /<handle>/post/<rkey>
  if (segments.length >= 3 && segments[1] === "post") {
    return { handle: segments[0], rkey: segments[2] };
  }

  return null;
}

/**
 * Resolves a handle to its DID.
 */
async function resolveHandle(handle) {
  const { data } = await axios.get(`${API}/com.atproto.identity.resolveHandle`, {
    params: { handle },
    timeout: 15000,
  });
  return data.did;
}

/**
 * Fetches a public post and its media.
 *
 * @param {string} postUrl
 * @returns {Promise<object>} media payload
 */
async function fetchBlueskyMedia(postUrl) {
  const parsed = parseBlueskyUrl(postUrl);

  if (!parsed) {
    throw new Error(
      "That does not look like a Bluesky post URL. Expected https://bsky.app/profile/<handle>/post/<id>"
    );
  }

  let did = parsed.handle;
  if (!did.startsWith("did:")) {
    did = await resolveHandle(parsed.handle);
  }

  const { data } = await axios.get(`${API}/app.bsky.feed.getPosts`, {
    params: { uris: `at://${did}/app.bsky.feed.post/${parsed.rkey}` },
    timeout: 15000,
  });

  const post = data.posts?.[0];
  if (!post) {
    throw new Error("This Bluesky post could not be found. It may have been deleted.");
  }

  const photos = [];
  const videos = [];

  // Images
  for (const image of post.images || []) {
    const full = image.fullsize || image.thumbnail;
    if (!full) continue;
    photos.push({
      index: photos.length + 1,
      thumbnail: image.thumbnail,
      url: full,
      alt: image.alt || null,
      width: image.aspectRatio ? undefined : undefined,
      variants: [{ resolution: "original", url: full }],
    });
  }

  // Video
  if (post.video) {
    const playlist = post.video.playlist;
    if (playlist) {
      videos.push({
        index: videos.length + 1,
        thumbnail: post.thumbnail || null,
        url: playlist,
        format: "m3u8",
        quality: "original",
        mimeType: "application/x-mpegURL",
      });
    } else if (post.video.cid) {
      // Fall back to the video CDN endpoint for a direct mp4.
      videos.push({
        index: videos.length + 1,
        thumbnail: post.thumbnail || null,
        url: `${CDN}/video/${encodeURIComponent(post.uri)}/source.mp4`,
        format: "mp4",
        quality: "original",
        mimeType: "video/mp4",
      });
    }
  }

  if (!photos.length && !videos.length) {
    throw new Error("This Bluesky post does not contain any images or videos.");
  }

  return {
    type: videos.length ? "video" : "photo",
    platform: "bluesky",
    title: post.record?.text?.slice(0, 200) || null,
    caption: post.record?.text || null,
    author: post.author?.displayName || post.author?.handle || null,
    thumbnail: post.thumbnail || post.images?.[0]?.thumbnail || null,
    images: photos,
    videos,
    photos,
    videoCount: videos.length,
    photoCount: photos.length,
  };
}

module.exports = { fetchBlueskyMedia, parseBlueskyUrl };
