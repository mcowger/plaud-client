# plaud-client

TypeScript client library for the Plaud API with OAuth 2.0 PKCE authentication and transcript formatters.

## Features

- **OAuth 2.0 + PKCE Auth**: Interactive local browser sign-in flow and headless token storage compatible with `~/.plaud/tokens.json`.
- **Complete REST Client**: Interacts with Plaud's developer platform API (`platform.plaud.ai/developer/api`).
- **Typed Schemas & Resilience**: Powered by Zod schemas with `.passthrough()` for forward-compatibility.
- **Transcript & Summary Utilities**: Parse segments and export to Markdown, SRT, and Plain Text.
- **Zero / Minimal Dependencies**: Requires only `zod`. Native `fetch` and Web Crypto API.

## Installation

```bash
npm install plaud-client
# or
bun add plaud-client
```

## Quick Start

```typescript
import { PlaudClient } from "plaud-client";

const client = new PlaudClient();

// Interactive OAuth Login (opens browser on port 8199)
await client.oauth.login();

// Get Current User Profile
const user = await client.getCurrentUser();
console.log("Logged in user:", user);

// List Recordings
const page = await client.listFiles({ page: 1, pageSize: 10 });
for (const file of page.data) {
  console.log(`- [${file.id}] ${file.name}`);
}

// Get File Details & Format to Markdown
if (page.data.length > 0) {
  const detail = await client.getFile(page.data[0].id);
  const markdown = fileDetailToMarkdown(detail);
  console.log(markdown);
}
```

## Advanced Usage

### Custom Token Store

By default, `plaud-client` loads and saves tokens at `~/.plaud/tokens.json` (0600 permissions on Unix). You can provide a custom `TokenStore`:

```typescript
import { PlaudClient, MemoryTokenStore } from "plaud-client";

const store = new MemoryTokenStore({
  access_token: "YOUR_ACCESS_TOKEN",
  refresh_token: "YOUR_REFRESH_TOKEN",
  token_type: "Bearer",
});

const client = new PlaudClient({ tokenStore: store });
```

### Auto-Pagination Iterator

```typescript
for await (const file of client.listFilesIterator()) {
  console.log(file.id, file.name);
}
```

### Transcript Formatters

```typescript
import {
  parseTranscriptSegments,
  segmentsToMarkdown,
  segmentsToSrt,
  segmentsToText,
} from "plaud-client";

const file = await client.getFile("REC_12345");
const segments = parseTranscriptSegments(file.source_list);

// Convert to SubRip subtitles
const srt = segmentsToSrt(segments, { "Speaker 1": "Alice", "Speaker 2": "Bob" });

// Convert to Markdown dialogs
const markdown = segmentsToMarkdown(segments);
```

## License

MIT
