const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const axios = require("axios");
const dns = require("dns").promises;
const { URL } = require("url");

const {
  PLATFORMS,
  detectPlatform,
  getPlatformDisplayName,
} = require("./config/platforms");
const { analyzeUrl, listFormats } = require("./services/unifiedService");
const { verifyMediaToken } = require("./services/mediaToken");

const app = express();

const API_VERSION = "1.9.0";

// Trust proxy for rate limiting behind reverse proxies
app.set("trust proxy", 1);

/* ------------------------------------------------------------------ */
/* Security middleware                                                  */
/* ------------------------------------------------------------------ */

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

/* ------------------------------------------------------------------ */
/* CORS                                                                */
/* ------------------------------------------------------------------ */

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsBase = {
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  maxAge: 600,
};

app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    const host = req.headers.host;

    // No Origin header: a plain navigation, curl call or server-to-server
    // request. No CORS headers are needed.
    if (!origin) {
      callback(null, { ...corsBase, origin: false });
      return;
    }

    let originHost = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }

    // Same-origin requests are always allowed. This matters because Vite
    // marks its script and stylesheet tags with `crossorigin`, which makes the
    // browser send an Origin header even for same-origin assets. Without this
    // the assets would be blocked and the page would render blank.
    const isSameOrigin = Boolean(originHost && host && originHost === host);
    const isAllowed = allowedOrigins.includes(origin);

    if (isSameOrigin || isAllowed) {
      callback(null, { ...corsBase, origin });
      return;
    }

    callback(new Error("Not allowed by CORS"));
  })
);

