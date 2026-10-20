const axios = require("axios");

/**
 * YouTube extraction service.
 *
 * Uses YouTube's public InnerTube player API. Several clients are tried in
 * order because YouTube periodically changes which client will serve direct
 * media URLs; the first client that returns usable formats wins.
 *
 * Only publicly available media is retrieved. Private, age restricted and
 * members-only videos are rejected by the API itself and are reported back
 * to the caller as such.
 */

const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const PLAYER_ENDPOINT = `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}`;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

/**
 * InnerTube clients, in priority order.
 * Each entry produces direct media URLs without any signature deciphering.
 */
const CLIENTS = [
  {
    id: "ANDROID",
    userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip",
    context: {
      clientName: "ANDROID",
      clientVersion: "20.10.38",
      androidSdkVersion: 34,
      hl: "en",
      gl: "US",
    },
  },
  {
    id: "IOS",
    userAgent: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X)",
    context: {
      clientName: "IOS",
      clientVersion: "20.10.4",
      deviceModel: "iPhone16,2",
      osName: "iPhone",
      osVersion: "18.3.2.22D82",
      hl: "en",
      gl: "US",
    },
  },
  {
    id: "ANDROID_VR",
    userAgent: "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12; en_US)",
    context: {
      clientName: "ANDROID_VR",
      clientVersion: "1.60.19",
      deviceMake: "Oculus",
      deviceModel: "Quest 3",
      hl: "en",
      gl: "US",
    },
  },
  {
    id: "TVHTML5",
    userAgent: BROWSER_UA,
    context: {
      clientName: "TVHTML5",
      clientVersion: "7.20240724.13.00",
      hl: "en",
      gl: "US",
    },
  },
];

/**
 * Extracts the 11 character video id from any YouTube URL shape.
 * @param {string} url
 * @returns {string|null}
 */
function extractVideoId(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const v = parsed.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;

    const segments = parsed.pathname.split("/").filter(Boolean);
    const supported = ["shorts", "embed", "live", "v"];
    if (segments.length >= 2 && supported.includes(segments[0])) {
      const id = segments[1];
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
    }
  }

  return null;
}

/**
 * Maps a YouTube playability status to a user-facing error message.
 */
function describePlayability(status) {
  const reason = (status && status.reason) || "";
  const subreason = ((status && status.subreason) || "").trim();

  const lower = `${reason} ${subreason}`.toLowerCase();

  if (lower.includes("private")) {
    return "This video is private. Only the owner can view it.";
  }
  if (lower.includes("members-only") || lower.includes("join this channel")) {
    return "This video is members-only and requires a paid subscription.";
  }
  if (lower.includes("age-restricted") || lower.includes("confirm your age")) {
    return "This video is age-restricted and cannot be accessed anonymously.";
  }
  if (lower.includes("sign in") || lower.includes("bot") || lower.includes("not a bot")) {
    return "YouTube is rate-limiting this server. Please try again later.";
  }
  if (lower.includes("not available") || lower.includes("unavailable")) {
    return "This video is not available. It may have been removed or made private.";
  }
  if (lower.includes("geo") || lower.includes("country")) {
    return "This video is not available in the server's region.";
  }
  if (lower.includes("copyright")) {
    return "This video was removed for a copyright claim.";
  }

  return subreason || reason || "This video could not be played.";
}

/**
 * Converts a YouTube format object into our normalized format shape.
 */
function toFormat(f) {
  const mime = f.mimeType || "";
  const isAudio = mime.startsWith("audio/");
  const isVideo = mime.startsWith("video/");
  const container = (mime.split(";")[0].split("/")[1] || "").split("+")[0];

  // YouTube returns contentLength as a string in most InnerTube clients.
  const contentLength =
    typeof f.contentLength === "string"
      ? parseInt(f.contentLength, 10)
      : typeof f.contentLength === "number"
      ? f.contentLength
      : null;

  const sizeMB =
    typeof contentLength === "number" && Number.isFinite(contentLength)
      ? Math.round((contentLength / 1024 / 1024) * 100) / 100
      : null;

  const bitrateKbps =
    typeof f.averageBitrate === "number"
      ? Math.round(f.averageBitrate / 1000)
      : typeof f.bitrate === "number"
      ? Math.round(f.bitrate / 1000)
      : null;

  return {
    quality:
      f.qualityLabel ||
      (f.audioQuality ? f.audioQuality.replace("AUDIO_QUALITY_", "").toLowerCase() : null) ||
      (isAudio ? "audio" : null),
    format: container || (isAudio ? "m4a" : "mp4"),
    url: f.url,
    sizeMB,
    text: bitrateKbps ? `${bitrateKbps} kbps` : null,
    type: isAudio ? "audio" : isVideo ? "video" : "unknown",
    mimeType: mime,
    itag: f.itag,
  };
}

