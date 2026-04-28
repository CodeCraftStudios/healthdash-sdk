#!/usr/bin/env node
/**
 * healthdashsdk CLI entry.
 *
 * Subcommands:
 *   healthdashsdk build           Build Next.js app and upload static assets to CDN
 *   healthdashsdk deploy          Alias for build + activate
 *   healthdashsdk status          Show current active deployment
 *   healthdashsdk purge <paths>   Invalidate edge cache for one or more paths
 *   healthdashsdk rollback <id>   Activate a previous deployment
 *
 * Auth:
 *   Reads HEALTHDASHSDK_API_KEY from env (falls back to .env.local / .env).
 *   Must be a secret key (sk_live_* or sk_test_*).
 */

import { run as runBuild } from "./commands/build.js";
import { run as runStatus } from "./commands/status.js";
import { printBanner, printError } from "./ui.js";

const COMMANDS = {
  build: runBuild,
  deploy: runBuild, // alias, activates by default
  status: runStatus,
};

async function main() {
  const [, , cmd, ...rest] = process.argv;

  if (!cmd || cmd === "-h" || cmd === "--help") {
    printBanner();
    console.log(`
Usage: healthdashsdk <command> [options]

Commands:
  build                 Build Next.js and upload static assets
  deploy                Build + activate in one step
  status                Show active deployment for this org

Environment:
  HEALTHDASHSDK_API_KEY     Secret key (sk_*) for your organization
  HEALTHDASHSDK_API_URL     Override API URL (default: https://api.healthdashsdk.com)
`);
    process.exit(0);
  }

  const handler = COMMANDS[cmd];
  if (!handler) {
    printError(`Unknown command: ${cmd}`);
    process.exit(1);
  }

  try {
    await handler(rest);
  } catch (err) {
    printError(err.message || String(err));
    if (process.env.HEALTHDASHSDK_DEBUG) console.error(err);
    process.exit(1);
  }
}

main();
