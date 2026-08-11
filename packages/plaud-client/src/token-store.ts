import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { TokenSetSchema } from "./schemas.js";
import type { TokenSet, TokenStore } from "./types.js";

/**
 * File-based token storage (~/.plaud/tokens.json by default).
 * Sets directory permissions to 0700 and file permissions to 0600 on Unix.
 */
export class FileTokenStore implements TokenStore {
  public readonly filePath: string;

  constructor(filePath?: string) {
    if (filePath) {
      this.filePath = filePath;
    } else {
      const home = process.env.HOME || process.env.USERPROFILE || os.homedir() || ".";
      this.filePath = path.join(home, ".plaud", "tokens.json");
    }
  }

  async load(): Promise<TokenSet | null> {
    try {
      const content = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(content);
      const result = TokenSetSchema.safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  async save(tokens: TokenSet): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    if (process.platform !== "win32") {
      try {
        await fs.chmod(dir, 0o700);
      } catch {
        // Ignore permission errors if platform limits it
      }
    }

    const content = JSON.stringify(tokens, null, 2);
    await fs.writeFile(this.filePath, content, "utf-8");

    if (process.platform !== "win32") {
      try {
        await fs.chmod(this.filePath, 0o600);
      } catch {
        // Ignore permission errors if platform limits it
      }
    }
  }

  async clear(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch {
      // File already missing or unlink error ignored
    }
  }
}

/**
 * In-memory token storage for testing or ephemeral sessions.
 */
export class MemoryTokenStore implements TokenStore {
  private tokens: TokenSet | null = null;

  constructor(initialTokens?: TokenSet) {
    if (initialTokens) {
      this.tokens = initialTokens;
    }
  }

  load(): TokenSet | null {
    return this.tokens ? { ...this.tokens } : null;
  }

  save(tokens: TokenSet): void {
    this.tokens = { ...tokens };
  }

  clear(): void {
    this.tokens = null;
  }
}
