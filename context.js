// ENTRY POINT: imported by repl.js
// Scans project directory and builds a context string for the Claude system prompt

import fs from "fs";
import path from "path";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_KB = 100;       // skip files larger than this
const MAX_TOTAL_CHARS = 80_000;     // hard cap on total context size
const MAX_FILE_CHARS = 8_000;       // per-file character cap (truncated with notice)

const INCLUDED_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
  ".py", ".sh", ".bash",
  ".json", ".jsonc",
  ".toml", ".yaml", ".yml",
  ".env.example",
  ".md", ".txt",
  ".html", ".css",
  ".sql",
  ".tf", ".hcl",                    // Terraform / Cloudflare
]);

const EXCLUDED_DIRS = new Set([
  "node_modules", ".git", ".github", "dist", "build",
  ".next", ".nuxt", ".cache", ".turbo",
  "coverage", "__pycache__", ".pytest_cache",
  ".wrangler",                       // Cloudflare build artifacts
]);

const EXCLUDED_FILES = new Set([
  ".DS_Store", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  ".env",                            // never include actual env files
]);
// ───────────────────────────────────────────────────────────────────────────

function shouldIncludeFile(filePath) {
  const basename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (EXCLUDED_FILES.has(basename)) return false;
  if (!INCLUDED_EXTENSIONS.has(ext) && !basename.startsWith(".env.")) return false;

  const stats = fs.statSync(filePath);
  if (stats.size > MAX_FILE_SIZE_KB * 1024) return false;

  return true;
}

function walkDir(dirPath, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        walkDir(path.join(dirPath, entry.name), results);
      }
    } else if (entry.isFile()) {
      const fullPath = path.join(dirPath, entry.name);
      if (shouldIncludeFile(fullPath)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

export function listFiles(projectPath) {
  return walkDir(projectPath);
}

export function buildContext(projectPath) {
  const files = walkDir(projectPath);
  const parts = [];
  let totalChars = 0;

  for (const filePath of files) {
    if (totalChars >= MAX_TOTAL_CHARS) {
      parts.push(`\n[Context limit reached. ${files.length - parts.length} files omitted.]`);
      break;
    }

    let content;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const relativePath = path.relative(projectPath, filePath);
    let displayContent = content;

    if (content.length > MAX_FILE_CHARS) {
      displayContent =
        content.slice(0, MAX_FILE_CHARS) +
        `\n\n[... truncated at ${MAX_FILE_CHARS} chars — file continues]`;
    }

    const block = `=== FILE: ${relativePath} ===\n${displayContent}\n`;
    parts.push(block);
    totalChars += block.length;
  }

  return parts.join("\n");
}
