# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 — build the React frontend
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS frontend

WORKDIR /build

COPY frontend/package*.json ./
# `npm ci` needs the lockfile; fall back to `npm install` if it is missing.
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; \
    else npm install --no-audit --no-fund; fi

COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 — runtime: Node + Python extraction tools
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

# Python is needed for yt-dlp, instaloader and pinterest-downloader.
# ffmpeg lets yt-dlp merge separate audio and video streams.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       python3 \
       python3-pip \
       python3-venv \
       ffmpeg \
       ca-certificates \
       curl \
  && rm -rf /var/lib/apt/lists/*

# The Python tools live in their own virtualenv so they never collide with
# the system Python.
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir yt-dlp instaloader pinterest-downloader

WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev --no-audit --no-fund; \
    else npm install --omit=dev --no-audit --no-fund; fi

COPY index.js ./
COPY config/ ./config/
COPY controllers/ ./controllers/
COPY routes/ ./routes/
COPY services/ ./services/
COPY scripts/ ./scripts/

# The built frontend is served by Express, so the whole app is one process.
COPY --from=frontend /build/dist ./frontend/dist

ENV NODE_ENV=production \
    PORT=3000 \
    PYTHON_BIN=/opt/venv/bin/python

# Run as a non-root user.
RUN useradd --create-home --shell /bin/bash appuser \
  && chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/api/health" || exit 1

CMD ["node", "index.js"]
