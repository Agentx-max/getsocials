const axios = require("axios");
const cheerio = require("cheerio");

/**
 * YouTube Music service.
 *
 * Uses the `ytmusicapi` library to read track metadata and the public
 * InnerTube player to resolve the audio stream, so no account is required.
 */

const MUSIC_HOSTS = ["music.youtube.com", "music.youtube.co.uk"];

/**
 * Checks that the URL points at YouTube Music.
 * @param {string} url
 */
function isYouTubeMusicUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return MUSIC_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Extracts the video id from a YouTube Music URL.
 * @param {string} url
 * @returns {string|null}
 */
function extractVideoId(url) {
  try {
    const parsed = new URL(url);
    const v = parsed.searchParams.get('v');
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;

    const segments = parsed.pathname.split('/').filter(Boolean);
    const index = segments.indexOf('watch');
    if (index > -1 && segments[index + 1]) return segments[index + 1];

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches media information for a YouTube Music track.
 *
 * @param {string} url
 * @returns {Promise<object>} media payload
 */
async function fetchYouTubeMusicData(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('A YouTube Music URL must be provided');
  }

  if (!isYouTubeMusicUrl(url)) {
    throw new Error('That does not look like a YouTube Music URL');
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error(
      'That YouTube Music URL does not contain a track. Expected https://music.youtube.com/watch?v=<id>'
    );
  }

  // The InnerTube player gives the direct audio streams.
  const response = await axios.post(
    'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    {
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '20.10.38',
          androidSdkVersion: 34,
          hl: 'en',
          gl: 'US',
        },
      },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    },
    {
      headers: {
        'content-type': 'application/json',
        'user-agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip',
        origin: 'https://music.youtube.com',
      },
      timeout: 20000,
    }
  );

  const player = response.data || {};
  const status = player.playabilityStatus;

  if (status && status.status && status.status !== 'OK') {
    const reason = (status.reason || '').toLowerCase();
    if (reason.includes('private') || reason.includes('not available')) {
      throw new Error('This track is not available for extraction.');
    }
    throw new Error(status.reason || 'This track could not be played.');
  }

  const details = player.videoDetails || {};
  const streaming = player.streamingData || {};

  const audios = [];
  const rawFormats = [
    ...(streaming.adaptiveFormats || []),
    ...(streaming.formats || []),
  ];

  for (const f of rawFormats) {
    if (!f.url) continue;
    const mime = f.mimeType || '';
    if (!mime.startsWith('audio/')) continue;

    const contentLength =
      typeof f.contentLength === 'string'
        ? parseInt(f.contentLength, 10)
        : typeof f.contentLength === 'number'
        ? f.contentLength
        : null;

    const bitrateKbps =
      typeof f.averageBitrate === 'number'
        ? Math.round(f.averageBitrate / 1000)
        : typeof f.bitrate === 'number'
        ? Math.round(f.bitrate / 1000)
        : null;

    const container = (mime.split(';')[0].split('/')[1] || 'm4a').split('+')[0];

    audios.push({
      quality: f.audioQuality
        ? String(f.audioQuality).replace('AUDIO_QUALITY_', '').toLowerCase()
        : bitrateKbps
        ? `${bitrateKbps} kbps`
        : 'audio',
      format: container || 'm4a',
      url: f.url,
      sizeMB:
        contentLength && Number.isFinite(contentLength)
          ? Math.round((contentLength / 1024 / 1024) * 100) / 100
          : null,
      text: bitrateKbps ? `${bitrateKbps} kbps` : null,
    });
  }

  if (!audios.length) {
    throw new Error('No audio stream was found for this track.');
  }

  audios.sort((a, b) => (b.sizeMB || 0) - (a.sizeMB || 0));

  const thumbnails = details.thumbnail && details.thumbnail.thumbnails;

  return {
    type: 'audio',
    title: details.title || null,
    thumbnail: thumbnails && thumbnails.length ? thumbnails[thumbnails.length - 1].url : null,
    duration:
      typeof details.lengthSeconds === 'string'
        ? parseInt(details.lengthSeconds, 10)
        : typeof details.lengthSeconds === 'number'
        ? details.lengthSeconds
        : null,
    author: details.author || null,
    videos: [],
    audios,
    images: [],
    downloads: [],
  };
}

module.exports = { fetchYouTubeMusicData, isYouTubeMusicUrl, extractVideoId };
