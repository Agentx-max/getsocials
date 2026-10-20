import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  cn,
  isValidUrl,
  getPlatformFromUrl,
  formatDuration,
  sanitizeFilename,
} from '../lib/utils';
import { api, type MediaInfo, type MediaFormat } from '../lib/api';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Badge,
} from './ui';
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Clipboard,
  ExternalLink,
  Download,
  Play,
  Image,
  Music,
  Video,
  Globe,
  Search,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { useToast } from './ui/Toast';
import { UNIQUE_PLATFORM_ICONS, platformIconUrl } from '../lib/platforms';

type UrlPanelState =
  | 'empty'
  | 'invalid'
  | 'validating'
  | 'analyzing'
  | 'success'
  | 'unsupported'
  | 'private'
  | 'error'
  | 'downloading'
  | 'completed';

/**
 * Files larger than this are handed straight to the browser as a direct link
 * so they are streamed to disk instead of being buffered in page memory.
 *
 * Set `VITE_MAX_BUFFERED_MB=0` to always download straight from the source
 * CDN. That keeps the server's bandwidth usage at zero, which matters on free
 * hosting tiers with small egress allowances.
 */
const MAX_BUFFERED_MB = Number(import.meta.env.VITE_MAX_BUFFERED_MB ?? 40);

/**
 * Builds a safe, descriptive download filename from the media metadata.
 */
/**
 * Brand tag appended to every downloaded file name.
 */
const FILE_NAME_TAG = 'getsocials.com';

/**
 * Builds a safe, descriptive download filename from the media metadata.
 * The site address is appended so every downloaded file carries a traceable
 * origin.
 */
function buildFilename(mediaInfo: MediaInfo, format: MediaFormat): string {
  const base = (mediaInfo.title || 'media').trim();
  const quality = format.quality ? String(format.quality).replace(/[^\w.-]+/g, '') : '';
  const ext = (format.format || 'mp4').replace(/[^\w]/g, '').toLowerCase() || 'mp4';

  const parts = [base, quality, FILE_NAME_TAG].filter(Boolean);
  const name = `${parts.join(' - ')}.${ext}`;

  return sanitizeFilename(name) || `getsocials-download.${ext}`;
}

interface UrlPanelProps {
  onAnalyze?: (url: string) => void;
}

/** Extracts the vertical resolution from a quality label such as "1080p". */
function resolutionValue(format: MediaFormat): number {
  const match = String(format.quality || '').match(/(\d{3,4})p/i);
  if (match) return parseInt(match[1], 10);
  // Fall back to the file size when the quality is not a resolution.
  return format.sizeMB || 0;
}