/**
 * Requests the player response for a video using a specific client.
 */
async function fetchPlayerResponse(client, videoId) {
  const { data } = await axios.post(
    PLAYER_ENDPOINT,
    {
      context: { client: client.context },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    },
    {
      headers: {
        "content-type": "application/json",
        "user-agent": client.userAgent,
        origin: "https://www.youtube.com",
        "accept-language": "en-US,en;q=0.9",
      },
      timeout: 15000,
    }
  );

  return data || {};
}

/**
 * Fetches metadata and download formats for a YouTube URL.
 *
 * @param {string} url
 * @returns {Promise<object>} normalized media payload
 */
async function fetchYouTubeData(url) {
  if (!url || typeof url !== "string") {
    throw new Error("A valid YouTube URL must be provided");
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error("Could not find a YouTube video id in the provided URL");
  }

  let lastError = null;
  let lastPlayability = null;

  for (const client of CLIENTS) {
    let player;

    try {
      player = await fetchPlayerResponse(client, videoId);
    } catch (err) {
      lastError = err;
      continue;
    }

    const status = player.playabilityStatus;
    const statusText = status && status.status;

    if (statusText && statusText !== "OK") {
      lastPlayability = status;
      // Login / bot checks are client specific, so keep trying other clients.
      const reason = ((status && status.reason) || "").toLowerCase();
      if (reason.includes("private") || reason.includes("removed") || reason.includes("not available")) {
        break;
      }
      continue;
    }

    const streamingData = player.streamingData || {};
    const rawFormats = [
      ...(streamingData.formats || []),
      ...(streamingData.adaptiveFormats || []),
    ];

    const usable = rawFormats.filter((f) => f && typeof f.url === "string" && f.url);

    if (usable.length === 0) {
      lastError = new Error(
        "YouTube did not return any direct media links for this video"
      );
      continue;
    }

    const normalized = usable.map(toFormat);

    const videos = normalized
      .filter((f) => f.type === "video")
      .sort((a, b) => {
        const qa = parseInt(String(a.quality).replace(/\D/g, ""), 10) || 0;
        const qb = parseInt(String(b.quality).replace(/\D/g, ""), 10) || 0;
        return qb - qa;
      });

    const audios = normalized
      .filter((f) => f.type === "audio")
      .sort((a, b) => (b.sizeMB || 0) - (a.sizeMB || 0));

    const details = player.videoDetails || {};
    const thumbnails = details.thumbnail && details.thumbnail.thumbnails;
    const thumbnail =
      (thumbnails && thumbnails.length && thumbnails[thumbnails.length - 1].url) || null;

    // `lengthSeconds` comes back as a string on some clients and is absent on
    // others, so fall back to the per-format `approxDurationMs`.
    let duration = null;
    const rawLength = details.lengthSeconds;
    if (typeof rawLength === "number" && Number.isFinite(rawLength)) {
      duration = rawLength;
    } else if (typeof rawLength === "string") {
      const parsed = parseInt(rawLength, 10);
      if (Number.isFinite(parsed)) duration = parsed;
    }

    if (duration === null) {
      const approx = rawFormats.find((f) => f && f.approxDurationMs);
      if (approx) duration = Math.round(approx.approxDurationMs / 1000);
    }

    return {
      type: "video",
      url,
      videoId,
      title: details.title || null,
      author: details.author || null,
      thumbnail,
      duration,
      videos,
      audios,
    };
  }

  if (lastPlayability) {
    throw new Error(describePlayability(lastPlayability));
  }

  throw new Error(
    (lastError && lastError.message) ||
      "YouTube did not return any downloadable formats for this video"
  );
}

module.exports = { fetchYouTubeData, extractVideoId };
