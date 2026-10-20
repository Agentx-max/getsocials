// API Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  requestId?: string;
}

export interface MediaFormat {
  quality?: string | null;
  format?: string | null;
  url: string;
  sizeMB?: number | null;
  text?: string | null;
  /** Short-lived signed token used to stream the file through the API. */
  token?: string | null;
}

export interface MediaInfo {
  type: 'video' | 'photo' | 'audio' | 'mixed';
  title?: string | null;
  thumbnail?: string | null;
  duration?: number | null;
  platform: string;
  url: string;
  videos?: MediaFormat[];
  audios?: MediaFormat[];
  images?: MediaFormat[];
  downloads?: MediaFormat[];
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  services: Record<string, 'up' | 'down'>;
}

// API Client
class ApiClient {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;
  private requestTimeout: number;

  constructor(baseUrl: string = '', timeout: number = 30000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.requestTimeout = timeout;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const url = `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.defaultHeaders,
          'X-Request-ID': requestId,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      let body: unknown;
      if (isJson) {
        body = await response.json();
      } else {
        body = await response.text();
      }

      // The API always responds with an envelope: { success, data, error?, requestId }
      const envelope = (isJson ? body : null) as ApiResponse<T> | null;

      if (!response.ok) {
        const errorMessage =
          (envelope && typeof envelope.error === 'string' && envelope.error) ||
          `HTTP ${response.status}: ${response.statusText}`;

        return {
          success: false,
          error: errorMessage,
          requestId: envelope?.requestId || requestId,
        };
      }

      // Unwrap the envelope so callers get the payload directly.
      // If the body is already a bare payload (no `data` key), pass it through.
      const payload =
        envelope && typeof envelope === 'object' && 'data' in envelope
          ? envelope.data
          : (body as T);

      return {
        success: true,
        data: payload as T,
        requestId: envelope?.requestId || requestId,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout. The server took too long to respond.',
          requestId,
        };
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          success: false,
          error: 'Unable to connect to the server. Please check your connection.',
          requestId,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        requestId,
      };
    }
  }

  async healthCheck(): Promise<ApiResponse<HealthCheckResponse>> {
    return this.request<HealthCheckResponse>('/api/health');
  }

  async validateUrl(url: string): Promise<ApiResponse<{ valid: boolean; platform?: string }>> {
    return this.request('/api/validate', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async analyzeMedia(url: string): Promise<ApiResponse<MediaInfo>> {
    return this.request('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async getFormats(url: string): Promise<ApiResponse<{ formats: MediaFormat[] }>> {
    return this.request('/api/formats', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async startDownload(url: string, format: MediaFormat): Promise<ApiResponse<{ downloadUrl: string; filename: string }>> {
    return this.request('/api/download', {
      method: 'POST',
      body: JSON.stringify({ url, format }),
    });
  }

  async checkDownloadStatus(downloadId: string): Promise<ApiResponse<{ status: string; progress: number }>> {
    return this.request(`/api/download/${downloadId}/status`);
  }

  /**
   * Opens the streaming endpoint for a format. Returns the raw Response so
   * the caller can read the body as a stream and report genuine progress.
   */
  async streamMedia(
    token: string,
    filename: string
  ): Promise<{ response: Response; error?: string }> {
    const url = `${this.baseUrl}/api/stream?token=${encodeURIComponent(token)}&filename=${encodeURIComponent(filename)}`;

    try {
      const response = await fetch(url, { headers: { Accept: '*/*' } });

      if (!response.ok) {
        let message = `The download failed (HTTP ${response.status}).`;
        try {
          const body = (await response.json()) as ApiResponse;
          if (body?.error) message = body.error;
        } catch {
          /* keep the generic message */
        }
        return { response, error: message };
      }

      return { response };
    } catch (err) {
      return {
        response: new Response(null, { status: 0 }),
        error: err instanceof Error ? err.message : 'The download could not be started.',
      };
    }
  }
}

// Singleton instance
export const api = new ApiClient(
  import.meta.env.VITE_API_URL || '',
  parseInt(import.meta.env.VITE_API_TIMEOUT || '30000', 10)
);