"""
Instagram media probe used by the GETSocials backend.

Uses instaloader to read the post metadata and the direct media URLs.

Anonymous access from a cloud IP is heavily rate limited by Instagram, but
logged-in access is not (see the instaloader troubleshooting guide). The server
operator can therefore point ``IG_SESSION_FILE`` at their own session file to
make Instagram work reliably from a datacenter.

Usage:
  python scripts/media_probe.py instagram <url>
"""

import json
import os
import sys

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

# One Instaloader instance for the whole process. The docs are explicit that
# reinstantiating it often is what triggers rate limits, so it is created once.
_LOADER = None


def _session_path():
    path = os.environ.get("IG_SESSION_FILE")
    if path and os.path.isfile(path):
        return path
    return None


def _get_loader():
    """Returns a configured Instaloader instance, with a session if available."""
    global _LOADER
    if _LOADER is not None:
        return _LOADER

    import instaloader

    _LOADER = instaloader.Instaloader(
        quiet=True,
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        save_metadata=False,
        compress_json=False,
        user_agent=USER_AGENT,
        max_connection_attempts=2,
    )

    session = _session_path()
    if session:
        try:
            # Preferred: point instaloader at the file and load it.
            if hasattr(_LOADER.context, "set_session_filename"):
                _LOADER.context.set_session_filename(session)
            _LOADER.load_session_from_file()
            username = _LOADER.test_login()
            if username:
                _LOADER.context.username = username
        except Exception:
            # Fall back to loading the cookies directly.
            try:
                from http.cookiejar import MozillaCookieJar

                jar = MozillaCookieJar(session)
                jar.load(ignore_discard=True, ignore_expires=True)
                _LOADER.context._session.cookies.update(jar)
                _LOADER.test_login()
            except Exception:
                pass

    return _LOADER


class UserFacingError(Exception):
    """An error whose message is already written for the end user."""


def _describe_error(exc):
    """Turns an instaloader exception into a message a user can act on."""
    name = type(exc).__name__
    text = str(exc)

    if name == "LoginRequiredException":
        return (
            "Instagram requires a signed-in session for this post. "
            "The server operator can set IG_SESSION_FILE to unlock it."
        )
    if name == "TooManyRequestsException":
        return (
            "Instagram is rate limiting this server. "
            "Setting IG_SESSION_FILE avoids the stricter anonymous limits."
        )
    if name == "QueryReturnedNotFoundException":
        return "This Instagram post could not be found. It may have been deleted."
    if name == "BadResponseException":
        # Instagram returns a generic "failed" for anonymous requests from
        # cloud addresses, so point at the fix rather than the symptom.
        return (
            "Instagram refused an anonymous request from this server. "
            "Set IG_SESSION_FILE to the operator's own session to unlock it."
        )
    if name == "ProfileNotExistsException":
        return "The account behind this post no longer exists."
    if name == "PrivateProfileNotFollowedException":
        return "This post belongs to a private account."

    return f"{name}: {text}"


def _extract_shortcode(url):
    """Pulls the post shortcode out of an Instagram URL.

    The path has to be parsed properly: a share link looks like
    ``https://www.instagram.com/p/Dbh5lziMy-a/?obrf=...`` where the query
    string comes *after* the trailing slash.
    """
    from urllib.parse import urlparse

    try:
        parsed = urlparse(url)
    except ValueError:
        return None

    segments = [s for s in parsed.path.split("/") if s]

    for kind in ("p", "reel", "reels", "tv", "embed"):
        if kind in segments:
            index = segments.index(kind)
            if index + 1 < len(segments):
                code = segments[index + 1]
                # Shortcodes may contain letters, digits, dashes and underscores.
                if code and all(c.isalnum() or c in "-_" for c in code):
                    return code

    return None


