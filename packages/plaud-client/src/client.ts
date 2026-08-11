import { DEFAULT_API_BASE } from "./constants.js";
import {
  ApiError,
  AuthError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
} from "./errors.js";
import { OAuthManager } from "./auth.js";
import {
  CurrentUserSchema,
  FileDetailSchema,
  FilesPageSchema,
} from "./schemas.js";
import type {
  CurrentUser,
  FileDetail,
  FileSummary,
  FilesPage,
  ListFilesOptions,
  PlaudClientConfig,
} from "./types.js";

export class PlaudClient {
  public readonly apiBase: string;
  public readonly timeoutMs: number;
  public readonly maxRetries: number;
  public readonly oauth: OAuthManager;

  constructor(config: PlaudClientConfig = {}) {
    this.apiBase = config.apiBase || DEFAULT_API_BASE;
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.oauth = new OAuthManager(config);
  }

  /**
   * Internal request wrapper with auth, retries, timeout, and typed errors.
   */
  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, string | number | undefined>;
      schema?: { parse: (data: unknown) => T };
    } = {}
  ): Promise<T> {
    const token = await this.oauth.getAccessToken();
    if (!token) {
      throw new AuthError("Not authenticated. Please run login first.");
    }

    const url = new URL(`${this.apiBase}${path}`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    let attempt = 0;
    while (true) {
      attempt++;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        };

        if (options.body) {
          headers["Content-Type"] = "application/json";
        }

        const response = await fetch(url.toString(), {
          method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const status = response.status;
          let bodyText = "";
          try {
            bodyText = await response.text();
          } catch {
            // Ignore text read error
          }

          if (status === 401 || status === 403) {
            throw new AuthError(`Authentication failed (${status}): ${bodyText}`);
          }
          if (status === 404) {
            throw new NotFoundError(`Resource not found (${path}): ${bodyText}`);
          }
          if (status === 429) {
            const retryHeader = response.headers.get("retry-after");
            const retryMs = retryHeader ? parseInt(retryHeader, 10) * 1000 : undefined;
            throw new RateLimitError("Rate limit exceeded.", retryMs);
          }

          // Format 422 error details if available
          if (status === 422) {
            let msg = bodyText;
            try {
              const json = JSON.parse(bodyText);
              if (Array.isArray(json.detail)) {
                msg = json.detail
                  .map((d: { loc?: string[]; msg?: string }) => {
                    const loc = Array.isArray(d.loc) ? d.loc.slice(-1)[0] : "";
                    return loc ? `${loc}: ${d.msg}` : d.msg;
                  })
                  .join("; ");
              }
            } catch {
              // fallback to raw bodyText
            }
            throw new ApiError(status, msg, bodyText);
          }

          // Retry on 5xx errors if within maxRetries limit
          if (status >= 500 && attempt <= this.maxRetries) {
            const backoffMs = Math.pow(2, attempt) * 200;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }

          throw new ApiError(status, response.statusText, bodyText);
        }

        const json = await response.json();
        return options.schema ? options.schema.parse(json) : (json as T);
      } catch (err: unknown) {
        clearTimeout(timeout);

        if (err instanceof AuthError || err instanceof NotFoundError || err instanceof RateLimitError || err instanceof ApiError) {
          throw err;
        }

        if (err instanceof Error && err.name === "AbortError") {
          throw new TimeoutError(`Request timed out after ${this.timeoutMs}ms.`);
        }

        if (attempt <= this.maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 200;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        throw new NetworkError(`Request failed: ${err instanceof Error ? err.message : String(err)}`, err);
      }
    }
  }

  /**
   * Fetch current user profile
   */
  async getCurrentUser(): Promise<CurrentUser> {
    return this.request<CurrentUser>("GET", "/open/third-party/users/current", {
      schema: CurrentUserSchema,
    });
  }

  /**
   * Revoke authorization for current user (best effort, ignores errors)
   */
  async revokeCurrentUser(): Promise<void> {
    try {
      await this.request("POST", "/open/third-party/users/current/revoke");
    } catch {
      // Ignore errors to match official CLI behavior
    }
  }

  /**
   * List recordings page
   */
  async listFiles(options: ListFilesOptions = {}): Promise<FilesPage> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;

    const query: Record<string, string | number | undefined> = {
      page,
      page_size: pageSize,
    };

    if (options.dateFrom) {
      query.date_from =
        options.dateFrom instanceof Date
          ? options.dateFrom.toISOString()
          : options.dateFrom;
    }

    if (options.dateTo) {
      query.date_to =
        options.dateTo instanceof Date
          ? options.dateTo.toISOString()
          : options.dateTo;
    }

    return this.request<FilesPage>("GET", "/open/third-party/files/", {
      query,
      schema: FilesPageSchema,
    });
  }

  /**
   * Get full recording details by ID
   */
  async getFile(id: string): Promise<FileDetail> {
    if (!id) {
      throw new Error("File ID is required.");
    }
    return this.request<FileDetail>("GET", `/open/third-party/files/${encodeURIComponent(id)}`, {
      schema: FileDetailSchema,
    });
  }

  /**
   * Convenience helper to retrieve presigned audio URL for a recording
   */
  async getAudioUrl(id: string): Promise<string | null> {
    const file = await this.getFile(id);
    return file.presigned_url || null;
  }

  /**
   * Async iterator over all recordings across pages
   */
  async *listFilesIterator(options: Omit<ListFilesOptions, "page"> = {}): AsyncIterableIterator<FileSummary> {
    let currentPage = 1;
    while (true) {
      const pageData = await this.listFiles({ ...options, page: currentPage });
      if (!pageData.data || pageData.data.length === 0) {
        break;
      }
      for (const item of pageData.data) {
        yield item;
      }
      if (pageData.data.length < (options.pageSize ?? 20)) {
        break;
      }
      currentPage++;
    }
  }
}
