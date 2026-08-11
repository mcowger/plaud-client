import { exec } from "node:child_process";
import * as crypto from "node:crypto";
import * as http from "node:http";
import {
  DEFAULT_API_BASE,
  DEFAULT_AUTH_URL,
  DEFAULT_CALLBACK_PORT,
  DEFAULT_CLIENT_ID,
  DEFAULT_REDIRECT_URI,
  DEFAULT_REFRESH_URL,
  DEFAULT_TOKEN_URL,
} from "./constants.js";
import { AuthError, NetworkError } from "./errors.js";
import { TokenResponseSchema } from "./schemas.js";
import { FileTokenStore } from "./token-store.js";
import type { PlaudClientConfig, TokenSet, TokenStore } from "./types.js";

/**
 * Base64URL encode buffer/uint8array
 */
export function base64UrlEncode(buffer: Uint8Array): string {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generate random base64url string of length `bytesLength`
 */
export function generateRandomString(bytesLength: number = 32): string {
  const bytes = crypto.randomBytes(bytesLength);
  return base64UrlEncode(bytes);
}

/**
 * Calculate S256 code challenge from code verifier
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(hash));
}

export class OAuthManager {
  public readonly clientId: string;
  public readonly redirectUri: string;
  public readonly callbackPort: number;
  public readonly authUrl: string;
  public readonly tokenUrl: string;
  public readonly refreshUrl: string;
  public readonly refreshWindowMs: number;
  public readonly tokenStore: TokenStore;

  constructor(config: PlaudClientConfig = {}) {
    this.clientId = config.clientId || DEFAULT_CLIENT_ID;
    this.redirectUri = config.redirectUri || DEFAULT_REDIRECT_URI;
    this.callbackPort = config.callbackPort || DEFAULT_CALLBACK_PORT;
    this.authUrl = config.authUrl || DEFAULT_AUTH_URL;
    this.tokenUrl = config.tokenUrl || DEFAULT_TOKEN_URL;
    this.refreshUrl = config.refreshUrl || DEFAULT_REFRESH_URL;
    this.refreshWindowMs = config.refreshWindowMs ?? 48 * 60 * 60 * 1000; // 48 hours
    this.tokenStore = config.tokenStore || new FileTokenStore();
  }

  /**
   * Get valid access token. Proactively refreshes token if expired or within refresh window (default 48h).
   */
  async getAccessToken(): Promise<string | null> {
    const tokens = await this.tokenStore.load();
    if (!tokens) {
      return null;
    }

    const now = Date.now();
    const expiresAt = tokens.expires_at ?? 0;
    const timeUntilExpiry = expiresAt - now;

    // Refresh if token is expired, or within the refresh window (default 48 hours)
    if (expiresAt && timeUntilExpiry <= this.refreshWindowMs) {
      if (tokens.refresh_token) {
        try {
          const refreshed = await this.refresh(tokens.refresh_token);
          return refreshed.access_token;
        } catch {
          // If refresh fails but current token is still valid (not strictly expired yet),
          // return existing access token so requests don't fail prematurely
          if (now < expiresAt) {
            return tokens.access_token;
          }
          return null;
        }
      }
      if (now >= expiresAt) {
        return null;
      }
    }

    return tokens.access_token;
  }

  /**
   * Exchange OAuth authorization code for access & refresh tokens
   */
  async exchange(code: string, verifier: string, state: string): Promise<TokenSet> {
    const basicAuth = Buffer.from(`${this.clientId}:`).toString("base64");
    const params = new URLSearchParams({
      code,
      redirect_uri: this.redirectUri,
      code_verifier: verifier,
      state,
    });

    let response: Response;
    try {
      response = await fetch(this.tokenUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
    } catch (err) {
      throw new NetworkError("Failed to connect to OAuth token endpoint.", err);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new AuthError(`OAuth code exchange failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const parsed = TokenResponseSchema.parse(data);

    const tokenSet: TokenSet = {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      token_type: parsed.token_type || "Bearer",
      expires_at: parsed.expires_in ? Date.now() + parsed.expires_in * 1000 : undefined,
    };

    await this.tokenStore.save(tokenSet);
    return tokenSet;
  }

  /**
   * Refresh access token using refresh token
   */
  async refresh(refreshToken: string): Promise<TokenSet> {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
    });

    let response: Response;
    try {
      response = await fetch(this.refreshUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
    } catch (err) {
      throw new NetworkError("Failed to connect to OAuth refresh endpoint.", err);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new AuthError(`OAuth token refresh failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const parsed = TokenResponseSchema.parse(data);

    const tokenSet: TokenSet = {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token || refreshToken,
      token_type: parsed.token_type || "Bearer",
      expires_at: parsed.expires_in ? Date.now() + parsed.expires_in * 1000 : undefined,
    };

    await this.tokenStore.save(tokenSet);
    return tokenSet;
  }

  /**
   * Clear local tokens
   */
  async logout(): Promise<void> {
    await this.tokenStore.clear();
  }

  /**
   * Initiate manual / remote OAuth flow.
   * Returns the authorization URL to display along with state & PKCE verifier.
   */
  async startManualLogin(): Promise<{
    authUrl: string;
    verifier: string;
    state: string;
  }> {
    const verifier = generateRandomString(32);
    const challenge = await generateCodeChallenge(verifier);
    const state = generateRandomString(16);

    const authUrl = `${this.authUrl}?client_id=${encodeURIComponent(
      this.clientId
    )}&redirect_uri=${encodeURIComponent(
      this.redirectUri
    )}&response_type=code&code_challenge=${encodeURIComponent(
      challenge
    )}&code_challenge_method=S256&state=${encodeURIComponent(state)}`;

    return { authUrl, verifier, state };
  }

  /**
   * Complete manual / remote OAuth flow by processing a pasted callback URL or authorization code.
   */
  async completeManualLogin(
    inputUrlOrCode: string,
    verifier: string,
    expectedState?: string
  ): Promise<TokenSet> {
    let code = inputUrlOrCode.trim();
    let stateParam: string | null = null;

    if (code.includes("?") || code.includes("&") || code.startsWith("http")) {
      try {
        const urlStr = code.startsWith("http")
          ? code
          : `http://localhost:${this.callbackPort}${code.startsWith("/") ? "" : "/"}${code}`;
        const url = new URL(urlStr);

        const errorParam = url.searchParams.get("error");
        if (errorParam) {
          throw new AuthError(`Authorization denied: ${errorParam}`);
        }

        const codeParam = url.searchParams.get("code");
        if (!codeParam) {
          throw new AuthError("No authorization code found in pasted URL.");
        }
        code = codeParam;
        stateParam = url.searchParams.get("state");
      } catch (err) {
        if (err instanceof AuthError) throw err;
        throw new AuthError(
          `Failed to parse pasted callback URL: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (expectedState && stateParam && stateParam !== expectedState) {
      throw new AuthError("OAuth state mismatch. The callback state does not match login state.");
    }

    return this.exchange(code, verifier, expectedState || stateParam || "");
  }

  /**
   * Run interactive PKCE login flow:
   * 1. Bind local callback listener on port 8199
   * 2. Open user browser to Plaud OAuth URL
   * 3. Catch callback with authorization code
   * 4. Exchange code for tokens and save to token store
   */
  async login(options: { openBrowser?: boolean; timeoutMs?: number } = {}): Promise<TokenSet> {
    const shouldOpenBrowser = options.openBrowser ?? true;
    const timeoutMs = options.timeoutMs ?? 120_000;

    const verifier = generateRandomString(32);
    const challenge = await generateCodeChallenge(verifier);
    const state = generateRandomString(16);

    const loginUrl = `${this.authUrl}?client_id=${encodeURIComponent(
      this.clientId
    )}&redirect_uri=${encodeURIComponent(
      this.redirectUri
    )}&response_type=code&code_challenge=${encodeURIComponent(
      challenge
    )}&code_challenge_method=S256&state=${encodeURIComponent(state)}`;

    return new Promise<TokenSet>((resolve, reject) => {
      let server: http.Server;

      const timer = setTimeout(() => {
        if (server) {
          server.close();
        }
        reject(new AuthError("Login timed out waiting for browser callback."));
      }, timeoutMs);

      server = http.createServer(async (req, res) => {
        try {
          const reqUrl = new URL(req.url || "/", `http://localhost:${this.callbackPort}`);
          if (!reqUrl.pathname.startsWith("/auth/callback")) {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(
              "<!doctype html><meta charset=utf-8><body style=\"font-family:system-ui;padding:2rem;text-align:center\"><h1>Plaud</h1><p>Continue in the original login window.</p></body>"
            );
            return;
          }

          const code = reqUrl.searchParams.get("code");
          const reqState = reqUrl.searchParams.get("state");
          const error = reqUrl.searchParams.get("error");

          if (error) {
            res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
            res.end(
              `<!doctype html><meta charset=utf-8><body style="font-family:system-ui;padding:2rem;text-align:center"><h1>Plaud Authorization Failed</h1><p>${error}</p></body>`
            );
            clearTimeout(timer);
            server.close();
            return reject(new AuthError(`Authorization denied: ${error}`));
          }

          if (reqState !== state) {
            res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
            res.end(
              "<!doctype html><meta charset=utf-8><body style=\"font-family:system-ui;padding:2rem;text-align:center\"><h1>State Mismatch</h1><p>OAuth state validation failed.</p></body>"
            );
            return;
          }

          if (!code) {
            res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
            res.end(
              "<!doctype html><meta charset=utf-8><body style=\"font-family:system-ui;padding:2rem;text-align:center\"><h1>Missing Code</h1><p>No authorization code received.</p></body>"
            );
            return;
          }

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            "<!doctype html><meta charset=utf-8><body style=\"font-family:system-ui;padding:2rem;text-align:center\"><h1>Authorization Successful</h1><p>You can close this browser tab now.</p></body>"
          );

          clearTimeout(timer);
          server.close();

          const tokenSet = await this.exchange(code, verifier, state);
          resolve(tokenSet);
        } catch (err) {
          clearTimeout(timer);
          server.close();
          reject(err);
        }
      });

      server.on("error", (err) => {
        clearTimeout(timer);
        reject(
          new AuthError(
            `Failed to bind callback server on port ${this.callbackPort}: ${err.message}`
          )
        );
      });

      server.listen(this.callbackPort, "127.0.0.1", () => {
        if (shouldOpenBrowser) {
          openSystemBrowser(loginUrl);
        }
      });
    });
  }
}

function openSystemBrowser(url: string): void {
  const platform = process.platform;
  let cmd = "";
  if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else if (platform === "win32") {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) {
      console.log(`Could not open browser automatically. Please visit:\n  ${url}`);
    }
  });
}