export function UrlPanel({ onAnalyze }: UrlPanelProps) {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<UrlPanelState>('empty');
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<MediaFormat | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ id: string; progress: number } | null>(null);
  const [analyzedUrl, setAnalyzedUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const validateUrl = useCallback((value: string): boolean => {
    return isValidUrl(value);
  }, []);

  const handleUrlChange = useCallback((value: string) => {
    setUrl(value);
    if (state === 'invalid' || state === 'error') {
      setState('empty');
      setErrorMessage('');
    }
  }, [state]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        if (validateUrl(text.trim())) {
          setState('empty');
        }
      }
    } catch {
      showToast({
        type: 'error',
        title: 'Paste failed',
        message: 'Could not read from clipboard',
      });
    }
  }, [showToast, validateUrl]);

  const handleAnalyze = useCallback(async () => {
    if (!url || !validateUrl(url)) {
      setState('invalid');
      return;
    }

    const platform = getPlatformFromUrl(url);
    if (!platform) {
      setState('unsupported');
      setErrorMessage('This platform is not currently supported');
      return;
    }

    setState('validating');
    setErrorMessage('');

    // Simulate validation delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    setState('analyzing');

    try {
      // The unified analyse endpoint already tries the platform's own scraper
      // and then the generic yt-dlp fallback, so there is no second path to
      // walk here.
      const response = await api.analyzeMedia(url);

      if (!response.success) {
        // Map the upstream failure onto a helpful state.
        const error = response.error?.toLowerCase() || '';
        if (error.includes('private') || error.includes('unauthorized') || error.includes('login') || error.includes('403')) {
          setState('private');
          setErrorMessage('This content is private or requires authorization');
        } else if (error.includes('not found') || error.includes('404') || error.includes('no media')) {
          setState('error');
          setErrorMessage('Content not found or has been removed');
        } else if (error.includes('unsupported') || error.includes('not supported')) {
          setState('unsupported');
          setErrorMessage('This type of content is not supported');
        } else {
          setState('error');
          setErrorMessage(response.error || 'Failed to analyze media');
        }
        return;
      }

      if (response.data) {
        setMediaInfo(response.data);
        setAnalyzedUrl(url);
        setState('success');
        onAnalyze?.(url);
      } else {
        setState('error');
        setErrorMessage('No media data returned');
      }
    } catch (err) {
      setState('error');
      setErrorMessage('An unexpected error occurred');
    }
  }, [url, validateUrl, onAnalyze, showToast]);

  /**
   * Downloads a format.
   *
   * Strategy:
   *  1. For files small enough to hold in memory we stream them through the
   *     API's signed endpoint. That gives genuine byte-level progress and a
   *     clean filename, and it works even when the CDN does not allow
   *     cross-origin requests.
   *  2. If the proxy cannot reach the file we fall back to a direct link so
   *     the browser can still download it natively.
   *  3. Large files always go direct — the browser streams them to disk
   *     without holding them in page memory.
   */
  const handleDownload = useCallback(
    async (format: MediaFormat) => {
      if (!mediaInfo) return;

      setSelectedFormat(format);
      setState('downloading');
      setDownloadProgress({ id: format.url, progress: 0 });

      const filename = buildFilename(mediaInfo, format);
      const sizeMB = typeof format.sizeMB === 'number' ? format.sizeMB : 0;

      /** Opens the direct source URL in a new tab so the page is not lost. */
      const openDirect = () => {
        const anchor = document.createElement('a');
        anchor.href = format.url;
        anchor.download = filename;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      };

      try {
        if (sizeMB > MAX_BUFFERED_MB) {
          // Large file — let the browser download it directly.
          openDirect();
          showToast({
            type: 'info',
            title: 'Download started',
            message: `${filename} (${format.sizeMB} MB) is downloading directly from the source.`,
          });
          setState('success');
          return;
        }

        if (!format.token) {
          openDirect();
          showToast({
            type: 'info',
            title: 'Download started',
            message: `${filename} is downloading directly from the source.`,
          });
          setState('success');
          return;
        }

        const { response, error } = await api.streamMedia(format.token, filename);

        if (error) {
          throw new Error(error);
        }

        const totalBytes = Number(response.headers.get('content-length')) || 0;
        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        if (!response.body) {
          throw new Error('Your browser cannot read streamed downloads.');
        }

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            setDownloadProgress({
              id: format.url,
              progress: totalBytes
                ? Math.min(Math.round((received / totalBytes) * 100), 99)
                : 0,
            });
          }
        }

        const blob = new Blob(chunks as BlobPart[], { type: contentType });
        const blobUrl = URL.createObjectURL(blob);

        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = filename;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        // Give the browser a moment to start the save before revoking.
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);

        setDownloadProgress({ id: format.url, progress: 100 });
        setState('completed');

        showToast({
          type: 'success',
          title: 'Download complete',
          message: `${filename} (${(received / 1024 / 1024).toFixed(1)} MB) saved to your device.`,
        });

        setTimeout(() => setState('success'), 4000);
      } catch (err) {
        // The proxy could not fetch the file. Fall back to a direct download
        // so the user still gets their media.
        const reason = err instanceof Error ? err.message : 'The download failed.';

        try {
          openDirect();
          setState('success');
          showToast({
            type: 'warning',
            title: 'Downloaded directly from source',
            message: `${reason} Your browser is downloading the file instead.`,
          });
        } catch {
          setState('success');
          showToast({
            type: 'error',
            title: 'Download failed',
            message: reason,
          });
        }
      } finally {
        setDownloadProgress(null);
      }
    },
    [mediaInfo, showToast]
  );

  const handleRetry = useCallback(() => {
    setState('empty');
    setErrorMessage('');
    setMediaInfo(null);
    setAnalyzedUrl('');
  }, []);

  /**
   * The best format available for the current URL: the highest resolution
   * video, or the highest quality audio track when there is no video.
   */
  const bestFormat = useMemo<MediaFormat | null>(() => {
    if (!mediaInfo) return null;

    const videos = mediaInfo.videos || [];
    if (videos.length > 0) {
      return [...videos].sort((a, b) => resolutionValue(b) - resolutionValue(a))[0];
    }

    const audios = mediaInfo.audios || [];
    if (audios.length > 0) {
      return [...audios].sort((a, b) => (b.sizeMB || 0) - (a.sizeMB || 0))[0];
    }

    const others = [...(mediaInfo.images || []), ...(mediaInfo.downloads || [])];
    return others.length > 0 ? others[0] : null;
  }, [mediaInfo]);

  /** True when the current URL has already been analysed and can be downloaded. */
  const canDownloadDirectly = Boolean(
    analyzedUrl && analyzedUrl === url && bestFormat && mediaInfo
  );

  /**
   * The primary action. On the first press for a URL it analyses the media and
   * reveals the available formats. On a URL that has already been analysed it
   * downloads the best available format straight away.
   */
  const handlePrimaryAction = useCallback(async () => {
    if (canDownloadDirectly && bestFormat) {
      await handleDownload(bestFormat);
      return;
    }
    await handleAnalyze();
  }, [canDownloadDirectly, bestFormat, handleDownload, handleAnalyze]);

  const handleCopyUrl = useCallback((formatUrl: string) => {
    navigator.clipboard.writeText(formatUrl).then(() => {
      showToast({
        type: 'success',
        title: 'Link copied',
        message: 'Download URL copied to clipboard',
      });
    });
  }, [showToast]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* URL Input Section */}
      <Card className="mb-6" variant="gradient-border" padding="none">
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <div className="relative">
            <label htmlFor="url-input" className="sr-only">
              Media URL
            </label>
            <div className="flex items-stretch gap-2 sm:gap-3">
              <div className="relative flex-1 min-w-0">
                <div className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-dark-500 pointer-events-none">
                  <Globe className="h-4.5 w-4.5 sm:h-5 sm:w-5" aria-hidden="true" />
                </div>
                <Input
                  ref={inputRef}
                  id="url-input"
                  type="url"
                  value={url}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUrlChange(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handlePrimaryAction()}
                  placeholder="Paste a TikTok, YouTube, Instagram or other media URL..."
                  className="pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 text-base h-12 sm:h-14"
                  error={state === 'invalid' ? 'Please enter a valid URL' : state === 'error' ? errorMessage : undefined}
                  disabled={['validating', 'analyzing', 'downloading'].includes(state)}
                  aria-describedby={state === 'invalid' || state === 'error' ? 'url-error' : undefined}
                />
              </div>

              <Button
                variant="secondary"
                onClick={handlePaste}
                disabled={['validating', 'analyzing', 'downloading'].includes(state)}
                aria-label="Paste from clipboard"
                title="Paste from clipboard"
                className="h-12 sm:h-14 w-12 sm:w-14 shrink-0 px-0"
              >
                <Clipboard className="h-4.5 w-4.5 sm:h-5 sm:w-5" aria-hidden="true" />
              </Button>

              <Button
                variant="primary"
                onClick={handlePrimaryAction}
                disabled={!url || !validateUrl(url) || ['validating', 'analyzing', 'downloading'].includes(state)}
                aria-label={canDownloadDirectly ? 'Download the best available format' : 'Analyze URL and show download options'}
                title={canDownloadDirectly ? 'Download the best available format' : 'Analyze URL and show download options'}
                className="h-12 sm:h-14 w-12 sm:w-14 shrink-0 px-0"
              >
                {/* A single spinner is rendered here rather than relying on the
                    Button's built-in loader, so the icon never doubles up. */}
                {state === 'validating' && <Search className="h-4.5 w-4.5 sm:h-5 sm:w-5 animate-spin" />}
                {state === 'analyzing' && <Loader2 className="h-4.5 w-4.5 sm:h-5 sm:w-5 animate-spin" />}
                {state !== 'validating' && state !== 'analyzing' && (
                  <Download className="h-4.5 w-4.5 sm:h-5 sm:w-5" aria-hidden="true" />
                )}
              </Button>
            </div>

            {/* Status indicator */}
            {state === 'validating' && (
              <div id="url-error" className="mt-3 flex items-center gap-2 text-electric-400" role="status" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span className="text-sm">Validating URL...</span>
              </div>
            )}
            {state === 'analyzing' && (
              <div id="url-error" className="mt-3 flex items-center gap-2 text-flux-400" role="status" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span className="text-sm">Analyzing media...</span>
              </div>
            )}
            {(state === 'invalid' || state === 'error' || state === 'unsupported' || state === 'private') && (
              <div id="url-error" className="mt-3 flex items-center gap-2 text-red-400" role="alert">
                <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm">{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Supported platforms hint */}
          <div className="mt-5">
            <p className="text-xs font-medium text-dark-500 mb-2.5 uppercase tracking-wider">
              Supported platforms
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {UNIQUE_PLATFORM_ICONS.map((platform) => (
                <span
                  key={platform.id}
                  title={platform.name}
                  className="w-8 h-8 rounded-lg bg-white/95 flex items-center justify-center overflow-hidden ring-1 ring-black/10 hover:ring-flux-500/50 transition-all hover:scale-110"
                >
                  <img
                    src={platformIconUrl(platform)}
                    alt={platform.name}
                    width={18}
                    height={18}
                    loading="lazy"
                    decoding="async"
                    className="w-[18px] h-[18px] object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                    }}
                  />
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Media Preview Section */}
      {mediaInfo && ['success', 'downloading', 'completed'].includes(state) && (
        <div className="animate-slide-up">
          <MediaPreview
            mediaInfo={mediaInfo}
            onDownload={handleDownload}
            onCopyUrl={handleCopyUrl}
            downloading={state === 'downloading'}
            downloadProgress={downloadProgress}
            selectedFormat={selectedFormat}
          />
        </div>
      )}

      {state === 'completed' && (
        <div className="mt-6 animate-slide-up">
          <Card variant="gradient-border" className="border-green-500/30" padding="none">
            <CardContent className="p-4 sm:p-6 flex items-center gap-4">
              <div className="flex-shrink-0 p-3 bg-green-500/20 rounded-xl">
                <CheckCircle className="h-6 w-6 text-green-400" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-dark-100">Download completed!</p>
                <p className="text-sm text-dark-400">The file has been saved to your device.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {state === 'unsupported' && (
        <div className="mt-6 animate-slide-up">
          <Card variant="gradient-border" className="border-amber-500/30" padding="none">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-3 bg-amber-500/20 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-amber-400" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-medium text-dark-100">Platform not supported</h3>
                  <p className="text-sm text-dark-400 mt-1">
                    We don't currently support downloading from this platform. The list of supported platforms
                    is updated regularly as we add new integrations.
                  </p>
                  <Button variant="ghost" size="sm" onClick={handleRetry} className="mt-3">
                    Try another URL
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {state === 'private' && (
        <div className="mt-6 animate-slide-up">
          <Card variant="gradient-border" className="border-amber-500/30" padding="none">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-3 bg-amber-500/20 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-amber-400" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-medium text-dark-100">Private or restricted content</h3>
                  <p className="text-sm text-dark-400 mt-1">
                    {errorMessage || 'This content is private, age-restricted, or requires authorization to access.'}
                  </p>
                  <p className="text-sm text-dark-500 mt-2">
                    GETSocials only downloads publicly accessible media that you own or are authorized to save.
                  </p>
                  <Button variant="ghost" size="sm" onClick={handleRetry} className="mt-3">
                    Try another URL
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {state === 'error' && errorMessage && (
        <div className="mt-6 animate-slide-up">
          <Card variant="gradient-border" className="border-red-500/30" padding="none">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-3 bg-red-500/20 rounded-xl">
                  <AlertCircle className="h-6 w-6 text-red-400" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-dark-100">Analysis failed</h3>
                  <p className="text-sm text-dark-400 mt-1">{errorMessage}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={handleRetry}>
                      Try again
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setUrl('')}>
                      Clear URL
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface MediaPreviewProps {
  mediaInfo: MediaInfo;
  onDownload: (format: MediaFormat) => void;
  onCopyUrl: (url: string) => void;
  downloading: boolean;
  downloadProgress: { id: string; progress: number } | null;
  selectedFormat: MediaFormat | null;
}

interface FormatGroupData {
  key: string;
  label: string;
  formats: MediaFormat[];
}

/**
 * Groups video formats by their vertical resolution (2160p, 1080p, ...) and
 * audio formats by bitrate quality. Groups are ordered from best to worst.
 */
function groupByQuality(
  formats: MediaFormat[],
  mode: 'resolution' | 'bitrate'
): FormatGroupData[] {
  const groups = new Map<string, MediaFormat[]>();

  for (const format of formats) {
    let key: string;

    if (mode === 'resolution') {
      const match = String(format.quality || '').match(/(\d{3,4})p/i);
      key = match ? match[1] : String(format.quality || 'original').toLowerCase();
    } else {
      // Audio is grouped by its quality tier (medium / low / ultralow).
      key = String(format.quality || 'audio').toLowerCase();
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(format);
  }

  return Array.from(groups.entries())
    .map(([key, items]) => ({
      key,
      label: items[0]?.quality && mode === 'resolution' ? items[0].quality : labelOf(items, mode),
      formats: items,
    }))
    .sort((a, b) => {
      const pa = parseInt(a.key, 10);
      const pb = parseInt(b.key, 10);
      if (Number.isFinite(pa) && Number.isFinite(pb)) return pb - pa;
      return a.label.localeCompare(b.label);
    });
}

function labelOf(items: MediaFormat[], mode: 'resolution' | 'bitrate'): string {
  const first = items[0];
  if (!first) return 'Original';
  const raw = String(first.quality || '');
  if (mode === 'resolution') {
    const match = raw.match(/(\d{3,4})p/i);
    return match ? `${match[1]}p` : raw || 'Original';
  }
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Audio';
}

function FormatSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 last:mb-0">
      <h4 className="text-sm font-medium text-dark-300 mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h4>
      {children}
    </div>
  );
}

/**
 * A collapsible group of formats for one resolution / bitrate.
 */
function FormatGroup({
  label,
  formats,
  onDownload,
  onCopyUrl,
  downloading,
  downloadProgress,
  selectedFormat,
}: {
  label: string;
  formats: MediaFormat[];
  onDownload: (format: MediaFormat) => void;
  onCopyUrl: (url: string) => void;
  downloading: boolean;
  downloadProgress: { id: string; progress: number } | null;
  selectedFormat: MediaFormat | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = `fmt-${label.replace(/\W+/g, '-').toLowerCase()}`;

  const sizes = formats
    .map((f) => f.sizeMB)
    .filter((s): s is number => typeof s === 'number');

  const summary =
    sizes.length > 0
      ? `${Math.min(...sizes).toFixed(1)}–${Math.max(...sizes).toFixed(1)} MB`
      : null;

  const containerIds = formats.map((f) => f.url).join('|');

  return (
    <div className="mb-2 last:mb-0">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-dark-800/40 border border-dark-700/60 hover:border-dark-600 hover:bg-dark-800/60 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-flux-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-950"
      >
        <span className="font-semibold text-dark-100 min-w-[72px]">{label}</span>

        <span className="flex-1 flex flex-wrap items-center gap-2 text-sm text-dark-500">
          {summary && <span>{summary}</span>}
          <span className="px-1.5 py-0.5 bg-dark-700 rounded text-xs">
            {formats.length} {formats.length === 1 ? 'file' : 'files'}
          </span>
          {formats.slice(0, 3).map((f, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-dark-700/70 rounded text-xs text-dark-400">
              {String(f.format || 'file').toUpperCase()}
            </span>
          ))}
        </span>

        <ChevronDown
          className={cn(
            'h-5 w-5 text-dark-400 flex-shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          id={panelId}
          className="mt-2 grid gap-2 sm:grid-cols-2 animate-slide-down"
          key={containerIds.length}
        >
          {formats.map((format, index) => (
            <FormatRow
              key={`${format.url}-${index}`}
              format={format}
              title={format.format ? format.format.toUpperCase() : 'Original'}
              onDownload={onDownload}
              onCopyUrl={onCopyUrl}
              downloading={downloading}
              downloadProgress={downloadProgress}
              selectedFormat={selectedFormat}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A single downloadable file with its size, bitrate and actions.
 */
function FormatRow({
  format,
  title,
  onDownload,
  onCopyUrl,
  downloading,
  downloadProgress,
  selectedFormat,
}: {
  format: MediaFormat;
  title: string;
  onDownload: (format: MediaFormat) => void;
  onCopyUrl: (url: string) => void;
  downloading: boolean;
  downloadProgress: { id: string; progress: number } | null;
  selectedFormat: MediaFormat | null;
}) {
  const isDownloading = downloading && selectedFormat?.url === format.url;
  const progress = downloadProgress?.id === format.url ? downloadProgress.progress : 0;
  const isSelected = selectedFormat?.url === format.url;

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl bg-dark-800/40 border border-dark-700/60 transition-colors hover:border-dark-600',
        isSelected && 'ring-1 ring-flux-500/50 bg-flux-500/5'
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-dark-200 text-sm truncate">{title}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dark-500 mt-0.5">
          {format.sizeMB != null && <span>{format.sizeMB} MB</span>}
          {format.text && <span className="truncate max-w-[160px]">{format.text}</span>}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Button
          variant={isSelected ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onDownload(format)}
          disabled={downloading && !isSelected}
          className="min-w-[76px] relative overflow-hidden"
        >
          {isDownloading ? (
            <>
              {/* Progress fill sits behind the label */}
              <span
                className="absolute inset-y-0 left-0 bg-flux-500/25 transition-[width] duration-200"
                style={{ width: `${progress}%` }}
                aria-hidden="true"
              />
              <Loader2 className="h-3.5 w-3.5 animate-spin relative" aria-hidden="true" />
              <span className="text-xs relative">{Math.round(progress)}%</span>
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-xs">Get</span>
            </>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCopyUrl(format.url)}
          className="h-8 w-8 p-0"
          aria-label={`Copy download link for ${title}`}
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function MediaPreview({
  mediaInfo,
  onDownload,
  onCopyUrl,
  downloading,
  downloadProgress,
  selectedFormat,
}: MediaPreviewProps) {
  const platform = mediaInfo.platform || 'Unknown';
  const thumbnail = mediaInfo.thumbnail;
  const title = mediaInfo.title || 'Untitled';
  const duration = mediaInfo.duration;
  const type = mediaInfo.type;

  const typeIcons = {
    video: Video,
    photo: Image,
    audio: Music,
    mixed: Sparkles,
  };

  const TypeIcon = typeIcons[type as keyof typeof typeIcons] || Video;

  const allFormats = [
    ...(mediaInfo.videos || []).map((f) => ({ ...f, category: 'Video' as const })),
    ...(mediaInfo.audios || []).map((f) => ({ ...f, category: 'Audio' as const })),
    ...(mediaInfo.images || []).map((f) => ({ ...f, category: 'Image' as const })),
    ...(mediaInfo.downloads || []).map((f) => ({ ...f, category: 'Download' as const })),
  ];

  // Group the formats by resolution (or bitrate for audio) so the panel stays
  // compact: one row per quality, with the individual files behind a toggle.
  const videoGroups = groupByQuality(mediaInfo.videos || [], 'resolution');
  const audioGroups = groupByQuality(mediaInfo.audios || [], 'bitrate');
  const flatFormats = [
    ...(mediaInfo.images || []).map((f) => ({ ...f, category: 'Image' as const })),
    ...(mediaInfo.downloads || []).map((f) => ({ ...f, category: 'Download' as const })),
  ];

  return (
    <Card variant="gradient-border">
      <CardHeader>
        <div className="flex items-start gap-4">
          {thumbnail && (
            <div className="flex-shrink-0 relative w-20 h-20 rounded-xl overflow-hidden bg-dark-800">
              <img
                src={thumbnail}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <TypeIcon className="h-5 w-5 text-flux-400" aria-hidden="true" />
              <Badge variant="violet">{platform}</Badge>
            </div>
            <h3 className="heading-sm mt-1 truncate">{title}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-dark-400">
              {duration && (
                <span className="flex items-center gap-1">
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatDuration(duration)}
                </span>
              )}
              {type === 'photo' && (
                <span className="flex items-center gap-1">
                  <Image className="h-3.5 w-3.5" aria-hidden="true" />
                  {mediaInfo.images?.length || 1} image{mediaInfo.images && mediaInfo.images.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {videoGroups.length > 0 && (
          <FormatSection title="Video" icon={<Video className="h-4 w-4 text-electric-400" />}>
            {videoGroups.map((group) => (
              <FormatGroup
                key={group.key}
                label={group.label}
                formats={group.formats}
                onDownload={onDownload}
                onCopyUrl={onCopyUrl}
                downloading={downloading}
                downloadProgress={downloadProgress}
                selectedFormat={selectedFormat}
              />
            ))}
          </FormatSection>
        )}

        {audioGroups.length > 0 && (
          <FormatSection title="Audio" icon={<Music className="h-4 w-4 text-flux-400" />}>
            {audioGroups.map((group) => (
              <FormatGroup
                key={group.key}
                label={group.label}
                formats={group.formats}
                onDownload={onDownload}
                onCopyUrl={onCopyUrl}
                downloading={downloading}
                downloadProgress={downloadProgress}
                selectedFormat={selectedFormat}
              />
            ))}
          </FormatSection>
        )}

        {flatFormats.length > 0 && (
          <FormatSection title="Files" icon={<Image className="h-4 w-4 text-green-400" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              {flatFormats.map((format, index) => (
                <FormatRow
                  key={`flat-${index}`}
                  format={format}
                  title={format.quality || format.format || 'Original'}
                  onDownload={onDownload}
                  onCopyUrl={onCopyUrl}
                  downloading={downloading}
                  downloadProgress={downloadProgress}
                  selectedFormat={selectedFormat}
                />
              ))}
            </div>
          </FormatSection>
        )}

        {allFormats.length === 0 && (
          <div className="text-center py-8 text-dark-500">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-dark-600" aria-hidden="true" />
            <p className="text-sm">No downloadable formats found for this media.</p>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <div className="flex items-center gap-3 w-full">
          <span className="text-sm text-dark-500 flex-1">
            Only download media you own or are authorized to save.
          </span>
          <a
            href={mediaInfo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="link text-sm flex items-center gap-1"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            View original
          </a>
        </div>
      </CardFooter>
    </Card>
  );
}