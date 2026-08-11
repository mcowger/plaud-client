# Plaud OAuth 2.0 PKCE & Authentication Guide

`plaud-client` implements Plaud's public OAuth 2.0 + PKCE authorization code flow (`platform.plaud.ai/developer/api`).

---

## OAuth Protocol Overview

- **Client Registration**: Public CLI Client (`client_f9e0b214-c11f-434b-8b95-c4497d1feb81`).
- **Authorization Endpoint**: `https://web.plaud.ai/platform/oauth`
- **Token Endpoint**: `https://platform.plaud.ai/developer/api/oauth/third-party/access-token`
- **Refresh Endpoint**: `https://platform.plaud.ai/developer/api/oauth/third-party/access-token/refresh`
- **Default Callback URI**: `http://localhost:8199/auth/callback`
- **PKCE Method**: `S256`

---

## Authentication Modes

### 1. Interactive Browser Flow

For desktop / laptop environments where local port `8199` is reachable and a browser can open:

1. `plaud-client` starts a temporary HTTP server on `127.0.0.1:8199`.
2. Generates a random 32-byte PKCE code verifier and calculates the S256 challenge.
3. Opens the system browser to the authorization URL.
4. User logs in to Plaud and clicks **Authorize**.
5. Browser redirects to `http://localhost:8199/auth/callback?code=...&state=...`.
6. `plaud-client` validates state, exchanges `code` + `code_verifier` for access and refresh tokens, and saves them to disk.

```typescript
import { PlaudClient } from "@mcowger/plaud-client";

const client = new PlaudClient();
await client.oauth.login();
```

---

### 2. Remote / Headless Manual Flow

For headless Linux servers, Docker containers, remote VPS instances, or SSH sessions:

1. `plaud-client login --manual` generates the authorization URL and prints it in the terminal.
2. The user opens the URL on any machine/browser.
3. After approving, the user is redirected to `http://localhost:8199/auth/callback?...` (which fails to open on the local laptop, but the location bar contains the full URL).
4. The user copies and pastes the callback URL (or `code` parameter) into the terminal prompt.
5. `plaud-client` exchanges the code and saves tokens.

```typescript
const { authUrl, verifier, state } = await client.oauth.startManualLogin();
console.log("Visit URL:", authUrl);

// User pastes callback URL:
await client.oauth.completeManualLogin(pastedInput, verifier, state);
```

---

## Token Lifecycle & Proactive 48-Hour Refresh

- **Access Token Lifetime**: Typically 1 to 24 hours.
- **Refresh Token Lifetime**: Long-lived session token.
- **Proactive Refresh Window**: 48 hours (`48 * 60 * 60 * 1000` ms).

### How Refresh Works in `getAccessToken()`

Every API call checks `client.oauth.getAccessToken()`:

1. Loads token set from `TokenStore`.
2. Compares `expires_at` against current system time.
3. If token is within 48 hours of expiration (or expired), attempts token refresh against `refreshUrl`.
4. If refresh succeeds, new access and refresh tokens are written to `TokenStore`.
5. If refresh fails (e.g. temporary network glitch) but the access token has not yet strictly expired, `getAccessToken()` returns the current token to prevent unnecessary service interruption.

---

## Security & Storage

- Tokens are stored at `~/.plaud/tokens.json`.
- Directory permissions are automatically set to `0700` (`rwx------`) and file permissions to `0600` (`rw-------`) on Unix systems.
- Never commit `tokens.json` to version control. `.gitignore` is configured to exclude `.plaud/`.
