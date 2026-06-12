#!/usr/bin/env node
// ENTRY POINT: bwb-code-assistant/index.js
// Interactive REPL — Claude API backend, file-system context, streaming output

import Anthropic from "@anthropic-ai/sdk";
import readline from "readline";
import fs from "fs";
import path from "path";
import os from "os";

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const CONFIG = {
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  max_file_bytes: 80_000,        // ~20k tokens of file content per load
  max_history_turns: 20,         // prune oldest pairs beyond this
  context_dir: process.cwd(),    // default: wherever you launch from
  api_key_env: "ANTHROPIC_API_KEY",
  history_file: path.join(os.homedir(), ".bwb_repl_history.json"),
};

const SYSTEM_PROMPT = `You are a precision code assistant embedded in a Termux development environment.
You have access to the developer's codebase via file contents they share with you.
Your defaults:
- Diagnose bugs with root cause analysis, not surface patches.
- Write complete, runnable code — no truncation, no placeholders.
- Flag architecture issues, not just syntax errors.
- Use the project's existing stack and conventions.
- Be direct. No preamble. No motivational filler.
When given file content, treat it as authoritative current state of that file.`;

// ─── COLORS ────────────────────────────────────────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  cyan:   "\x1b[36m",
  yellow: "\x1b[33m",
  green:  "\x1b[32m",
  red:    "\x1b[31m",
  gray:   "\x1b[90m",
};

const print = (color, ...args) => console.log(color + args.join(" ") + C.reset);

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function loadFile(filePath) {
  const resolved = path.resolve(CONFIG.context_dir, filePath);
  if (!fs.existsSync(resolved)) return { ok: false, error: `File not found: ${resolved}` };
  const stat = fs.statSync(resolved);
  if (stat.size > CONFIG.max_file_bytes) {
    return { ok: false, error: `File too large (${stat.size} bytes). Max: ${CONFIG.max_file_bytes}.` };
  }
  const content = fs.readFileSync(resolved, "utf8");
  return { ok: true, path: resolved, content, size: stat.size };
}

function scanDir(dirPath, extensions = []) {
  const resolved = path.resolve(CONFIG.context_dir, dirPath || ".");
  if (!fs.existsSync(resolved)) return [];
  const results = [];
  function walk(dir, depth = 0) {
    if (depth > 4) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (
        extensions.length === 0 ||
        extensions.some((ext) => entry.name.endsWith(ext))
      ) {
        results.push(full);
      }
    }
  }
  walk(resolved);
  return results;
}

function pruneHistory(history) {
  if (history.length <= CONFIG.max_history_turns * 2) return history;
  return history.slice(history.length - CONFIG.max_history_turns * 2);
}

function saveHistory(history) {
  try {
    fs.writeFileSync(CONFIG.history_file, JSON.stringify(history, null, 2));
  } catch (_) {}
}

function loadHistory() {
  try {
    if (fs.existsSync(CONFIG.history_file)) {
      return JSON.parse(fs.readFileSync(CONFIG.history_file, "utf8"));
    }
  } catch (_) {}
  return [];
}

