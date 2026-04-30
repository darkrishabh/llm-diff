#!/usr/bin/env node
/**
 * Launcher so npm/npx always run `node …/bench-ai.mjs` (avoids broken shims
 * that try to exec `bench-ai` when it is not on PATH).
 */
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(path.join(root, "dist/cli/index.js")).href);
