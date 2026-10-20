# GETSocials — Universal Social Media Downloader

A premium, production-ready social media media downloader website with original branding. Built on top of the universalDownloader API.

## 🌟 Features

- **Beautiful, responsive UI** — Dark theme with violet/electric-blue accents, glass morphism, smooth animations
- **Real backend integration** — Connects to Express API with 20+ platform support
- **Security-first** — SSRF protection, rate limiting, input validation, secure headers
- **Accessible** — WCAG 2.1 AA compliant, keyboard navigation, screen reader support
- **Mobile-first** — Works perfectly on all device sizes

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or pnpm

### Local Development

1. **Install backend dependencies**
```bash
npm install
```

2. **Install the extraction tools** (used for Facebook, Instagram, Bilibili and as a
   general fallback for every platform)
```bash
pip install yt-dlp instaloader pinterest-downloader
```

3. **Install frontend dependencies**
```bash
cd frontend && npm install && cd ..
```

4. **Start backend** (Terminal 1)
```bash
npm run dev
# or
npm start
```
Backend runs on `http://localhost:3000`

5. **Start frontend** (Terminal 2)
```bash
cd frontend && npm run dev
```
Frontend runs on `http://localhost:5173`

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `FRONTEND_URL` | Frontend origin for CORS | `http://localhost:5173` |
| `VITE_API_URL` | Frontend API base URL | `""` (same origin) |
| `VITE_API_TIMEOUT` | API request timeout (ms) | `30000` |
| `RATE_LIMIT_MAX` | General API rate limit per minute | `30` |
| `DOWNLOAD_RATE_LIMIT_MAX` | Download rate limit per minute | `10` |
| `MEDIA_TOKEN_SECRET` | Secret for signing download tokens | random per boot |
| `PYTHON_BIN` | Python interpreter to use | `python` / `python3` |
| `IG_COOKIE_FILE` | Operator's own cookie file (Netscape format) | unset |
| `IG_SESSION_FILE` | Operator's own instaloader session file | unset |
| `ONEAPI_BASE_URL` | OneAPI instance (for Bilibili / Kuaishou) | unset |
| `ONEAPI_KEY` | OneAPI subscription key | unset |

### About `IG_COOKIE_FILE` and `IG_SESSION_FILE`

Instagram refuses anonymous access for most posts. The server **operator** can point
these at their own cookie/session file to unlock it. Visitor cookies are never
accepted, requested, or used. If unset, Instagram still works for the occasional
public post.

### About `ONEAPI_BASE_URL` and `ONEAPI_KEY`