/* ------------------------------------------------------------------ */
/* Body parsing + logging                                               */
/* ------------------------------------------------------------------ */

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Request ID middleware
app.use((req, res, next) => {
  req.requestId =
    req.get("X-Request-ID") || `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  res.setHeader("X-Request-ID", req.requestId);
  next();
});

/* ------------------------------------------------------------------ */
/* Rate limiting                                                        */
/* ------------------------------------------------------------------ */

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "30", 10);
const DOWNLOAD_RATE_LIMIT_MAX = parseInt(process.env.DOWNLOAD_RATE_LIMIT_MAX || "10", 10);

/**
 * Builds a rate limit handler that keeps the standard JSON envelope and
 * includes the request id so clients can correlate a 429 with server logs.
 */
function rateLimitHandler(message) {
  return (req, res) => {
    const retryAfter = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      success: false,
      error: message,
      retryAfter,
      requestId: req.requestId,
    });
  };
}

const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  handler: rateLimitHandler("Too many requests. Please slow down."),
  standardHeaders: true,
  legacyHeaders: false,
});

const downloadLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: DOWNLOAD_RATE_LIMIT_MAX,
  handler: rateLimitHandler(
    "Download limit exceeded. Please wait before trying again."
  ),
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", apiLimiter);

/* ------------------------------------------------------------------ */
/* SSRF protection                                                      */
/* ------------------------------------------------------------------ */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "169.254.169.254", // AWS / Azure instance metadata
  "metadata.google.internal", // GCP metadata
  "metadata.goog",
  "metadata.azure.com",
  "100.100.100.200", // Alibaba metadata
  "fd00:ec2::254", // AWS IPv6 metadata
]);

const PRIVATE_IPV4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64.0.0/10
  /^192\.0\.0\./,
  /^192\.0\.2\./,
  /^198\.18\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^224\./,
  /^240\./,
];

function isPrivateAddress(address) {
  if (!address) return true;
  const addr = String(address).toLowerCase();

  if (addr.includes(":")) {
    // IPv6
    if (addr === "::1" || addr === "::") return true;
    if (addr.startsWith("fe80") || addr.startsWith("fc") || addr.startsWith("fd")) return true;
    if (addr.startsWith("::ffff:")) {
      return isPrivateAddress(addr.replace("::ffff:", ""));
    }
    return false;
  }

  return PRIVATE_IPV4.some((range) => range.test(addr));
}

/**
 * Validates a URL and rejects anything that could be used to reach
 * internal services (SSRF).
 *
 * @param {string} urlString
 * @returns {Promise<URL>}
 */
async function resolveAndValidate(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are allowed");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
    throw new Error("Access to this host is not allowed");
  }

  if (isPrivateAddress(hostname)) {
    throw new Error("Access to private IP addresses is not allowed");
  }

  // Resolve DNS and verify every address is publicly routable.
  let addresses = [];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (err) {
    // A DNS failure is not a security problem by itself — the upstream
    // extraction call will fail on its own with a clearer error.
    if (err.code !== "ENOTFOUND" && err.code !== "EAI_AGAIN") {
      console.warn(`DNS lookup warning for ${hostname}: ${err.message}`);
    }
    return parsed;
  }

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new Error("Domain resolves to a private IP address");
    }
  }

  return parsed;
}

/* ------------------------------------------------------------------ */
/* Legacy platform routes (unchanged public API)                       */
/* ------------------------------------------------------------------ */

app.use("/api/bluesky", require("./routes/bluesky"));
app.use("/api/bilibili", require("./routes/bilibili"));
app.use("/api/douyin", require("./routes/douyin"));
app.use("/api/kuaishou", require("./routes/kuaishou"));
app.use("/api/meta", require("./routes/facebookInsta"));
app.use("/api/pinterest", require("./routes/pinterest"));
app.use("/api/pornhub", require("./routes/pornhub"));
app.use("/api/reddit", require("./routes/reddit"));
app.use("/api/snapchat", require("./routes/snapchat"));
app.use("/api/terabox", require("./routes/terabox"));
app.use("/api/threads", require("./routes/threads"));
app.use("/api/twitter", require("./routes/twitter"));
app.use("/api/youtube", require("./routes/youtube"));
app.use("/api/ytmusic", require("./routes/ytmusic"));

/* ------------------------------------------------------------------ */
/* Unified API                                                          */
/* ------------------------------------------------------------------ */

/** POST /api/validate — validate a URL and report the detected platform */
app.post("/api/validate", async (req, res) => {
  const { url } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({
      success: false,
      error: "A 'url' string is required",
      requestId: req.requestId,
    });
  }

  if (url.length > 2048) {
    return res.status(400).json({
      success: false,
      error: "URL is too long",
      requestId: req.requestId,
    });
  }

  try {
    await resolveAndValidate(url);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
      requestId: req.requestId,
    });
  }

  const platform = detectPlatform(url);

  res.json({
    success: true,
    data: {
      valid: true,
      platform: platform ? getPlatformDisplayName(platform) : null,
      supported: Boolean(platform),
    },
    requestId: req.requestId,
  });
});

/** POST /api/analyze — extract media metadata for a URL */
app.post("/api/analyze", downloadLimiter, async (req, res) => {
  const { url } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({
      success: false,
      error: "A 'url' string is required",
      requestId: req.requestId,
    });
  }

  if (url.length > 2048) {
    return res.status(400).json({
      success: false,
      error: "URL is too long",
      requestId: req.requestId,
    });
  }

  try {
    await resolveAndValidate(url);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
      requestId: req.requestId,
    });
  }

  try {
    const result = await analyzeUrl(url);

    if (!result.ok) {
      // Upstream failures are a bad gateway, not a bug in this service.
      const status =
        result.status === 501
          ? 501
          : result.status >= 400 && result.status < 500
          ? result.status
          : 502;
      return res.status(status).json({
        success: false,
        error: result.error,
        requestId: req.requestId,
      });
    }

    res.json({
      success: true,
      data: result.media,
      meta: {
        // True when the upstream returned no downloadable formats. The UI
        // uses this to explain the empty state instead of showing nothing.
        empty: Boolean(result.empty),
      },
      requestId: req.requestId,
    });
  } catch (err) {
    console.error(`[${req.requestId}] analyze failed:`, err.message);
    res.status(502).json({
      success: false,
      error: "The upstream service could not be reached. Please try again.",
      requestId: req.requestId,
    });
  }
});

/** POST /api/formats — list the available output formats for a URL */
app.post("/api/formats", downloadLimiter, async (req, res) => {
  const { url } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({
      success: false,
      error: "A 'url' string is required",
      requestId: req.requestId,
    });
  }

  try {
    await resolveAndValidate(url);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
      requestId: req.requestId,
    });
  }

  try {
    const result = await listFormats(url);

    if (!result.ok) {
      const status = result.status >= 400 && result.status < 600 ? result.status : 502;
      return res.status(status).json({
        success: false,
        error: result.error,
        requestId: req.requestId,
      });
    }

    res.json({
      success: true,
      data: { formats: result.formats },
      requestId: req.requestId,
    });
  } catch (err) {
    console.error(`[${req.requestId}] formats failed:`, err.message);
    res.status(502).json({
      success: false,
      error: "The upstream service could not be reached. Please try again.",
      requestId: req.requestId,
    });
  }
});

/* ------------------------------------------------------------------ */
/* Streaming downloads                                                  */
/* ------------------------------------------------------------------ */

/** Maximum size we are willing to proxy in a single request (bytes). */
const MAX_STREAM_BYTES = 512 * 1024 * 1024; // 512 MB

/** Brand tag appended to every downloaded file name. */
const FILE_NAME_TAG = "getsocials.com";

/**
 * Safely builds a Content-Disposition header value, making sure the brand
 * tag is present so every downloaded file carries a traceable origin.
 */
function contentDisposition(filename) {
  const fallback = `GETSocials-${FILE_NAME_TAG}`;

  let name = String(filename || fallback)
    .replace(/[\r\n"\\]/g, "")
    .replace(/[^\w\s.\-()\[\]]/g, "_")
    .trim()
    .slice(0, 180);

  if (!name) name = fallback;

  // Append the tag when it is not already there.
  if (!name.toLowerCase().includes(FILE_NAME_TAG)) {
    const dot = name.lastIndexOf(".");
    const ext = dot > 0 ? name.slice(dot) : "";
    const stem = dot > 0 ? name.slice(0, dot) : name;
    name = `${stem} - ${FILE_NAME_TAG}${ext}`;
  }

  // Include a UTF-8 form so non-ASCII titles survive the round trip.
  return `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * GET /api/stream?token=...&filename=...
 *
 * Streams a media file to the client. The `token` is an HMAC signed
 * reference to a URL that this server's own extraction layer produced, so
 * this endpoint can never be used to fetch arbitrary addresses.
 */
app.get("/api/stream", downloadLimiter, async (req, res) => {
  const { token, filename } = req.query;

  const payload = verifyMediaToken(token);
  if (!payload) {
    return res.status(403).json({
      success: false,
      error: "This download link is invalid or has expired. Please analyze the URL again.",
      requestId: req.requestId,
    });
  }

  // Re-validate the signed URL so a token can never point at an internal host.
  try {
    await resolveAndValidate(payload.url);
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
      requestId: req.requestId,
    });
  }

  /**
   * Opens the upstream media stream.
   *
   * Several CDNs (Pornhub among them) only serve the file when the request
   * carries the page it was found on, so the source page is sent as the
   * referer.
   *
   * @param {string} mediaUrl
   */
  const openUpstream = (mediaUrl) =>
    axios.get(mediaUrl, {
      responseType: "stream",
      timeout: 30000,
      maxRedirects: 3,
      // Validate every redirect hop as well.
      beforeRedirect: (options) => {
        const host = new URL(options.href).hostname.toLowerCase();
        if (BLOCKED_HOSTNAMES.has(host) || isPrivateAddress(host)) {
          throw new Error("Redirect to a blocked host was refused");
        }
      },
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        accept: "*/*",
        ...(payload.source ? { referer: payload.source } : {}),
      },
      validateStatus: (status) => status >= 200 && status < 300,
    });

  let upstream;
  try {
    upstream = await openUpstream(payload.url);
  } catch (err) {
    const status = err.response?.status;

    // Most platforms issue short-lived signed media URLs. When the signed URL
    // has expired, re-resolve the source page to get a fresh one instead of
    // failing the download.
    if (
      (status === 410 || status === 403 || status === 404) &&
      payload.source
    ) {
      try {
        const fresh = await analyzeUrl(payload.source);

        if (fresh.ok) {
          const all = [
            ...fresh.media.videos,
            ...fresh.media.audios,
            ...fresh.media.images,
            ...fresh.media.downloads,
          ];

          // Prefer a downloadable file, and skip HLS playlists which cannot
          // be saved as a single file.
          const usable = all.find(
            (f) => f.url && !/\.m3u8(\?|$)/i.test(f.url)
          );

          if (usable) {
            upstream = await openUpstream(usable.url);
          }
        }
      } catch (resolveErr) {
        console.error(
          `[${req.requestId}] could not refresh the expired media link:`,
          resolveErr.message
        );
      }
    }

    if (!upstream) {
      console.error(`[${req.requestId}] stream upstream failed:`, err.message);
      if (process.env.STREAM_DEBUG) {
        console.error(
          `[${req.requestId}] url=${payload.url.slice(0, 120)} referer=${
            payload.source || 'none'
          }`
        );
      }
      return res.status(502).json({
        success: false,
        error:
          "The media source could not be reached. The direct link may have expired — please analyze the URL again.",
        requestId: req.requestId,
      });
    }
  }

  const contentLength = Number(upstream.headers["content-length"]) || 0;

  if (contentLength && contentLength > MAX_STREAM_BYTES) {
    upstream.data.destroy();
    return res.status(413).json({
      success: false,
      error: "This file is too large to stream through the proxy. Use the direct link instead.",
      requestId: req.requestId,
    });
  }

  res.setHeader("Content-Type", upstream.headers["content-type"] || "application/octet-stream");
  if (contentLength) {
    res.setHeader("Content-Length", String(contentLength));
  }
  res.setHeader("Content-Disposition", contentDisposition(filename));
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("X-Request-ID", req.requestId);

  let bytes = 0;
  let aborted = false;

  upstream.data.on("data", (chunk) => {
    bytes += chunk.length;
    if (bytes > MAX_STREAM_BYTES) {
      aborted = true;
      upstream.data.destroy();
      res.destroy();
    }
  });

  upstream.data.on("error", (err) => {
    console.error(`[${req.requestId}] upstream stream error:`, err.code, err.message);
    if (!res.writableEnded) res.destroy();
  });

  upstream.data.on("end", () => {
    if (process.env.STREAM_DEBUG) {
      console.error(
        `[${req.requestId}] upstream ended: ${bytes} bytes (declared ${contentLength})`
      );
    }
  });

  // If the client disconnects, tear the upstream connection down too.
  res.on("close", () => {
    if (process.env.STREAM_DEBUG) {
      console.error(
        `[${req.requestId}] res close: writableEnded=${res.writableEnded} bytes=${bytes}`
      );
    }
    if (!res.writableEnded) {
      upstream.data.destroy();
    }
  });

  upstream.data.pipe(res);
});

