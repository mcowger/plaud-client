import { describe, expect, it } from "bun:test";
import { PlaudClient } from "../src/client.js";
import {
  ApiError,
  AuthError,
  NotFoundError,
  RateLimitError,
} from "../src/errors.js";
import { MemoryTokenStore } from "../src/token-store.js";

describe("PlaudClient API", () => {
  function createTestClient(options: { token?: string } = {}) {
    const store = new MemoryTokenStore(
      options.token
        ? {
            access_token: options.token,
            token_type: "Bearer",
          }
        : undefined
    );

    return new PlaudClient({
      apiBase: "https://mock.plaud.ai/developer/api",
      tokenStore: store,
      maxRetries: 1,
    });
  }

  it("throws AuthError when not logged in", async () => {
    const client = createTestClient({ token: undefined });
    await expect(client.getCurrentUser()).rejects.toThrow(AuthError);
  });

  it("fetches current user successfully", async () => {
    const client = createTestClient({ token: "valid_token" });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      expect(url).toBe("https://mock.plaud.ai/developer/api/open/third-party/users/current");
      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer valid_token");

      return new Response(
        JSON.stringify({
          id: "usr_1001",
          email: "user@example.com",
          username: "john_doe",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const user = await client.getCurrentUser();
      expect(user.id).toBe("usr_1001");
      expect(user.email).toBe("user@example.com");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("lists files with query parameters", async () => {
    const client = createTestClient({ token: "valid_token" });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      const parsedUrl = new URL(url);
      expect(parsedUrl.pathname).toBe("/developer/api/open/third-party/files/");
      expect(parsedUrl.searchParams.get("page")).toBe("2");
      expect(parsedUrl.searchParams.get("page_size")).toBe("5");
      expect(parsedUrl.searchParams.get("date_from")).toBe("2026-01-01T00:00:00.000Z");

      return new Response(
        JSON.stringify({
          data: [
            { id: "file_10", name: "Meeting A" },
            { id: "file_11", name: "Meeting B" },
          ],
          page: 2,
          total: 10,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const page = await client.listFiles({
        page: 2,
        pageSize: 5,
        dateFrom: new Date("2026-01-01T00:00:00.000Z"),
      });

      expect(page.data.length).toBe(2);
      expect(page.data[0].name).toBe("Meeting A");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("gets file details and audio url", async () => {
    const client = createTestClient({ token: "valid_token" });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      expect(url).toBe("https://mock.plaud.ai/developer/api/open/third-party/files/rec_abc123");

      return new Response(
        JSON.stringify({
          id: "rec_abc123",
          name: "Sprint Review",
          presigned_url: "https://cdn.plaud.ai/audio/rec_abc123.mp3",
          source_list: [],
          note_list: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const file = await client.getFile("rec_abc123");
      expect(file.id).toBe("rec_abc123");
      expect(file.name).toBe("Sprint Review");

      const audioUrl = await client.getAudioUrl("rec_abc123");
      expect(audioUrl).toBe("https://cdn.plaud.ai/audio/rec_abc123.mp3");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("paginates through listFilesIterator", async () => {
    const client = createTestClient({ token: "valid_token" });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      const parsedUrl = new URL(url);
      const page = parsedUrl.searchParams.get("page");

      if (page === "1") {
        return new Response(
          JSON.stringify({
            data: [{ id: "1" }, { id: "2" }],
            page: 1,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          data: [{ id: "3" }],
          page: 2,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const items = [];
      for await (const file of client.listFilesIterator({ pageSize: 2 })) {
        items.push(file.id);
      }
      expect(items).toEqual(["1", "2", "3"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles 404 NotFoundError", async () => {
    const client = createTestClient({ token: "valid_token" });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response("Not found", { status: 404 });
    }) as typeof fetch;

    try {
      await expect(client.getFile("unknown_id")).rejects.toThrow(NotFoundError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles 429 RateLimitError", async () => {
    const client = createTestClient({ token: "valid_token" });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response("Rate limit exceeded", {
        status: 429,
        headers: { "retry-after": "5" },
      });
    }) as typeof fetch;

    try {
      await expect(client.getCurrentUser()).rejects.toThrow(RateLimitError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles 422 ApiError with validation messages", async () => {
    const client = createTestClient({ token: "valid_token" });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          detail: [{ loc: ["query", "page"], msg: "value is not a valid integer" }],
        }),
        { status: 422, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      await expect(client.listFiles()).rejects.toThrow(ApiError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