// ─── COMMANDS ──────────────────────────────────────────────────────────────────
const COMMANDS = {
  ":help": () => {
    print(C.cyan, `
Commands:
  :load <file>          Inject file contents into context
  :scan [dir] [.ext]    List files in dir (optional ext filter e.g. .js .ts)
  :context              Show files currently loaded into context
  :clear                Clear loaded file context (keep chat history)
  :reset                Clear everything — context + chat history
  :save                 Save chat history to ${CONFIG.history_file}
  :dir [path]           Change working directory
  :pwd                  Print current working directory
  :exit / :quit         Exit
  :help                 Show this menu
    `.trim());
  },
};

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  const apiKey = process.env[CONFIG.api_key_env];
  if (!apiKey) {
    print(C.red, `Error: ${CONFIG.api_key_env} is not set.`);
    print(C.gray, `Run: export ${CONFIG.api_key_env}=your_key_here`);
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  let history = loadHistory();
  let loadedFiles = {}; // { filepath: content }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  print(C.bold + C.cyan, "\n╔══ BWB Code Assistant ═══════════════════╗");
  print(C.cyan, "║  Claude API · Termux · Interactive REPL  ║");
  print(C.cyan, "╚══════════════════════════════════════════╝");
  print(C.gray, `Model: ${CONFIG.model}  |  History: ${history.length / 2} turns loaded`);
  print(C.gray, `CWD: ${CONFIG.context_dir}`);
  print(C.gray, `Type :help for commands\n`);

  function buildUserMessage(userInput, fileContext) {
    if (Object.keys(fileContext).length === 0) return userInput;
    const blocks = Object.entries(fileContext)
      .map(([fp, content]) => `--- FILE: ${fp} ---\n${content}\n--- END FILE ---`)
      .join("\n\n");
    return `${blocks}\n\n${userInput}`;
  }

  async function chat(userInput) {
    const messageContent = buildUserMessage(userInput, loadedFiles);
    history.push({ role: "user", content: messageContent });
    history = pruneHistory(history);

    process.stdout.write(C.green + "\nAssistant: " + C.reset);

    let fullResponse = "";
    try {
      const stream = client.messages.stream({
        model: CONFIG.model,
        max_tokens: CONFIG.max_tokens,
        system: SYSTEM_PROMPT,
        messages: history,
      });

      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          process.stdout.write(chunk.delta.text);
          fullResponse += chunk.delta.text;
        }
      }
    } catch (err) {
      print(C.red, `\nAPI Error: ${err.message}`);
      history.pop(); // remove the failed user message
      return;
    }

    console.log("\n");
    history.push({ role: "assistant", content: fullResponse });
    saveHistory(history);
  }

  function handleCommand(input) {
    const parts = input.trim().split(/\s+/);
    const cmd = parts[0];

    if (cmd === ":exit" || cmd === ":quit") {
      print(C.gray, "Exiting.");
      rl.close();
      process.exit(0);
    }

    if (cmd === ":help") {
      COMMANDS[":help"]();
      return;
    }

    if (cmd === ":pwd") {
      print(C.cyan, CONFIG.context_dir);
      return;
    }

    if (cmd === ":dir") {
      const newDir = parts[1] ? path.resolve(parts[1]) : os.homedir();
      if (!fs.existsSync(newDir)) {
        print(C.red, `Directory not found: ${newDir}`);
      } else {
        CONFIG.context_dir = newDir;
        print(C.green, `Working directory: ${CONFIG.context_dir}`);
      }
      return;
    }

    if (cmd === ":load") {
      const filePath = parts[1];
      if (!filePath) { print(C.yellow, "Usage: :load <filepath>"); return; }
      const result = loadFile(filePath);
      if (!result.ok) { print(C.red, result.error); return; }
      loadedFiles[result.path] = result.content;
      print(C.green, `Loaded: ${result.path} (${result.size} bytes)`);
      return;
    }

    if (cmd === ":scan") {
      const dirArg  = parts[1] && !parts[1].startsWith(".") ? parts[1] : ".";
      const extArgs = parts.filter((p) => p.startsWith("."));
      const files   = scanDir(dirArg, extArgs);
      if (files.length === 0) {
        print(C.yellow, "No files found.");
      } else {
        print(C.cyan, `Found ${files.length} file(s):`);
        files.forEach((f) => print(C.gray, " " + f));
      }
      return;
    }

    if (cmd === ":context") {
      const keys = Object.keys(loadedFiles);
      if (keys.length === 0) {
        print(C.yellow, "No files loaded.");
      } else {
        print(C.cyan, "Loaded files:");
        keys.forEach((k) => print(C.gray, "  " + k));
      }
      return;
    }

    if (cmd === ":clear") {
      loadedFiles = {};
      print(C.green, "File context cleared.");
      return;
    }

    if (cmd === ":reset") {
      loadedFiles = {};
      history = [];
      saveHistory(history);
      print(C.green, "Context and history reset.");
      return;
    }

    if (cmd === ":save") {
      saveHistory(history);
      print(C.green, `History saved to ${CONFIG.history_file}`);
      return;
    }

    print(C.yellow, `Unknown command: ${cmd}. Type :help for options.`);
  }

  function prompt() {
    rl.question(C.yellow + "You: " + C.reset, async (input) => {
      const trimmed = input.trim();
      if (!trimmed) { prompt(); return; }

      if (trimmed.startsWith(":")) {
        handleCommand(trimmed);
        prompt();
      } else {
        await chat(trimmed);
        prompt();
      }
    });
  }

  prompt();
}

main();