/* ------------------------------------------------------------------ */
/* Health + metadata                                                    */
/* ------------------------------------------------------------------ */
app.get("/api/health", (req, res) => {
  const memory = process.memoryUsage();

  res.json({
    success: true,
    data: {
      status: "healthy",
      version: API_VERSION,
      uptime: Math.floor(process.uptime()),
      platforms: Object.keys(PLATFORMS),
      memory: {
        heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
        rssMB: Math.round(memory.rss / 1024 / 1024),
      },
    },
    requestId: req.requestId,
  });
});

/** GET /api/platforms — list supported platforms, their status and notes */
app.get("/api/platforms", (req, res) => {
  res.json({
    success: true,
    data: Object.entries(PLATFORMS).map(([key, value]) => ({
      id: key,
      name: value.display,
      status: value.status,
      note: value.note,
    })),
    requestId: req.requestId,
  });
});

/* ------------------------------------------------------------------ */
/* Static frontend (when a production build is present)                */
/* ------------------------------------------------------------------ */

const path = require("path");
const fs = require("fs");

const FRONTEND_DIST = path.join(__dirname, "frontend", "dist");

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(
    express.static(FRONTEND_DIST, {
      // Hashed assets can be cached forever, the shell cannot.
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    })
  );

  // Client side routing: anything that is not an API path serves the shell.
  // The root is handled by the API info route below.
  app.get(/^\/(?!api(\/|$)).+/, (req, res, next) => {
    const indexFile = path.join(FRONTEND_DIST, "index.html");
    if (fs.existsSync(indexFile)) {
      return res.sendFile(indexFile);
    }
    return next();
  });
}

