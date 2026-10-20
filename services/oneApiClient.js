const axios = require("axios");

/**
 * OneAPI client.
 *
 * OneAPI (https://getoneapi.com) is a commercial data API that covers
 * Bilibili, Kuaishou, Douyin, Weibo and more. It is a paid service, so the
 * base URL and key are supplied by the server operator through the
 * environment:
 *
 *   ONEAPI_BASE_URL=https://<your-instance>
 *   ONEAPI_KEY=<your-api-key>
 *
 * When those are not set, the platform services fall back to other
 * extractors, so the deployment keeps working without a subscription.
 */

const BASE_URL = (process.env.ONEAPI_BASE_URL || '').replace(/\/$/, '');
const KEY = process.env.ONEAPI_KEY || '';

/** Whether the operator has configured a OneAPI subscription. */
function isConfigured() {
  return Boolean(BASE_URL);
}

/**
 * Performs a OneAPI request.
 *
 * @param {string} path endpoint path, e.g. "/bilibili/video"
 * @param {object} body request payload
 * @param {number} [timeout]
 * @returns {Promise<any>} the parsed response
 */
async function request(path, body, timeout = 30000) {
  if (!isConfigured()) {
    throw new Error('The OneAPI service is not configured on this deployment.');
  }

  const headers = {
    'content-type': 'application/json',
    accept: 'application/json',
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  };

  if (KEY) headers.authorization = KEY;

  const { data } = await axios.post(`${BASE_URL}${path}`, body, {
    headers,
    timeout,
    validateStatus: (status) => status >= 200 && status < 300,
  });

  return data;
}

/**
 * Pulls the useful fields out of a OneAPI response, whatever the shape.
 * @param {any} payload
 */
function unwrap(payload) {
  if (!payload) return null;
  if (payload.code && payload.code !== 0 && payload.code !== 200) {
    throw new Error(payload.message || payload.msg || 'The OneAPI request failed.');
  }
  return payload.data ?? payload;
}

module.exports = { isConfigured, request, unwrap, BASE_URL };
