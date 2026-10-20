/**
 * Signed media tokens.
 *
 * The download endpoints must not become an open proxy. Instead of letting
 * the browser request an arbitrary URL, the extraction layer issues a short
 * lived, HMAC signed token for every media URL it discovers. The streaming
 * endpoint only accepts URLs that carry a valid token, which means only media
 * that our own extraction service produced can ever be fetched.
 *
 * The token embeds the URL, an expiry and a nonce, and is signed with a
 * per-process secret. The secret is generated on boot unless MEDIA_TOKEN_SECRET
 * is supplied, so tokens do not survive a restart (which is fine — they are
 * short lived by design).
 */

const crypto = require("crypto");

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

const SECRET =
  process.env.MEDIA_TOKEN_SECRET && process.env.MEDIA_TOKEN_SECRET.length >= 16
    ? process.env.MEDIA_TOKEN_SECRET
    : crypto.randomBytes(32).toString("hex");

/**
 * Signs a media URL so it can be streamed later.
 *
 * The `source` is the page the media was discovered on. Most platforms issue
 * short-lived signed media URLs, so when a download fails because the URL
 * has expired the server can re-resolve the source and get a fresh link
 * instead of failing.
 *
 * @param {string} url the media URL produced by the extraction layer
 * @param {string} [source] the page the media was found on
 * @returns {string} an opaque token
 */
function signMediaUrl(url, source) {
  const payload = {
    url,
    source: typeof source === 'string' ? source : undefined,
    exp: Date.now() + TOKEN_TTL_MS,
    nonce: crypto.randomBytes(6).toString("hex"),
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(encoded).digest("base64url");

  return `${encoded}.${signature}`;
}

/**
 * Verifies a token and returns the original media URL.
 *
 * @param {string} token
 * @returns {{url: string, exp: number} | null} the payload, or null when invalid
 */
function verifyMediaToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(encoded)
    .digest("base64url");

  // Constant-time comparison to avoid leaking information through timing
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload || typeof payload.url !== "string") return null;
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;

  return {
    url: payload.url,
    // The page the media was found on. Used to re-resolve short-lived URLs.
    source: typeof payload.source === "string" ? payload.source : undefined,
    exp: payload.exp,
  };
}

module.exports = { signMediaUrl, verifyMediaToken, TOKEN_TTL_MS };
