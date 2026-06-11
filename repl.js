#!/usr/bin/env node
// ENTRY POINT: node src/repl.js [optional: path/to/project]

import readline from "readline";
import fs from "fs";
import path from "path";
import { buildContext } from "./context.js";
import { chat } from "./claude.js";
import { colorize, printBanner } from "./ui.js";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const MAX_HISTORY_TURNS = 20; // rolling window to stay under context limits
const DEFAULT_PROJECT_PATH = process.argv[2] || process.cwd();
// ───────────────────────────────────────────────────────────────────────────

const history = []; // { role: "user"|"assistant", content: string }[]
let projectContext = "";
let projectPath = "";

async function init() {
  printBanner();

  const resolvedPath = path.resolve(DEFAULT_PROJECT_PATH);
  if (!fs.existsSync(resolvedPath)) {
    console.error(colorize(`Path not found: ${resolvedPath}`, "red"));
    process.exit(1);
  }

  projectPath = resolvedPath;
  console.log(colorize(`\nScanning project: ${projectPath}`, "cyan"));

  projectContext = buildContext(projectPath);
  const lineCount = projectContext.split("\n").length;
  console.log(colorize(`Context built: ~${lineCount} lines loaded\n`, "green"));
  console.log(colorize('Type your question. Commands: /reload /clear /files /exit\n', "dim"));
}

async function handleCommand(input) {
  const cmd = input.trim().toLowerCase();

  if (cmd === "/exit" || cmd === "/quit") {
    console.log(colorize("\nDone.", "cyan"));
    process.exit(0);
  }

  if (cmd === "/clear") {
    history.length = 0;
    console.log(colorize("History cleared.", "yellow"));
    return true;
  }

  if (cmd === "/reload") {
    console.log(colorize("Reloading project context...", "cyan"));
    projectContext = buildContext(projectPath);
    history.length = 0;
    console.log(colorize("Context reloaded. History cleared.", "green"));
    return true;
  }

  if (cmd === "/files") {
    const { listFiles } = await import("./context.js");
    const files = listFiles(projectPath);
    console.log(colorize(`\nLoaded files (${files.length}):`, "cyan"));
    files.forEach((f) => console.log(colorize(`  ${f}`, "dim")));
    console.log();
    return true;
  }

  return false;
}

async function run() {
  await init();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const prompt = () => rl.question(colorize("you › ", "bold"), async (input) => {
    const trimmed = input.trim();
    if (!trimmed) return prompt();

    // Handle slash commands
    if (trimmed.startsWith("/")) {
      await handleCommand(trimmed);
      return prompt();
    }

    // Add to history
    history.push({ role: "user", content: trimmed });

    // Trim history to rolling window
    while (history.length > MAX_HISTORY_TURNS * 2) {
      history.splice(0, 2); // remove oldest user+assistant pair
    }

    process.stdout.write(colorize("\nassistant › ", "green"));

    try {
      const reply = await chat(projectContext, history);
      process.stdout.write(reply + "\n\n");
      history.push({ role: "assistant", content: reply });
    } catch (err) {
      console.error(colorize(`\nAPI error: ${err.message}`, "red"));
    }

    prompt();
  });

  rl.on("close", () => {
    console.log(colorize("\nDone.", "cyan"));
    process.exit(0);
  });

  prompt();
}

run();
