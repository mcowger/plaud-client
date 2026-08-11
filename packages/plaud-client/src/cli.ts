#!/usr/bin/env node

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { PlaudClient } from "./client.js";
import {
  fileDetailToMarkdown,
  formatDuration,
  parseTranscriptSegments,
  segmentsToSrt,
  segmentsToText,
} from "./formatters.js";

async function promptInput(query: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    return await rl.question(query);
  } finally {
    rl.close();
  }
}

export async function runCli(args: string[] = process.argv.slice(2)): Promise<void> {
  const command = args[0] || "help";

  if (command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log("plaud-client v0.1.0");
    return;
  }

  const client = new PlaudClient();

  switch (command) {
    case "login": {
      const isManual = args.includes("--manual") || args.includes("--remote");
      if (isManual) {
        await handleManualLogin(client);
      } else {
        try {
          console.log("Starting interactive browser login on port " + client.oauth.callbackPort + "...");
          await client.oauth.login({ openBrowser: true });
          console.log("Logged in successfully! Tokens saved to ~/.plaud/tokens.json");
        } catch (err) {
          console.log(`Local browser login failed: ${err instanceof Error ? err.message : String(err)}`);
          console.log("\nFalling back to manual / remote logon sequence...\n");
          await handleManualLogin(client);
        }
      }
      break;
    }

    case "logout": {
      await client.oauth.logout();
      console.log("Logged out successfully.");
      break;
    }

    case "me": {
      try {
        const user = await client.getCurrentUser();
        console.log("Current User Account:");
        console.log(JSON.stringify(user, null, 2));
      } catch (err) {
        console.error(`Error fetching account details: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
      break;
    }

    case "list":
    case "files": {
      const pageIdx = args.indexOf("--page");
      const page = pageIdx !== -1 && args[pageIdx + 1] ? parseInt(args[pageIdx + 1], 10) : 1;

      const sizeIdx = args.indexOf("--pageSize");
      const pageSize = sizeIdx !== -1 && args[sizeIdx + 1] ? parseInt(args[sizeIdx + 1], 10) : 10;

      const asJson = args.includes("--json");

      try {
        const result = await client.listFiles({ page, pageSize });
        if (asJson) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`\nRecordings (Page ${result.page}):\n`);
          if (result.data.length === 0) {
            console.log("No recordings found.");
          } else {
            for (const file of result.data) {
              const name = file.name || "Untitled";
              const dur = formatDuration(file.duration);
              console.log(`- [${file.id}] ${name} (${dur}) - ${file.created_at || "N/A"}`);
            }
          }
        }
      } catch (err) {
        console.error(`Error listing files: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
      break;
    }

    case "get":
    case "show": {
      const fileId = args[1] && !args[1].startsWith("-") ? args[1] : null;
      if (!fileId) {
        console.error("Usage: plaud-client get <file_id> [--json | --markdown | --srt | --text]");
        process.exitCode = 1;
        return;
      }

      try {
        const file = await client.getFile(fileId);

        if (args.includes("--json")) {
          console.log(JSON.stringify(file, null, 2));
        } else if (args.includes("--srt")) {
          const segments = parseTranscriptSegments(file.source_list);
          console.log(segmentsToSrt(segments));
        } else if (args.includes("--text")) {
          const segments = parseTranscriptSegments(file.source_list);
          console.log(segmentsToText(segments));
        } else {
          // Default: Markdown format
          console.log(fileDetailToMarkdown(file));
        }
      } catch (err) {
        console.error(`Error getting file ${fileId}: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exitCode = 1;
      break;
  }
}

async function handleManualLogin(client: PlaudClient): Promise<void> {
  const { authUrl, verifier, state } = await client.oauth.startManualLogin();

  console.log("==================================================================");
  console.log("             Plaud Remote / Manual Logon Sequence                 ");
  console.log("==================================================================\n");
  console.log("1. Open the following URL in any browser:\n");
  console.log(`   ${authUrl}\n`);
  console.log("2. Authorize Plaud in the browser.");
  console.log("3. Copy the full callback URL from your browser's address bar");
  console.log("   (e.g., http://localhost:8199/auth/callback?code=...&state=...)");
  console.log("   or copy the 'code' parameter value.\n");

  const pastedInput = await promptInput("Paste callback URL or code here: ");
  if (!pastedInput.trim()) {
    console.error("Cancelled: No input provided.");
    process.exitCode = 1;
    return;
  }

  try {
    await client.oauth.completeManualLogin(pastedInput.trim(), verifier, state);
    console.log("\nRemote logon successful! Tokens saved to ~/.plaud/tokens.json");
  } catch (err) {
    console.error(`\nLogon failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

function printHelp(): void {
  console.log(`
Plaud API CLI tool

Usage:
  plaud-client <command> [options]

Commands:
  login                 Sign in to Plaud (browser callback by default)
  login --manual        Sign in via remote / manual callback URL paste
  logout                Sign out and remove stored tokens (~/.plaud/tokens.json)
  me                    Show current user profile
  list                  List recordings (--page <n> --pageSize <n> --json)
  get <file_id>         Show recording details (--markdown | --srt | --text | --json)
  help                  Show this help message
`);
}

const isMain =
  Boolean(process.argv[1]?.endsWith("cli.js") || process.argv[1]?.endsWith("cli.ts")) ||
  (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module);

if (isMain) {
  runCli().catch((err) => {
    console.error("Fatal error:", err);
    process.exitCode = 1;
  });
}
