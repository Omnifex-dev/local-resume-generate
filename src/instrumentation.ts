/**
 * Runs once when the Next.js server starts.
 *
 * This file is also compiled for the Edge runtime (middleware), which can't
 * bundle Node built-ins like node:net. So Node-only setup lives in
 * instrumentation-node.ts and is imported inside this exact
 * `process.env.NEXT_RUNTIME === "nodejs"` check, which Next.js replaces at
 * build time so the Edge bundle drops the import.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