def instagram(url):
    import instaloader

    L = _get_loader()

    shortcode = _extract_shortcode(url)
    if not shortcode:
        raise UserFacingError(
            "Could not find the post shortcode in that URL. "
            "Expected https://www.instagram.com/p/<shortcode>/"
        )

    try:
        post = instaloader.Post.from_shortcode(L.context, shortcode)
    except Exception as exc:
        raise UserFacingError(_describe_error(exc)) from exc

    videos = []
    images = []
    audios = []

    # A sidecar post holds several images or videos in one post.
    for node in getattr(post, "sidecar_nodes", None) or []:
        try:
            sidecar = node.get_post()
        except Exception:
            continue

        if sidecar.is_video and sidecar.video_url:
            videos.append(
                {
                    "quality": "video",
                    "format": "mp4",
                    "url": sidecar.video_url,
                    "sizeMB": None,
                }
            )
        elif sidecar.url:
            images.append(
                {
                    "quality": "Original",
                    "format": "jpg",
                    "url": sidecar.url,
                    "sizeMB": None,
                }
            )

    if post.is_video and post.video_url:
        videos.insert(
            0,
            {
                "quality": "video",
                "format": "mp4",
                "url": post.video_url,
                "sizeMB": None,
            },
        )
    elif post.url:
        images.append(
            {
                "quality": "Original",
                "format": "jpg",
                "url": post.url,
                "sizeMB": None,
            }
        )

    # A separate audio track is available for video posts on some accounts.
    try:
        if post.is_video and getattr(post, "video_url", None):
            audios.append(
                {
                    "quality": "audio",
                    "format": "m4a",
                    "url": post.video_url,
                    "sizeMB": None,
                }
            )
    except Exception:
        pass

    if not videos and not images:
        raise RuntimeError("No downloadable media was found for this Instagram post.")

    return {
        "title": post.caption[:200] if post.caption else None,
        "thumbnail": post.thumbnail_url or (post.url if not post.is_video else None),
        "duration": post.video_duration if post.is_video else None,
        "author": post.owner_username,
        "videos": videos,
        "audios": [],
        "images": images,
        "likes": post.likes,
        "comments": post.comments,
    }


def _cookie_file():
    """Path to the operator's own session cookie file, if one is configured.

    This is the *server operator's* session, never a visitor's. It is only
    used for the platforms that refuse anonymous access.
    """
    path = os.environ.get("IG_COOKIE_FILE")
    if path and os.path.isfile(path):
        return path
    return None


def _ytdlp_options():
    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "socket_timeout": 30,
        # Resilience: platforms change often, so a retry is often enough.
        "retries": 5,
        "fragment_retries": 5,
        "extractor_retries": 3,
        "file_access_retries": 3,
        "http_headers": {"User-Agent": USER_AGENT},
    }

    cookie_file = _cookie_file()
    if cookie_file:
        opts["cookiefile"] = cookie_file

    # Let the operator drop a yt-dlp config file in for their own defaults.
    config = os.environ.get("YTDL_CONFIG")
    if config and os.path.isfile(config):
        opts["config_location"] = config

    return opts


def _normalise_ytdlp(info):
    """Turns a yt-dlp info dict into the common media shape."""
    formats = info.get("formats") or []
    videos, audios, images = [], [], []

    for f in formats:
        url = f.get("url")
        if not url:
            continue

        size = f.get("filesize") or f.get("filesize_approx")
        item = {
            "quality": f.get("format_note") or f.get("height") or f.get("ext"),
            "format": f.get("ext"),
            "url": url,
            "sizeMB": round(size / 1024 / 1024, 2) if size else None,
        }

        vcodec = f.get("vcodec")
        acodec = f.get("acodec")

        if vcodec not in (None, "none") and acodec in (None, "none"):
            videos.append(item)
        elif acodec not in (None, "none") and vcodec in (None, "none"):
            audios.append(item)
        elif vcodec == "none" and acodec == "none":
            images.append(item)
        else:
            videos.append(item)

    # Fall back to the top-level media url when no formats are listed.
    if not videos and not audios and not images and info.get("url"):
        item = {
            "quality": info.get("format_note") or "Original",
            "format": info.get("ext"),
            "url": info["url"],
            "sizeMB": None,
        }
        if info.get("vcodec") in (None, "none") and info.get("acodec") not in (None, "none"):
            audios.append(item)
        else:
            videos.append(item)

    return {
        "title": info.get("title"),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),
        "author": info.get("uploader") or info.get("channel"),
        "videos": videos,
        "audios": audios,
        "images": images,
    }


