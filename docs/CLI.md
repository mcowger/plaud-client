# Plaud CLI Reference (`plaud-client`)

The `plaud-client` CLI provides terminal access to Plaud recordings, transcripts, AI summaries, and OAuth authentication.

---

## Global Usage

```bash
plaud-client <command> [options]
```

Global Flags:
- `--help`, `-h`: Show help documentation.
- `--version`, `-v`: Output `plaud-client` version.

---

## Commands

### 1. `login`

Authenticates your Plaud account.

```bash
# Standard browser login (opens browser on local port 8199)
plaud-client login

# Remote / manual login (for headless servers or SSH sessions)
plaud-client login --manual
# or
plaud-client login --remote
```

#### Remote Logon Sequence (`--manual`)
When using `--manual`, the CLI:
1. Prints an authorization URL.
2. Prompts you to open the URL in any browser.
3. Prompts you to paste back the resulting callback URL or authorization code.
4. Exchanges the code for tokens and saves them to `~/.plaud/tokens.json`.

---

### 2. `logout`

Clears locally stored credentials.

```bash
plaud-client logout
```

Removes `~/.plaud/tokens.json`.

---

### 3. `me`

Displays profile details for the currently authenticated account.

```bash
plaud-client me
```

Output Example:
```json
{
  "id": "usr_991823",
  "email": "user@example.com",
  "username": "johndoe",
  "nickname": "John"
}
```

---

### 4. `list` (or `files`)

Lists recordings in your account with pagination options.

```bash
plaud-client list [--page <n>] [--pageSize <n>] [--json]
```

Flags:
- `--page <n>`: Page number (default: `1`).
- `--pageSize <n>`: Results per page (default: `10`).
- `--json`: Output raw JSON response instead of human-readable list.

Example Output:
```text
Recordings (Page 1):

- [REC_881923] Q3 Product Roadmap Discussion (45m 12s) - 2026-08-10T14:30:00Z
- [REC_881920] Architecture Sync (18m 04s) - 2026-08-09T09:15:00Z
```

---

### 5. `get <file_id>` (or `show <file_id>`)

Retrieves full details for a recording and formats the output.

```bash
plaud-client get <file_id> [format_flag]
```

Format Flags:
- `--markdown` *(default)*: Renders complete Markdown document with metadata, AI summaries, and dialogs.
- `--srt`: Renders SubRip Subtitles (SRT) format.
- `--text`: Renders plain text lines.
- `--json`: Renders raw JSON payload returned by Plaud REST API.

Examples:

```bash
# Export Markdown transcript to file
plaud-client get REC_881923 --markdown > meeting-note.md

# Export SRT subtitles for video editing
plaud-client get REC_881923 --srt > subtitles.srt
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PLAUD_API_BASE` | Override API base URL | `https://platform.plaud.ai/developer/api` |
| `HOME` / `USERPROFILE` | Directory used to resolve `~/.plaud/tokens.json` | System home directory |
