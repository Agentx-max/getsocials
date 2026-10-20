# Deploying GETSocials for free

This service needs a **long-running Node.js process** that can also shell out to
Python (`yt-dlp`, `instaloader`, `pinterest-downloader`).

That rules out the usual suspects:

| Not suitable | Why |
|---|---|
| Vercel / Netlify / Cloudflare Pages | Serverless only. They cannot run a persistent Express server, cannot spawn Python, and time out long extractions. |
| Cloudflare Workers | Same serverless limits, plus a hard 128 MB memory cap. |
| GitHub Pages | Static hosting only. |

The options below all work.

---

## 1. Oracle Cloud Always Free — best all-round option

The most generous free tier that still behaves like a real server.

- **4 ARM Ampere A1 cores, 24 GB RAM, 200 GB disk — free forever**
- **10 TB/month egress** (far more than you will use)
- Runs the whole stack in one container: Node + Python + ffmpeg
- Requires a card for verification, but you are never charged

```bash
# 1. Create a free account and spin up an "Always Free" ARM VM
#    Ubuntu 22.04, 4 OCPU / 24 GB RAM, 200 GB boot volume

# 2. On the VM
git clone <your-repo> getsocials && cd getsocials
cp .env.example .env
nano .env          # set MEDIA_TOKEN_SECRET and FRONTEND_URL

docker compose up -d --build

# 3. Open port 3000 in the VM's security list (or behind a proxy)
```

**Gotcha:** Oracle's free ARM capacity is often unavailable in a region and the
signup form is refused with "Out of host capacity". Try a different region
(Amsterdam, Frankfurt, Ashburn) and retry a few times. It usually goes through.

---

## 2. Your own computer + a tunnel — free, and the most reliable

This is genuinely the best option for a personal project, because extraction
quality depends on **IP reputation**, and a home IP is not blocked.

```bash
# On your machine
npm install && cd frontend && npm install && npm run build && cd ..
npm start
```

Then expose it over HTTPS with a free tunnel:

- **Cloudflare Tunnel** (free, no account limit, custom domain)
  ```bash
  cloudflared tunnel --url http://localhost:3000
  ```
- **ngrok** (free tier, one stable domain)
- **localtunnel** — `npx localtunnel --port 3000`

The machine must stay on. A cron job or a systemd service keeps it running.

---

## 3. Other free container hosts

| Host | Free tier | Notes |
|---|---|---|
| **Hugging Face Spaces** (Docker SDK) | 2 vCPU, 16 GB RAM, persistent disk | No card needed. Sleeps when idle unless you keep it awake. Good for the API. |
| **Render** (web service) | Spins down after 15 min idle, 750 hrs/month | Supports Dockerfiles directly. Cold start on the first request. |
| **Koyeb** | 1 free instance | Supports Dockerfiles. A card has been required since Feb 2026. |
| **Fly.io** | Small app allowance | `fly launch` then `fly deploy`. |
| **Railway** | $5 trial credit | One-off credit rather than a permanent tier. |
| **Google Cloud Run** | 2M requests/month | Serverless — only viable if you drop the Python tools and rely on the pure-Node extractors. |
| **AWS EC2** | t3.micro for 12 months | 100 GB egress/month. |
| **Google Cloud e2-micro** | 1 instance, 30 GB disk | Only **1 GB egress/month** — see the warning below. |

---

## 4. Frontend and backend separately

If you would rather not run a server at all for the frontend:

- **Cloudflare Pages** — free, unlimited bandwidth, global CDN
- **Netlify** or **Vercel** — free static hosting

Build the frontend and point it at the backend:

```bash
cd frontend
VITE_API_URL=https://api.your-domain.com npm run build
# deploy the dist/ folder to Cloudflare Pages
```

Then set `FRONTEND_URL` on the backend so CORS accepts the site origin.

---

## ⚠️ Watch your egress

The API can stream media through itself (`/api/stream`). On a host with a small
egress allowance that fills up fast: a 100 MB video streamed 10 times is 1 GB.

Two ways to keep it near zero:

1. **Prefer direct downloads.** The frontend already falls back to a direct link
   when the proxy cannot reach the file. Set `MAX_BUFFERED_MB=0` in the
   environment to always download straight from the source CDN, so your server
   never carries the traffic.
2. **Raise the limit** only if you have the bandwidth.

Oracle (10 TB) and AWS (100 GB) are comfortable either way. Google Cloud's
1 GB/month is not.

---

## ⚠️ Datacenter IPs get blocked

This is the thing nobody tells you. TikTok, Instagram and Pinterest block
datacenter IP ranges aggressively. During testing on a cloud IP, TikTok replied:

> `ERROR: [TikTok] …: Your IP address is blocked from accessing this post`

YouTube, Bluesky and Reddit worked fine from the same IP.

**What this means in practice:**

- On a free cloud VM, expect TikTok and Instagram to be unreliable.
- YouTube, YouTube Music, Facebook, Bilibili, Bluesky, Twitter/X, Threads and
  Pinterest generally work.
- Running from your own home connection (option 2) gives the best results.
- If you use a cloud host, set `IG_COOKIE_FILE` / `IG_SESSION_FILE` to the
  operator's own Instagram session, and consider a proxy for TikTok.

---

## Deploy checklist

```bash
# 1. Build and verify locally
npm install
pip install yt-dlp instaloader pinterest-downloader
cd frontend && npm install && npm run build && cd ..
node test-integration.js

# 2. Set the environment
cp .env.example .env
#    MEDIA_TOKEN_SECRET  -> openssl rand -hex 32
#    FRONTEND_URL       -> your site's origin (for CORS)

# 3. Build the image
docker build -t getsocials .

# 4. Run it
docker run -d -p 3000:3000 \
  --env-file .env \
  --name getsocials \
  getsocials

# 5. Check it is alive
curl http://localhost:3000/api/health
```

### Behind a reverse proxy

For HTTPS, put Caddy or nginx in front. Caddy gives you a free Let's Encrypt
certificate in one line:

```caddy
getsocials.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

---

## Keeping it free

- The rate limits are the main cost control: `RATE_LIMIT_MAX` (default 30/min)
  and `DOWNLOAD_RATE_LIMIT_MAX` (default 10/min).
- Cloud providers offer free tiers for a reason — they expect idle services
  that use little bandwidth. This project fits that profile as long as the
  media does not stream through the server.
- Keep `MAX_BUFFERED_MB` low or set it to `0` and let browsers download
  straight from the source CDN.