def ytdlp(url):
    import yt_dlp

    try:
        with yt_dlp.YoutubeDL(_ytdlp_options()) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as exc:
        raise UserFacingError(_describe_ytdlp_error(exc)) from exc

    if not info:
        raise RuntimeError("No media found")

    return _normalise_ytdlp(info)


def _describe_ytdlp_error(exc):
    """Turns a yt-dlp error into a message that says what to do about it."""
    text = str(exc)
    lower = text.lower()

    if "sign in to confirm" in lower or "confirm you're not a bot" in lower:
        return (
            "The platform is asking this server to prove it is not a bot. "
            "Setting the operator's own cookie file (IG_COOKIE_FILE) fixes this."
        )
    if "ip address is blocked" in lower or "blocked from accessing" in lower:
        return (
            "This server's IP address is blocked by the platform. "
            "Cloud and VPN addresses are blocked far more often than home ones."
        )
    if "private" in lower and "video" in lower:
        return "This content is private and cannot be accessed."
    if "members-only" in lower or "join this channel" in lower:
        return "This content is members-only and needs a paid subscription."
    if "age-restricted" in lower or "confirm your age" in lower:
        return "This content is age-restricted and needs the operator's own session."
    if "unsupported url" in lower:
        return "The platform is not supported by the fallback extractor."
    if "does not have a valid" in lower or "no video formats" in lower:
        return "The platform returned no downloadable formats for this post."

    # Keep the original message, it is usually informative.
    return f"{type(exc).__name__}: {text}"[:300]


def facebook(url):
    return ytdlp(url)


def pinterest(url):
    from pinterest_downloader import Pinterest

    p = Pinterest(timeout=30)
    result = p.get_pin(url)

    if not result.get("ok"):
        raise RuntimeError(result.get("error", {}).get("message", "Pin not found"))

    pin = result.get("pin", {})
    images = []
    videos = []

    # Original image (also used for gifs and video posters).
    orig = (pin.get("images") or {}).get("orig") or {}
    if orig.get("url"):
        images.append(
            {
                "quality": "Original",
                "format": "gif" if pin.get("media_type") == "gif" else "jpg",
                "url": orig["url"],
                "sizeMB": None,
            }
        )

    # Video pins carry a list of MP4 / HLS variants.
    for fmt in (pin.get("video") or {}).get("formats") or []:
        url_value = fmt.get("url")
        if not url_value:
            continue
        # HLS playlists are not directly downloadable — skip them.
        if ".m3u8" in url_value:
            continue
        videos.append(
            {
                "quality": fmt.get("quality") or "video",
                "format": "mp4",
                "url": url_value,
                "sizeMB": None,
            }
        )

    return {
        "title": pin.get("title") or pin.get("description") or None,
        "thumbnail": orig.get("url") or (pin.get("video") or {}).get("poster"),
        "duration": None,
        "author": (pin.get("author") or {}).get("username"),
        "videos": videos,
        "audios": [],
        "images": images,
    }


def main():
    if len(sys.argv) < 3:
        print("usage: media_probe.py <instagram|facebook|ytdlp|pinterest> <url>", file=sys.stderr)
        return 2

    platform, url = sys.argv[1], sys.argv[2]

    try:
        if platform == "instagram":
            result = instagram(url)
        elif platform == "facebook":
            result = facebook(url)
        elif platform == "pinterest":
            result = pinterest(url)
        else:
            result = ytdlp(url)
        print(json.dumps(result))
    except UserFacingError as exc:
        # The message is already written for the end user.
        print(json.dumps({"error": str(exc)}))
        return 1
    except Exception as exc:  # noqa: BLE001 - surfaced to the Node layer
        print(json.dumps({"error": f"{type(exc).__name__}: {exc}"[:300]}))
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