/* ------------------------------------------------------------------ */
/* Root, 404, error handler                                             */
/* ------------------------------------------------------------------ */

const endpoints = [
  "/api/health",
  "/api/platforms",
  "/api/validate",
  "/api/analyze",
  "/api/formats",
  ...Object.keys(PLATFORMS).map((p) => `/api/${p}`),
];

// API description, also available at /api when the site is hosted.
app.get(["/api", "/api/"], (req, res) => {
  res.status(200).json({
    success: true,
    author: "Agent X | TechKey Team",
    contact: "support@getsocials.app",
    message: "GETSocials API is running",
    version: API_VERSION,
    endpoints,
  });
});

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    author: "Milan Bhandari",
    contact: "https://www.milanb.com.np/",
    message: "Universal Downloader API is running",
    version: API_VERSION,
    endpoints,
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    requestId: req.requestId,
  });
});

app.use((err, req, res, next) => {
  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      error: "This origin is not allowed to use the API.",
      requestId: req.requestId,
    });
  }

  console.error(`[${req.requestId}] Unhandled error:`, err.message);
  res.status(500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
    requestId: req.requestId,
  });
});

/* ------------------------------------------------------------------ */
/* Start                                                                */
/* ------------------------------------------------------------------ */

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`Supported platforms: ${Object.keys(PLATFORMS).length}`);
  });
}

module.exports = app;
