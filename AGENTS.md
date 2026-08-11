# AGENTS.md — Repository Guidance & Requirements

This document defines the scope, architecture, testing protocols, and development rules for `@mcowger/plaud-client`.

---

## 1. Project Overview & Scope

`@mcowger/plaud-client` is a publishable TypeScript SDK and CLI tool for the Plaud Developer Platform REST API (`platform.plaud.ai/developer/api`).

### In Scope

- **OAuth 2.0 + PKCE Authentication**:
  - Interactive local browser sign-in loopback server on port `8199`.
  - Remote / headless manual sign-in sequence (paste callback URL or authorization code).
  - Proactive 48-hour token auto-refresh before expiration.
  - Secure local token store at `~/.plaud/tokens.json` (`0700` dir / `0600` file permissions on Unix).
  - Pluggable `TokenStore` interface (`FileTokenStore`, `MemoryTokenStore`).
- **REST Client (`PlaudClient`)**:
  - `getCurrentUser`: User account profile.
  - `revokeCurrentUser`: Revoke authorization (best effort).
  - `listFiles`: Recording page listings with date filtering (`dateFrom`, `dateTo`).
  - `listFilesIterator`: Async iterable iterator over all recordings across pages.
  - `getFile`: Full recording details, presigned audio download URL, `source_list` (transcript), and `note_list` (AI notes).
  - `getAudioUrl`: Convenience helper for 24-hour presigned audio URL.
  - Typed error hierarchy (`PlaudError`, `AuthError`, `NotFoundError`, `RateLimitError`, `TimeoutError`, `NetworkError`, `ApiError`).
  - Exponential backoff retries for server errors (5xx).
- **Transcript & Summary Formatters**:
  - `parseTranscriptSegments`: Extracts and sorts `Segment` objects from `source_list`.
  - `extractSummaryNotes`: Parses AI notes from `note_list`.
  - `segmentsToMarkdown`, `segmentsToSrt`, `segmentsToText`, `fileDetailToMarkdown`.
- **CLI Binary (`plaud-client`)**:
  - Terminal tool supporting `login`, `login --manual`, `logout`, `me`, `list`, and `get`.

---

## 2. Technical Stack & Constraints

- **Runtime Target**: Node.js 18+, Bun 1.1+, Modern JS Runtimes.
- **Dependencies**: Minimal runtime dependencies (`zod` for payload validation). Standard Web Crypto and native `fetch` APIs.
- **Build Output**:
  - CommonJS (`dist/index.cjs`, `dist/cli.cjs`)
  - ES Modules (`dist/index.js`, `dist/cli.js`)
  - Type Declarations (`dist/index.d.ts`, `dist/index.d.cts`)
- **Package Manager**: Bun (`bun install`, `bun test`).

---

## 3. Key Development Rules & Guidelines

1. **Tool Selection**: Use built-in Read/Edit tools over shelling out to `cat`/`sed`. Use `bun test` and `bun run typecheck` for verification.
2. **Batching**: Perform independent file reads, edits, or tool calls in parallel within the same turn.
3. **Communication**: Be concise. Lead with answers; state overall approach once before execution.
4. **Git Discipline**:
   - Only commit, tag, or push when explicitly requested by the user.
   - Follow Conventional Commits (`type(scope): description`).
   - Ensure `bun.lock` is updated and synced whenever `package.json` dependencies change.

---

## 4. Verification & Testing

Every change must pass tests, typechecking, and package build verification.

### Key Commands

```bash
# Run test suite
bun test

# Run TypeScript typecheck
bun run typecheck

# Run full package build
bun run build

# Run lefthook pre-commit check manually
bun x lefthook run pre-commit
```

### Git Pre-Commit Hook

`lefthook` is configured in `lefthook.yml` to automatically run `bun test` and `bun run typecheck` in parallel before every commit.

---

## 5. CI/CD & Release Mechanics

Automated via GitHub Actions in `.github/workflows/`:

- **CI Tests (`pr-tests.yml`)**: Triggered on `pull_request` and `push` to `main`. Runs `bun install --frozen-lockfile`, `bun run typecheck`, `bun test`, and `bun run build`.
- **Publishing (`publish.yaml`)**: Triggered on git tag push (`v*`). Syncs package version from the tag (`npm pkg set version="$VERSION"`), builds the package, and publishes `@mcowger/plaud-client` to npm with provenance (`npm publish --access public --provenance`).
