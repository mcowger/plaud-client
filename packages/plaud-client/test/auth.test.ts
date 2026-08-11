import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  base64UrlEncode,
  generateCodeChallenge,
  generateRandomString,
  OAuthManager,
} from "../src/auth.js";
import { AuthError } from "../src/errors.js";
import { FileTokenStore, MemoryTokenStore } from "../src/token-store.js";

describe("OAuth & TokenStore", () => {
  it("generates PKCE verifier and challenge", async () => {
    const str = generateRandomString(32);
    expect(str.length).toBeGreaterThan(30);

    const challenge = await generateCodeChallenge("test_verifier");
    expect(typeof challenge).toBe("string");
    expect(challenge.length).toBeGreaterThan(20);
  });

  it("encodes base64url properly", () => {
    const encoded = base64UrlEncode(new Uint8Array([255, 254, 253, 252]));
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  it("handles MemoryTokenStore operations", async () => {
    const store = new MemoryTokenStore();
    expect(await store.load()).toBeNull();

    await store.save({
      access_token: "mem_acc",
      refresh_token: "mem_ref",
      token_type: "Bearer",
      expires_at: 1000,
    });

    const loaded = await store.load();
    expect(loaded?.access_token).toBe("mem_acc");

    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it("handles FileTokenStore operations and permissions", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "plaud-test-"));
    const tokenPath = path.join(tmpDir, "sub", "tokens.json");
    const store = new FileTokenStore(tokenPath);

    expect(await store.load()).toBeNull();

    await store.save({
      access_token: "file_acc",
      refresh_token: "file_ref",
      token_type: "Bearer",
    });

    const loaded = await store.load();
    expect(loaded?.access_token).toBe("file_acc");

    await store.clear();
    expect(await store.load()).toBeNull();

    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null access token when store is empty", async () => {
    const store = new MemoryTokenStore();
    const manager = new OAuthManager({ tokenStore: store });
    expect(await manager.getAccessToken()).toBeNull();
  });

  it("proactively refreshes token expiring in 24h (within 48h refresh window)", async () => {
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    const store = new MemoryTokenStore({
      access_token: "expiring_soon_acc",
      refresh_token: "valid_ref",
      token_type: "Bearer",
      expires_at: Date.now() + twentyFourHoursMs, // Expiring in 24 hours (< 48h window)
    });

    const manager = new OAuthManager({
      tokenStore: store,
      refreshUrl: "https://mock.plaud.ai/refresh",
      refreshWindowMs: 48 * 60 * 60 * 1000, // 48h
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      if (url === "https://mock.plaud.ai/refresh") {
        return new Response(
          JSON.stringify({
            access_token: "new_refreshed_acc_48h",
            refresh_token: "new_refreshed_ref_48h",
            expires_in: 7200,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url);
    }) as typeof fetch;

    try {
      const token = await manager.getAccessToken();
      expect(token).toBe("new_refreshed_acc_48h");

      const saved = await store.load();
      expect(saved?.access_token).toBe("new_refreshed_acc_48h");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to current valid token if refresh fails before expiration", async () => {
    const tenHoursMs = 10 * 60 * 60 * 1000;
    const store = new MemoryTokenStore({
      access_token: "still_valid_acc",
      refresh_token: "failing_ref",
      token_type: "Bearer",
      expires_at: Date.now() + tenHoursMs,
    });

    const manager = new OAuthManager({
      tokenStore: store,
      refreshUrl: "https://mock.plaud.ai/refresh",
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response("Service unavailable", { status: 503 });
    }) as typeof fetch;

    try {
      const token = await manager.getAccessToken();
      // Current token is returned because it's still valid despite refresh failure
      expect(token).toBe("still_valid_acc");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("starts and completes manual remote logon flow", async () => {
    const store = new MemoryTokenStore();
    const manager = new OAuthManager({
      tokenStore: store,
      tokenUrl: "https://mock.plaud.ai/exchange",
    });

    const { authUrl, verifier, state } = await manager.startManualLogin();
    expect(authUrl).toContain("client_id=");
    expect(authUrl).toContain("response_type=code");
    expect(authUrl).toContain("code_challenge=");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          access_token: "manual_acc_123",
          refresh_token: "manual_ref_456",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      // Test completing with full pasted callback URL
      const callbackUrl = `http://localhost:8199/auth/callback?code=code_xyz123&state=${state}`;
      const tokenSet = await manager.completeManualLogin(callbackUrl, verifier, state);

      expect(tokenSet.access_token).toBe("manual_acc_123");
      expect((await store.load())?.access_token).toBe("manual_acc_123");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects manual login with mismatched state or error", async () => {
    const manager = new OAuthManager({ tokenStore: new MemoryTokenStore() });
    const { verifier, state } = await manager.startManualLogin();

    // Error param
    const errUrl = "http://localhost:8199/auth/callback?error=access_denied";
    await expect(manager.completeManualLogin(errUrl, verifier, state)).rejects.toThrow(AuthError);

    // Mismatched state
    const badStateUrl = `http://localhost:8199/auth/callback?code=code_123&state=wrong_state`;
    await expect(manager.completeManualLogin(badStateUrl, verifier, state)).rejects.toThrow(AuthError);
  });
});