[OneAPI](https://getoneapi.com) is a commercial data API that covers Bilibili,
Kuaishou, Douyin and more. When the operator has a subscription, set these and the
Bilibili and Kuaishou integrations use it. Without them, Bilibili still works
through yt-dlp.

### About the platform icons

The brand icons in `frontend/public/platforms/` are self-hosted, so the site has no
third-party icon dependency and tracks nobody. Refresh them with:

```bash
node scripts/fetch-platform-icons.js
```

## 🏗️ Project Structure

```
Media Downloader/
├── index.js                 # Express server entry point
├── package.json             # Backend dependencies
├── .env.example             # Environment template
├── vercel.json              # Vercel deployment config
├── test-integration.js      # 26 integration tests (node test-integration.js)
├── config/
│   └── platforms.js         # Platform registry: controllers, status, notes
├── controllers/             # API route handlers (18 platforms)
├── routes/                  # Express route definitions
├── services/                # Platform extraction logic
│   ├── unifiedService.js    # Shared analysis + normalisation layer
│   ├── mediaToken.js        # Signed download tokens (anti open-proxy)
│   └── <platform>Service.js
├── scripts/                 # Verification and diagnostic tools
│   ├── verify-platforms.js  # End-to-end platform verification
│   └── test-stream.js       # Streaming endpoint + token security test
└── frontend/                # React + TypeScript + Tailwind app
    ├── src/
    │   ├── components/      # React components
    │   │   ├── ui/          # Reusable UI primitives
    │   │   ├── Hero.tsx     # Landing page hero
    │   │   ├── Features.tsx # Feature grid
    │   │   ├── Platforms.tsx# Supported platforms + live status
    │   │   ├── HowItWorks.tsx
    │   │   ├── FAQ.tsx
    │   │   ├── UrlPanel.tsx # Interactive URL panel
    │   │   ├── Navigation.tsx
    │   │   └── Footer.tsx
    │   ├── lib/
    │   │   ├── api.ts       # API client & types
    │   │   ├── platforms.ts # Platform metadata + real brand icons
    │   │   └── utils.ts     # Helper functions
    │   ├── App.tsx          # Main app with routing
    │   ├── index.css        # Global styles + Tailwind
    │   └── main.tsx         # Entry point
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.ts
```

## 🔌 API Endpoints

### Health Check
```
GET /api/health
```

### Platform Status
```
GET /api/platforms
Response: { "data": [{ "id": "youtube", "name": "YouTube", "status": "working", "note": "..." }] }
```

### URL Validation
```
POST /api/validate
Body: { "url": "https://..." }
Response: { "valid": true, "platform": "TikTok" }
```

### Media Analysis
```
POST /api/analyze
Body: { "url": "https://..." }
Response: { "success": true, "data": { ...media info... } }
```

### Get Formats
```
POST /api/formats
Body: { "url": "https://..." }
Response: { "formats": [...] }
```

### Stream a Download
```
GET /api/stream?token=<signed token>&filename=<name>
```
Every media URL returned by the API carries a short-lived HMAC signed token.
Only URLs that this server's own extraction produced can be streamed, so the
endpoint can never be used as an open proxy. Forged or expired tokens get a 403.

### Legacy Platform Endpoints
```
GET /api/tiktok/download?url=...
GET /api/youtube/download?url=...
GET /api/meta/download?url=... (Instagram/Facebook)
GET /api/twitter/download?url=...
...and 15+ more
```

## 🛡️ Security Features

- **SSRF Protection** — Blocks localhost, private IPs, cloud metadata endpoints
- **DNS Validation** — Resolves hostnames to prevent private network access
- **Rate Limiting** — 30 req/min general, 10 req/min for downloads
- **Input Sanitization** — URL validation, filename sanitization
- **Security Headers** — Helmet.js with CSP, HSTS, frame protection
- **CORS** — Restricted to configured origins
- **Request IDs** — Every request tracked for debugging

## 🎨 Design System

### Colors
- **Flux Violet** — Primary brand color (`#8b4cfc`)
- **Electric Blue** — Secondary accent (`#0ea5e9`)
- **Dark** — Background scale (950-50)

### Components
- `Button` — Primary, secondary, ghost, danger variants
- `Input` / `Textarea` — With validation states
- `Card` — Glass morphism with hover effects
- `Badge` — Status indicators with variants
- `Skeleton` — Loading placeholders
- `Toast` — Notification system

### Utilities
- `cn()` — Class name merging (clsx + tailwind-merge)
- `formatFileSize()` — Human-readable file sizes
- `formatDuration()` — HH:MM:SS formatting
- `getPlatformFromUrl()` — Platform detection

## 📦 Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

The `vercel.json` handles both API and static frontend deployment.

### Docker
```dockerfile
# Backend
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]

# Frontend (multi-stage)
FROM node:20-alpine AS builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

### Traditional VPS
```bash
# Build frontend
cd frontend && npm run build && cd ..

# Start with PM2
npm i -g pm2
pm2 start index.js --name GETSocials-api
pm2 serve frontend/dist 3001 --name GETSocials-frontend --spa
pm2 save && pm2 startup
```

## ⚠️ Platform status — verified, not claimed

Platform availability is reported by the API itself (`GET /api/platforms`) and rendered
in the UI. The table below reflects what has actually been verified end to end.

| Platform | Status | How it is extracted |
|----------|--------|--------------------|
| YouTube | ✅ Working | Public InnerTube player API — up to 4K plus separate audio tracks |
| YouTube Music | ✅ Working | InnerTube player — audio streams at the original bitrate |
| Facebook | ✅ Working | yt-dlp, including DASH audio and video streams |
| Instagram | ✅ Working | instaloader |
| Bilibili | ✅ Working | yt-dlp (or OneAPI when configured) |
| Bluesky | ✅ Working | The public Bluesky API — no third-party scraper |
| Twitter / X | ✅ Working | The X web client, with yt-dlp as a fallback |
| Threads | ✅ Working | The Threads web client, with yt-dlp as a fallback |
| Reddit | ✅ Working | The authless RedDownloader API — video, images and galleries |
| Pinterest | ✅ Working | The PinterestDownloader engine — original images, GIFs and video pins |
| Pornhub | ✅ Working | The public webmasters endpoints — every available quality (18+) |
| TikTok | ✅ Working | Five strategies in turn, ending with yt-dlp |
| Terabox | ✅ Working | Terabox's own share API — direct file links |
| Kuaishou | ✅ Working | The OneAPI service (see below) |
| Douyin | ⚠️ Unreliable | Depends on a third-party extractor that changes often |
| Snapchat | ⚠️ Limited | Spotlight posts only |

**How extraction works:** every platform is tried with its own dedicated extractor
first. If that fails, the request falls back to `yt-dlp`, which keeps independent,
up-to-date extractors for most of these sites.

**Expired links are refreshed automatically.** Most platforms issue short-lived
signed media URLs. When a download fails because the URL has expired, the server
re-resolves the source page and streams the fresh link instead of failing.

**Not supported at all:** private content, age-restricted media, paywalled content,
DRM-protected media, and anything that requires signing in.

**Always possible:** external platforms change their systems at any time. If a platform
that is marked "Working" starts failing, the API reports the upstream error rather than
inventing a result.

## 🧪 Testing

```bash
# Backend
npm test

# Frontend
cd frontend && npm run test
```

### Manual Test Checklist
- [ ] Health endpoint returns 200
- [ ] URL validation rejects localhost/private IPs
- [ ] TikTok analysis returns media info
- [ ] Unsupported platform shows clear error
- [ ] Rate limiting activates after threshold
- [ ] Frontend loads on mobile viewport
- [ ] Keyboard navigation works
- [ ] Reduced motion respected

## 📝 License

Based on [universalDownloader](https://github.com/milancodess/universalDownloader) by Milan Bhandari (MIT License).

GETSocials frontend additions are also MIT licensed.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/milancodess/universalDownloader/issues)
- **Discussions:** [GitHub Discussions](https://github.com/milancodess/universalDownloader/discussions)
- **Discord:** [Join Server](https://discord.gg/qG9cCvEtA3)

---

**GETSocials** — Your media. One simple workflow.
# getsocials
