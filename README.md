# Plaud API TypeScript Client & CLI (`plaud-client`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.3+-black.svg)](https://bun.sh)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org)

A modern, lightweight TypeScript SDK and CLI tool for interacting with the **Plaud API** (`platform.plaud.ai/developer/api`). 

Provides full support for OAuth 2.0 + PKCE authentication, local and remote/headless sign-in, proactive 48-hour token auto-refresh, recording listing & pagination, detail retrieval, and transcript/summary formatters.

---

## Features

- **OAuth 2.0 + PKCE Authentication**:
  - Interactive local browser sign-in loopback server on port `8199`.
  - Non-local / remote headless logon flow (paste callback URL or authorization code).
  - Proactive 48-hour token auto-refresh before expiration.
  - Secure local token persistence at `~/.plaud/tokens.json` (`0600` permissions on Unix).
  - Pluggable `TokenStore` interface (`FileTokenStore`, `MemoryTokenStore`, or custom backends).
- **Comprehensive REST API Client (`PlaudClient`)**:
  - User profile retrieval (`getCurrentUser`).
  - Recording listing with page & date range filtering (`listFiles`).
  - Async auto-pagination iterator (`listFilesIterator`).
  - Detailed recording metadata, presigned audio URLs, transcripts, and AI notes (`getFile`, `getAudioUrl`).
  - Structured error hierarchy (`AuthError`, `NotFoundError`, `RateLimitError`, `TimeoutError`, `NetworkError`, `ApiError`).
  - Automatic exponential backoff on server errors (5xx).
- **Transcript & Note Formatters**:
  - Utterance segment parsing with speaker identification and timestamp formatting.
  - Export to Markdown, SubRip Subtitles (SRT), and Plain Text.
  - Markdown note document generation combining metadata, AI summaries, and dialogs.
- **Terminal CLI (`plaud-client`)**:
  - Command line utility for interactive & remote login, logout, profile view, file listing, and formatting.

---

## Quick Start

### 1. Installation

```bash
# Install globally for CLI usage
npm install -g plaud-client

# Or install in your project as an SDK dependency
npm install plaud-client
# or
bun add plaud-client
```

### 2. CLI Usage (`plaud-client`)

```bash
# Interactive login (opens browser)
plaud-client login

# Remote / headless login (prints authorization URL, prompts for pasted callback URL/code)
plaud-client login --manual

# View account details
plaud-client me

# List recordings
plaud-client list --page 1 --pageSize 10

# Export recording transcript to Markdown, SRT, or Text
plaud-client get <recording_id> --markdown
plaud-client get <recording_id> --srt
plaud-client get <recording_id> --text
```

### 3. Programmatic SDK Usage

```typescript
import { PlaudClient, fileDetailToMarkdown } from "plaud-client";

// Initialize client (uses ~/.plaud/tokens.json by default)
const client = new PlaudClient();

// Interactive OAuth sign-in
await client.oauth.login();

// Get account details
const user = await client.getCurrentUser();
console.log(`Logged in as: ${user.email || user.username}`);

// Iterate over all recordings automatically across pages
for await (const recording of client.listFilesIterator()) {
  console.log(`Recording: [${recording.id}] ${recording.name}`);
}

// Fetch details & convert transcript to Markdown
const detail = await client.getFile("REC_12345");
const markdown = fileDetailToMarkdown(detail);
console.log(markdown);
```

---

## Detailed Documentation

- [API Reference (`docs/API.md`)](docs/API.md): Full SDK class, method, and schema reference.
- [CLI Reference (`docs/CLI.md`)](docs/CLI.md): Command-line options, flags, and workflow examples.
- [OAuth & Authentication Guide (`docs/OAUTH.md`)](docs/OAUTH.md): OAuth PKCE flow, headless remote setup, and token refresh mechanics.

---

## Monorepo Layout

```
.
├── packages/
│   └── plaud-client/       # Publishable package (dist, src, tests)
├── docs/                   # Detailed documentation
├── package.json            # Root workspace config
└── LICENSE                 # MIT License
```

---

## Building & Testing

```bash
# Install dependencies
bun install

# Run test suite (33 tests across unit & integration suites)
bun test

# Typecheck TypeScript files
bun run typecheck

# Build ESM & CJS dist packages
bun run build
```

---

## Acknowledgments

Special thanks to [@lmmx](https://github.com/lmmx) and the [`plaudit`](https://github.com/lmmx/plaudit) Rust project, which served as an invaluable reference and guide for the OAuth PKCE authentication flow and Plaud REST API integration.

---

## License

This project is licensed under the [MIT License](LICENSE).
