# Plaud API SDK Reference (`plaud-client`)

`plaud-client` is a TypeScript SDK for interacting with Plaud's developer platform (`platform.plaud.ai/developer/api`).

---

## Table of Contents

- [PlaudClient](#plaudclient)
  - [Constructor Options](#constructor-options)
  - [Methods](#methods)
    - [`getCurrentUser()`](#getcurrentuser)
    - [`revokeCurrentUser()`](#revokecurrentuser)
    - [`listFiles(options?)`](#listfilesoptions)
    - [`listFilesIterator(options?)`](#listfilesiteratoroptions)
    - [`getFile(id)`](#getfileid)
    - [`getAudioUrl(id)`](#getaudiourlid)
- [OAuthManager](#oauthmanager)
  - [Methods](#oauth-methods)
    - [`getAccessToken()`](#getaccesstoken)
    - [`login(options?)`](#loginoptions)
    - [`startManualLogin()`](#startmanuallogin)
    - [`completeManualLogin(input, verifier, state)`](#completemanuallogininput-verifier-state)
    - [`refresh(refreshToken)`](#refreshrefreshtoken)
    - [`logout()`](#logout)
- [Token Stores](#token-stores)
  - [`FileTokenStore`](#filetokenstore)
  - [`MemoryTokenStore`](#memorytokenstore)
- [Formatters & Utilities](#formatters--utilities)
  - [`parseTranscriptSegments(sourceList)`](#parsetranscriptsegmentssourcelist)
  - [`extractSummaryNotes(noteList)`](#extractsummarynotesnotelist)
  - [`segmentsToMarkdown(segments, options?)`](#segmentstomarkdownsegments-options)
  - [`segmentsToSrt(segments, speakerMap?)`](#segmentstosrtsegments-speakermap)
  - [`segmentsToText(segments, speakerMap?)`](#segmentstotextsegments-speakermap)
  - [`fileDetailToMarkdown(fileDetail, options?)`](#filedetailtomarkdownfiledetail-options)
  - [`formatDuration(msOrSeconds)`](#formatdurationmsorseconds)
- [Error Classes](#error-classes)

---

## PlaudClient

Main entry point for interacting with the Plaud REST API.

```typescript
import { PlaudClient } from "@mcowger/plaud-client";

const client = new PlaudClient(config?: PlaudClientConfig);
```

### Constructor Options

`PlaudClientConfig`:

| Option | Type | Default | Description |
|---|---|---|---|
| `apiBase` | `string` | `"https://platform.plaud.ai/developer/api"` | Base API endpoint URL |
| `authUrl` | `string` | `"https://web.plaud.ai/platform/oauth"` | OAuth authorization page URL |
| `tokenUrl` | `string` | `"https://platform.plaud.ai/developer/api/oauth/third-party/access-token"` | Token exchange endpoint |
| `refreshUrl` | `string` | `"https://platform.plaud.ai/developer/api/oauth/third-party/access-token/refresh"` | Token refresh endpoint |
| `clientId` | `string` | `"client_f9e0b214-c11f-434b-8b95-c4497d1feb81"` | Plaud public CLI client ID |
| `redirectUri` | `string` | `"http://localhost:8199/auth/callback"` | Local OAuth callback URL |
| `callbackPort` | `number` | `8199` | Local HTTP callback listener port |
| `timeoutMs` | `number` | `30000` | HTTP request timeout in milliseconds |
| `maxRetries` | `number` | `3` | Maximum retry attempts for 5xx server errors |
| `refreshWindowMs` | `number` | `172800000` (48h) | Proactive token refresh window before expiration |
| `tokenStore` | `TokenStore` | `FileTokenStore` | Storage backend for access/refresh tokens |

---

### Methods

#### `getCurrentUser()`

Returns profile details for the currently authenticated account.

```typescript
const user: CurrentUser = await client.getCurrentUser();
console.log(user.id, user.email, user.username);
```

#### `revokeCurrentUser()`

Revokes current token authorization. Ignores response errors to mirror CLI behavior.

```typescript
await client.revokeCurrentUser();
```

#### `listFiles(options?)`

Lists recordings for the account with optional pagination and date filtering.

```typescript
const page: FilesPage = await client.listFiles({
  page: 1,
  pageSize: 20,
  dateFrom: new Date("2026-01-01"),
  dateTo: new Date("2026-08-31"),
});

console.log(`Page ${page.page}, Total: ${page.total}`);
for (const file of page.data) {
  console.log(file.id, file.name, file.duration);
}
```

#### `listFilesIterator(options?)`

Async iterable iterator that yields every `FileSummary` across all pages automatically.

```typescript
for await (const file of client.listFilesIterator({ pageSize: 50 })) {
  console.log(file.id, file.name);
}
```

#### `getFile(id: string)`

Retrieves complete details for a recording, including presigned audio download URL, raw transcript segments (`source_list`), and AI summary notes (`note_list`).

```typescript
const detail: FileDetail = await client.getFile("REC_12345");
console.log("Audio URL:", detail.presigned_url);
```

#### `getAudioUrl(id: string)`

Convenience method returning the 24-hour presigned audio URL for a recording, or `null` if unavailable.

```typescript
const url: string | null = await client.getAudioUrl("REC_12345");
```

---

## OAuthManager

Accessible via `client.oauth`. Manages PKCE code generation, token exchange, refresh, and interactive/remote login flows.

### OAuth Methods

#### `getAccessToken()`

Returns a valid access token. Proactively refreshes if within `refreshWindowMs` (48 hours by default).

```typescript
const token: string | null = await client.oauth.getAccessToken();
```

#### `login(options?)`

Runs interactive PKCE login flow. Binds local HTTP listener on port 8199 and opens browser.

```typescript
await client.oauth.login({ openBrowser: true, timeoutMs: 120000 });
```

#### `startManualLogin()`

Initiates manual/remote login sequence. Returns authorization URL, state, and PKCE verifier.

```typescript
const { authUrl, verifier, state } = await client.oauth.startManualLogin();
console.log("Visit:", authUrl);
```

#### `completeManualLogin(input, verifier, state)`

Completes manual login by exchanging code or pasted callback URL for tokens.

```typescript
await client.oauth.completeManualLogin(pastedCallbackUrlOrCode, verifier, state);
```

#### `refresh(refreshToken: string)`

Exchanges refresh token for new access/refresh token pair.

```typescript
const newTokens = await client.oauth.refresh(refreshToken);
```

#### `logout()`

Clears saved tokens from the token store.

```typescript
await client.oauth.logout();
```

---

## Token Stores

### `FileTokenStore`

Saves tokens to disk at `~/.plaud/tokens.json` by default with `0600` permissions on Unix.

```typescript
import { FileTokenStore } from "@mcowger/plaud-client";

const store = new FileTokenStore("/custom/path/tokens.json");
```

### `MemoryTokenStore`

In-memory storage for testing or ephemeral server environments.

```typescript
import { MemoryTokenStore } from "@mcowger/plaud-client";

const store = new MemoryTokenStore({
  access_token: "abc...",
  refresh_token: "xyz...",
  token_type: "Bearer",
  expires_at: Date.now() + 3600000,
});
```

---

## Formatters & Utilities

#### `parseTranscriptSegments(sourceList)`

Extracts and sorts `Segment` objects from `FileDetail.source_list`.

```typescript
import { parseTranscriptSegments } from "@mcowger/plaud-client";

const segments = parseTranscriptSegments(fileDetail.source_list);
```

#### `extractSummaryNotes(noteList)`

Extracts AI summary notes from `FileDetail.note_list`.

```typescript
import { extractSummaryNotes } from "@mcowger/plaud-client";

const notes = extractSummaryNotes(fileDetail.note_list);
```

#### `segmentsToMarkdown(segments, options?)`

Converts segments into formatted Markdown dialogs.

```typescript
const md = segmentsToMarkdown(segments, {
  includeTimestamps: true,
  speakerMap: { "Speaker 1": "Alice", "Speaker 2": "Bob" },
});
```

#### `segmentsToSrt(segments, speakerMap?)`

Converts segments into SubRip Subtitles (SRT) format.

```typescript
const srt = segmentsToSrt(segments, { "Speaker 1": "Alice" });
```

#### `segmentsToText(segments, speakerMap?)`

Converts segments into plain text lines.

```typescript
const txt = segmentsToText(segments);
```

#### `fileDetailToMarkdown(fileDetail, options?)`

Generates a complete Markdown document combining recording metadata, AI summary notes, and transcript dialogs.

```typescript
const doc = fileDetailToMarkdown(fileDetail, {
  speakerMap: { "Speaker 1": "Alice" },
});
```

#### `formatDuration(msOrSeconds)`

Formats duration into readable string (`"1h 23m 45s"`).

---

## Error Classes

All client errors extend `PlaudError`:

- `AuthError`: Authentication or token error (401 / 403 or OAuth failure).
- `NotFoundError`: Requested recording or resource missing (404).
- `RateLimitError`: API rate limit exceeded (429). Contains `retryAfterMs`.
- `TimeoutError`: Request timed out.
- `NetworkError`: Connection or fetch failure.
- `ApiError`: Unhandled HTTP response status (4xx / 5xx) with `statusCode` and body details.
