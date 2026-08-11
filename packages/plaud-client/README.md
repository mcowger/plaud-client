# plaud-client

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/plaud-client.svg)](https://www.npmjs.com/package/plaud-client)

TypeScript client library and CLI for the Plaud REST API with OAuth 2.0 PKCE authentication, remote/headless sign-in, proactive 48-hour token auto-refresh, and transcript formatters.

## Features

- **OAuth 2.0 + PKCE Auth**: Interactive local browser sign-in flow and remote/headless token setup via callback URL paste.
- **Proactive Token Refresh**: Automatically refreshes access tokens 48 hours prior to expiration.
- **Complete REST Client**: Interacts with Plaud's developer platform API (`platform.plaud.ai/developer/api`).
- **Typed Schemas & Resilience**: Powered by Zod schemas with `.passthrough()` for forward-compatibility.
- **Transcript & Summary Utilities**: Parse segments and export to Markdown, SRT, Plain Text, or structured notes.
- **Terminal CLI (`plaud-client`)**: Embedded executable for login, profile inspection, file listing, and formatting.
- **Zero Heavy Dependencies**: Requires only `zod`. Uses standard Web Crypto and `fetch` APIs.

## Installation

```bash
npm install plaud-client
# or
bun add plaud-client
```

## Quick Start

### 1. SDK Usage

```typescript
import { PlaudClient, fileDetailToMarkdown } from "plaud-client";

const client = new PlaudClient();

// Interactive OAuth Login (opens browser on port 8199)
await client.oauth.login();

// Get Current User Profile
const user = await client.getCurrentUser();
console.log("Logged in user:", user);

// List Recordings Page
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

### 2. CLI Usage

```bash
# Login via local browser
plaud-client login

# Login via remote/headless callback URL paste
plaud-client login --manual

# View account profile
plaud-client me

# List recordings
plaud-client list --page 1 --pageSize 10

# Export recording as Markdown or SRT subtitles
plaud-client get <recording_id> --markdown
plaud-client get <recording_id> --srt
```

## Advanced Features

### Remote / Non-Local Login Flow

When running on a headless VPS or remote server without a local browser:

```typescript
import { PlaudClient } from "plaud-client";

const client = new PlaudClient();

// 1. Generate auth URL and PKCE state/verifier
const { authUrl, verifier, state } = await client.oauth.startManualLogin();

console.log("Open this URL in any browser:", authUrl);

// 2. Complete login after user pastes callback URL or authorization code
const pastedCallbackUrl = "http://localhost:8199/auth/callback?code=...&state=...";
await client.oauth.completeManualLogin(pastedCallbackUrl, verifier, state);
```

### Custom Token Store

By default, tokens are saved to `~/.plaud/tokens.json` (0600 permissions on Unix). You can pass a custom `TokenStore`:

```typescript
import { PlaudClient, MemoryTokenStore } from "plaud-client";

const store = new MemoryTokenStore({
  access_token: "YOUR_ACCESS_TOKEN",
  refresh_token: "YOUR_REFRESH_TOKEN",
  token_type: "Bearer",
  expires_at: Date.now() + 86400000,
});

const client = new PlaudClient({ tokenStore: store });
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

// Convert to SubRip subtitles with speaker name overrides
const srt = segmentsToSrt(segments, { "Speaker 1": "Alice", "Speaker 2": "Bob" });

// Convert to Markdown dialogs
const markdown = segmentsToMarkdown(segments, { includeTimestamps: true });
```

## Acknowledgments

Special thanks to [@lmmx](https://github.com/lmmx) and the [`plaudit`](https://github.com/lmmx/plaudit) Rust project, which served as an invaluable reference and guide for the OAuth PKCE authentication flow and Plaud REST API integration.

## License

[MIT](LICENSE)
