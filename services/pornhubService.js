const axios = require("axios");
const cheerio = require("cheerio");

/**
 * Pornhub media service.
 *
 * Uses the public webmasters endpoints that the `pornhub-api` project relies
 * on, plus the public video page for the direct media links.
 *
 * The site is age restricted, so the standard age-confirmation cookies are
 * sent. This is the same mechanism the site itself uses to remember that a
 * visitor has confirmed their age — no account, no login and no paywall is
 * involved.
 *
 * Users must be of legal age in their jurisdiction. The platform is clearly
 * labelled as 18+ in the interface.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const HEADERS = {
  "user-agent": UA,
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  cookie:
    "age_restricted=1; cookies_modal_allowed=1; rn=20; wanted=1; performance=1; eu_cookie=1",
};

const PORNHUB_HOSTS = ["pornhub.com", "pornhubpremium.com"];

/**
 * Checks that the URL points at Pornhub.
 * @param {string} url
 */
function isPornhubUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return PORNHUB_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Extracts the view key from a Pornhub video URL.
 * @param {string} url
 * @returns {string|null}
 */
function extractViewKey(url) {
  try {
    const parsed = new URL(url);
    const key = parsed.searchParams.get('viewkey');
    if (key) return key;

    const segments = parsed.pathname.split('/').filter(Boolean);
    // /view_video.php?viewkey=... handled above.
    // /embed/... or /videos/... may carry the key in the path.
    const embed = segments.find((s) => /^[a-z0-9]{12}$/i.test(s));
    return embed || null;
  } catch {
    return null;
  }
}

/**
 * Pulls the quality label out of a media URL.
 * @param {string} mediaUrl
 */
function qualityFromUrl(mediaUrl) {
  const match = mediaUrl.match(/\/(\d{3,4}P)_\d+K/);
  return match ? match[1] : null;
}

/**
 * Fetches media information for a Pornhub video.
 *
 * @param {string} url
 * @returns {Promise<object>} media payload
 */
async function fetchPornhubData(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('A Pornhub URL must be provided');
  }

  if (!isPornhubUrl(url)) {
    throw new Error('That does not look like a Pornhub URL');
  }

  const viewKey = extractViewKey(url);
  if (!viewKey) {
    throw new Error(
      'Could not find the video id in that URL. Expected https://www.pornhub.com/view_video.php?viewkey=...'
    );
  }

  const pageUrl = `https://www.pornhub.com/view_video.php?viewkey=${viewKey}`;

  const { data: page } = await axios.get(pageUrl, {
    headers: HEADERS,
    timeout: 30000,
    validateStatus: () => true,
  });

  const html = String(page);
  const $ = cheerio.load(html);

  const title = $('meta[property="og:title"]').attr('content') || $('title').text().trim() || null;
  const thumbnail = $('meta[property="og:image"]').attr('content') || null;

  const durationMatch = html.match(/"video_duration"\s*:\s*"?(\d+)"?/);
  const duration = durationMatch ? parseInt(durationMatch[1], 10) : null;

  const videos = [];
  const seen = new Set();

  const addVideo = (mediaUrl, quality, format) => {
    if (!mediaUrl || seen.has(mediaUrl)) return;
    // HLS playlists cannot be saved as a single file, so they are skipped.
    if (/\.m3u8(\?|$)/i.test(mediaUrl)) return;
    seen.add(mediaUrl);
    videos.push({
      quality: quality || 'Video',
      format,
      url: mediaUrl,
      sizeMB: null,
    });
  };

  // 1. The direct MP4 advertised in the page metadata.
  const ogVideo = $('meta[property="og:video"]').attr('content');
  if (ogVideo) {
    addVideo(ogVideo.replace(/&amp;/g, '&'), qualityFromUrl(ogVideo), 'mp4');
  }

  // 2. Any remaining direct MP4 quality variants in the page.
  const mp4Matches = [
    ...new Set(
      (
        page.match(/https:\/\/[^"'\\ ]*?\/\d{3,4}P_\d+K[^"'\\ ]*?\.mp4[^"'\\ ]*/g) || []
      ).map((u) => u.replace(/&amp;/g, '&').replace(/\\\//g, '/')),
    ),
  ];

  mp4Matches.forEach((mp4Url) => {
    addVideo(mp4Url, qualityFromUrl(mp4Url), 'mp4');
  });

  if (!videos.length) {
    throw new Error(
      'No media was found for this video. It may have been removed or the page structure has changed.'
    );
  }

  // Highest quality first.
  const order = ['2160P', '1440P', '1080P', '720P', '480P', '360P', '240P'];
  videos.sort(
    (a, b) =>
      order.indexOf(String(b.quality).toUpperCase()) - order.indexOf(String(a.quality).toUpperCase())
  );

  return {
    type: 'video',
    title,
    thumbnail,
    duration,
    author: null,
    videos,
    audios: [],
    images: [],
    downloads: [],
    adult: true,
  };
}

module.exports = { fetchPornhubData, isPornhubUrl, extractViewKey };
