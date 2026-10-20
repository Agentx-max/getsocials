const axios = require("axios");

/**
 * Terabox media service.
 *
 * Uses Terabox's own public endpoints, the same flow the TeraBox-Dl project
 * uses:
 *
 *   1. `GET https://dm.terabox.app/sharing/link?surl=<id>` returns a page
 *      that contains a short lived `jsToken`.
 *   2. `GET https://dm.terabox.app/share/list` with that token returns the
 *      file list including the direct download links.
 *
 * Share links expire, so failures are reported as such rather than hidden.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
const APP_ID = "250528";

/**
 * Extracts the short share id from a Terabox link.
 * @param {string} url
 * @returns {string|null}
 */
function parseTeraboxUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (!/terabox\.(com|app)$/.test(host) && host !== '4funbox.cn') {
    return null;
  }

  const match = parsed.pathname.match(/\/s\/([A-Za-z0-9]+)/);
  if (match) return match[1];

  const surl = parsed.searchParams.get('surl');
  if (surl) return surl;

  return null;
}

/**
 * Fetches the jsToken and any cookies needed for the file list request.
 */
async function fetchShareContext(shortUrl) {
  const response = await axios.get(
    `https://dm.terabox.app/sharing/link?surl=${shortUrl}`,
    {
      headers: { 'user-agent': UA, accept: 'text/html,*/*' },
      timeout: 25000,
      validateStatus: () => true,
    }
  );

  const html = String(response.data);

  const tokenMatch = html.match(/fn%28%22(.*?)%22%29/);
  if (!tokenMatch) {
    throw new Error(
      'This Terabox link could not be read. The share may have expired, or Terabox is asking for verification.'
    );
  }

  const cookies = (response.headers['set-cookie'] || [])
    .map((c) => c.split(';')[0])
    .join('; ');

  return { jsToken: tokenMatch[1], cookies };
}

/**
 * Fetches the file list for a share link.
 */
async function fetchFileList(shortUrl) {
  const { jsToken, cookies } = await fetchShareContext(shortUrl);

  const { data } = await axios.get('https://dm.terabox.app/share/list', {
    params: {
      app_id: APP_ID,
      jsToken,
      site_referer: 'https://www.terabox.app/',
      shorturl: shortUrl,
      root: '1',
    },
    headers: {
      'user-agent': UA,
      accept: 'application/json, text/plain, */*',
      'x-requested-with': 'XMLHttpRequest',
      referer: `https://dm.terabox.app/sharing/link?surl=${shortUrl}&clearCache=1`,
      origin: 'https://dm.terabox.app',
      ...(cookies ? { cookie: cookies } : {}),
    },
    timeout: 25000,
  });

  if (!data || !data.list) {
    // Terabox reports failures through an errno code.
    const errno = data && data.errno;
    const messages = {
      105: 'This Terabox share link has expired or was deleted.',
      2: 'This Terabox link could not be read. It may have been removed.',
      12: 'Terabox needs verification for this link. Please try again shortly.',
    };

    throw new Error(
      (errno && messages[errno]) ||
        (data && (data.error_msg || data.error)) ||
        'This Terabox share link does not contain any files, or it has expired.'
    );
  }

  return data.list;
}

/**
 * Builds a direct download URL for a file entry.
 */
function buildDownloadUrl(file) {
  if (typeof file.download_url === 'string' && file.download_url) {
    return file.download_url;
  }

  if (file.surl && file.fid) {
    const fids = Array.isArray(file.fids) ? file.fids.join('|') : file.fid;
    return `https://www.terabox.com/api/download?app_id=${APP_ID}&web=1&channel=chunlei&surl=${file.surl}&fid=${file.fid}&fids=${fids}`;
  }

  return null;
}

/**
 * Fetches media information for a Terabox share link.
 *
 * @param {string} url
 * @returns {Promise<object>} media payload
 */
async function fetchTerabox(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('A Terabox URL must be provided');
  }

  const shortUrl = parseTeraboxUrl(url);
  if (!shortUrl) {
    throw new Error(
      'That does not look like a Terabox link. Expected https://www.terabox.com/s/<id>'
    );
  }

  const list = await fetchFileList(shortUrl);
  const files = Array.isArray(list) ? list : [list];

  const downloads = [];
  for (const file of files) {
    const downloadUrl = buildDownloadUrl(file);
    if (!downloadUrl) continue;

    downloads.push({
      quality: file.path || file.server_filename || 'File',
      format: (file.server_filename || '').split('.').pop() || 'file',
      url: downloadUrl,
      sizeMB:
        typeof file.size === 'number'
          ? Math.round((file.size / 1024 / 1024) * 100) / 100
          : null,
    });
  }

  if (!downloads.length) {
    throw new Error('This Terabox share link does not contain any downloadable files.');
  }

  const first = files[0] || {};

  return {
    type: 'mixed',
    title: first.path || first.server_filename || 'Terabox share',
    thumbnail: first.thumbnail || null,
    duration: null,
    author: null,
    videos: [],
    audios: [],
    images: [],
    downloads,
  };
}

module.exports = { fetchTerabox, parseTeraboxUrl };
