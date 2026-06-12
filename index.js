#!/usr/bin/env node
// ENTRY POINT: bwb-code-assistant/index.js
// Interactive REPL — Claude API, streaming, Python execution, Cloudflare memory

import Groq from "groq-sdk";
import { handleMythCommand } from "./commands/myth.js";
import readline from "readline";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync, spawnSync } from "child_process";

const CONFIG = {
  model:              "llama-3.1-8b-instant",
  max_tokens:         4096,
  max_file_bytes:     80_000,
  max_history_turns:  6,
  auto_flush_turns:   10,
  context_dir:        process.cwd(),
  groq_api_key:       process.env.GROQ_API_KEY || "REPLACE_WITH_YOUR_API_KEY",
  history_file:       path.join(os.homedir(), ".bwb_repl_history.json"),
  notes_file:         path.join(os.homedir(), ".bwb_notes.json"),
  cf_account_id:      process.env.CF_ACCOUNT_ID  || "REPLACE_WITH_ACCOUNT_ID",
  cf_kv_namespace_id: process.env.CF_KV_NS_ID    || "REPLACE_WITH_KV_NS_ID",
  cf_d1_database:     process.env.CF_D1_DB       || "bwb_memory",
  project_name:       process.env.BWB_PROJECT     || path.basename(process.cwd()),
};

const SYSTEM_MAIN = `You are a precision code assistant embedded in a Termux development environment.
You have access to the developer's codebase via file contents they share with you.
Defaults:
- Diagnose bugs with root cause analysis, not surface patches.
- Write complete, runnable code — no truncation, no placeholders.
- Flag architecture issues, not just syntax errors.
- Use the project's existing stack and conventions.
- Be direct. No preamble. No motivational filler.
When given file content, treat it as authoritative current state of that file.
When given MEMORY NOTES, treat them as established context from prior sessions.
When given PYTHON OUTPUT, treat it as runtime ground truth.`;

const SYSTEM_SIGNAL_EVAL = `You are a memory classifier for a developer's code assistant session.
Evaluate the assistant's last response and return JSON only — no preamble, no markdown fences.

Return this exact shape:
{
  "has_signal": true | false,
  "signal_type": "error" | "correction" | "decision" | "pattern" | "dead_end" | "none",
  "note": "one sentence max — what was learned or resolved",
  "tags": ["tag1", "tag2"],
  "project": "project name if mentioned"
}

has_signal = true ONLY if the response contains one of:
- An error diagnosed or resolved
- A misunderstanding corrected
- An architectural or design decision made
- A pattern or approach established
- A dead end or failed approach documented

has_signal = false for routine Q&A, explanations, or code generation with no notable event.
Tags should be lowercase, specific, hyphenated where needed.`;

const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  cyan:    "\x1b[36m",
  yellow:  "\x1b[33m",
  green:   "\x1b[32m",
  red:     "\x1b[31m",
  gray:    "\x1b[90m",
  magenta: "\x1b[35m",
};
const print = (color, ...args) => console.log(color + args.join(" ") + C.reset);

function loadFile(filePath) {
  const resolved = path.resolve(CONFIG.context_dir, filePath);
  if (!fs.existsSync(resolved)) return { ok: false, error: `Not found: ${resolved}` };
  const stat = fs.statSync(resolved);
  if (stat.size > CONFIG.max_file_bytes)
    return { ok: false, error: `Too large (${stat.size}b). Max: ${CONFIG.max_file_bytes}b` };
  return { ok: true, path: resolved, content: fs.readFileSync(resolved, "utf8"), size: stat.size };
}

function scanDir(dirPath, extensions = []) {
  const resolved = path.resolve(CONFIG.context_dir, dirPath || ".");
  if (!fs.existsSync(resolved)) return [];
  const results = [];
  function walk(dir, depth = 0) {
    if (depth > 4) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (!extensions.length || extensions.some(e => entry.name.endsWith(e)))
        results.push(full);
    }
  }
  walk(resolved);
  return results;
}

function writeFileToDisk(filename, content) {
  const target = path.resolve(CONFIG.context_dir, filename);
  fs.writeFileSync(target, content, "utf8");
  return target;
}

function extractCodeBlock(text, lang = "") {
  const pattern = lang
    ? new RegExp("```" + lang + "\\n([\\s\\S]*?)```", "i")
    : /```(?:\w+)?\n([\s\S]*?)```/;
  const match = text.match(pattern);
  return match ? match[1] : null;
}

function runPython(filePath) {
  const resolved = path.resolve(CONFIG.context_dir, filePath);
  if (!fs.existsSync(resolved)) return { ok: false, output: `File not found: ${resolved}` };
  try {
    const result = spawnSync("python3", [resolved], {
      encoding: "utf8", timeout: 30_000, cwd: CONFIG.context_dir,
    });
    const output = [
      result.stdout || "",
      result.stderr ? `STDERR:\n${result.stderr}` : "",
    ].filter(Boolean).join("\n").trim();
    return { ok: result.status === 0, exit_code: result.status, output: output || "(no output)" };
  } catch (err) {
    return { ok: false, output: `Execution error: ${err.message}` };
  }
}
function loadNotes() {
  try {
    if (fs.existsSync(CONFIG.notes_file))
      return JSON.parse(fs.readFileSync(CONFIG.notes_file, "utf8"));
  } catch (_) {}
  return [];
}

function saveNotes(notes) {
  fs.writeFileSync(CONFIG.notes_file, JSON.stringify(notes, null, 2));
}

function addNote(noteObj) {
  const notes = loadNotes();
  notes.push(noteObj);
  saveNotes(notes);
  return noteObj;
}

function getNotesByTags(tags) {
  const notes = loadNotes();
  if (!tags.length) return notes.slice(-10);
  return notes.filter(n => tags.some(t => n.tags?.includes(t)));
}

function buildNotesContext(notes) {
  if (!notes.length) return "";
  const lines = notes.map(n => `[${n.timestamp}] [${(n.tags||[]).join(", ")}] ${n.note}`);
  return `--- MEMORY NOTES ---\n${lines.join("\n")}\n--- END NOTES ---`;
}

function cfKvPut(key, value) {
  try {
    const tmpFile = path.join(os.tmpdir(), `bwb_kv_${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(value));
    execSync(`wrangler kv key put --namespace-id="${CONFIG.cf_kv_namespace_id}" "${key}" --path="${tmpFile}"`, { stdio: "pipe" });
    fs.unlinkSync(tmpFile);
    return true;
  } catch (_) { return false; }
}

function cfD1Init() {
  const sql = `CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, project TEXT, timestamp TEXT, turns TEXT, note_ids TEXT);
CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, project TEXT, timestamp TEXT, signal_type TEXT, note TEXT, tags TEXT);`;
  return cfD1Exec(sql);
}

function cfD1InsertNote(note) {
  const sql = `INSERT OR REPLACE INTO notes (id, project, timestamp, signal_type, note, tags) VALUES ('${note.id}', '${esc(note.project)}', '${note.timestamp}', '${note.signal_type}', '${esc(note.note)}', '${esc(note.tags.join(","))}');`;
  return cfD1Exec(sql);
}

function cfD1InsertConversation(convo) {
  const sql = `INSERT OR REPLACE INTO conversations (id, project, timestamp, turns, note_ids) VALUES ('${convo.id}', '${esc(convo.project)}', '${convo.timestamp}', '${esc(JSON.stringify(convo.turns))}', '${esc(convo.note_ids.join(","))}');`;
  return cfD1Exec(sql);
}

function cfD1Exec(sql) {
  try {
    const tmpFile = path.join(os.tmpdir(), `bwb_d1_${Date.now()}.sql`);
    fs.writeFileSync(tmpFile, sql);
    execSync(`wrangler d1 execute ${CONFIG.cf_d1_database} --file="${tmpFile}"`, { stdio: "pipe" });
    fs.unlinkSync(tmpFile);
    return true;
  } catch (_) { return false; }
}

function esc(str) { return String(str || "").replace(/'/g, "''"); }

async function evaluateSignal(client, lastUserMsg, lastAssistantMsg) {
  try {
    const resp = await client.chat.completions.create({
      model: CONFIG.model, max_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM_SIGNAL_EVAL },
        { role: "user", content: `USER: ${lastUserMsg}\n\nASSISTANT: ${lastAssistantMsg}` }
      ],
    });
    const raw = resp.choices[0]?.message?.content || "{}";
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch (_) { return { has_signal: false, signal_type: "none", note: "", tags: [] }; }
}

async function flushToCloudflare(history, noteIds, label = "auto") {
  const id = `conv_${Date.now()}`;
  const ts = new Date().toISOString();
  const d1 = await mcpD1InsertConversation({ id, project: CONFIG.project_name, timestamp: ts, turns: history, note_ids: noteIds });
  const kv = await mcpKvPut(`conv:${id}`, { id, project: CONFIG.project_name, timestamp: ts, turn_count: history.length / 2, note_ids: noteIds, label });
  return { id, d1, kv };
}

function saveHistory(history) {
  try { fs.writeFileSync(CONFIG.history_file, JSON.stringify(history, null, 2)); } catch (_) {}
}

function loadHistory() {
  try {
    if (fs.existsSync(CONFIG.history_file))
      return JSON.parse(fs.readFileSync(CONFIG.history_file, "utf8"));
  } catch (_) {}
  return [];
}

// ─── GITHUB API ────────────────────────────────────────────────────────────────
const GH_TOKEN = process.env.GH_TOKEN || "";
const GH_USER  = "RyanrealAF";
const GH_BASE  = "https://api.github.com";

async function ghRequest(endpoint, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      "Authorization": `Bearer ${GH_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "BWB-Code-Assistant",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${GH_BASE}${endpoint}`);
  return res.json();
}

async function ghListRepos() {
  const data = await ghRequest(`/users/${GH_USER}/repos?per_page=50&sort=updated`);
  return Array.isArray(data) ? data.map(r => r.full_name) : [];
}

async function ghListFiles(repo, dirPath = "") {
  const data = await ghRequest(`/repos/${GH_USER}/${repo}/contents/${dirPath}`);
  return Array.isArray(data) ? data.map(f => `${f.type === "dir" ? "[dir]" : "     "} ${f.name}`) : [];
}

async function ghPullFile(repo, filePath) {
  const data = await ghRequest(`/repos/${GH_USER}/${repo}/contents/${filePath}`);
  if (data.content) return Buffer.from(data.content, "base64").toString("utf8");
  return null;
}

async function ghPushFile(repo, filePath, content, message) {
  // Get current SHA if file exists
  let sha = null;
  try {
    const existing = await ghRequest(`/repos/${GH_USER}/${repo}/contents/${filePath}`);
    if (existing.sha) sha = existing.sha;
  } catch (_) {}

  const body = {
    message,
    content: Buffer.from(content).toString("base64"),
    ...(sha ? { sha } : {}),
  };
  const data = await ghRequest(`/repos/${GH_USER}/${repo}/contents/${filePath}`, "PUT", body);
  return data.commit ? data.commit.sha : null;
}


// ─── CLOUDFLARE REST API ───────────────────────────────────────────────────────
const CF_BASE    = "https://api.cloudflare.com/client/v4";
const CF_TOKEN   = process.env.CLOUDFLARE_API_TOKEN || "";
const CF_ACCOUNT = process.env.CF_ACCOUNT_ID        || "";
const CF_KV_NS   = process.env.CF_KV_NS_ID          || "";
const CF_D1_ID   = process.env.CF_D1_DB_ID          || "";

async function cfKvPutRest(key, value) {
  if (!CF_TOKEN || !CF_ACCOUNT || !CF_KV_NS) return false;
  try {
    const res = await fetch(
      `${CF_BASE}/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${CF_KV_NS}/values/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        headers: { "Authorization": `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(value),
      }
    );
    return res.ok;
  } catch (_) { return false; }
}

async function cfD1ExecRest(sql) {
  if (!CF_TOKEN || !CF_ACCOUNT || !CF_D1_ID) return false;
  try {
    const res = await fetch(
      `${CF_BASE}/accounts/${CF_ACCOUNT}/d1/database/${CF_D1_ID}/query`,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
      }
    );
    const data = await res.json();
    return data.success === true;
  } catch (_) { return false; }
}

async function cfD1InitRest() {
  await cfD1ExecRest(`CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, project TEXT, timestamp TEXT, turns TEXT, note_ids TEXT)`);
  await cfD1ExecRest(`CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, project TEXT, timestamp TEXT, signal_type TEXT, note TEXT, tags TEXT)`);
}

async function cfD1InsertNoteRest(note) {
  const sql = `INSERT OR REPLACE INTO notes (id, project, timestamp, signal_type, note, tags) VALUES ('${note.id}', '${esc(note.project)}', '${note.timestamp}', '${note.signal_type}', '${esc(note.note)}', '${esc(note.tags.join(","))}')`;
  return cfD1ExecRest(sql);
}

async function cfD1InsertConversationRest(convo) {
  const sql = `INSERT OR REPLACE INTO conversations (id, project, timestamp, turns, note_ids) VALUES ('${convo.id}', '${esc(convo.project)}', '${convo.timestamp}', '${esc(JSON.stringify(convo.turns))}', '${esc(convo.note_ids.join(","))}')`;
  return cfD1ExecRest(sql);
}


// ─── CLOUDFLARE MCP CLIENT ─────────────────────────────────────────────────────
// Routes KV and D1 operations through Cloudflare MCP server
// Falls back to REST API if MCP call fails

const CF_MCP_URL = "https://bindings.mcp.cloudflare.com/mcp";

async function mcpCall(tool, params) {
  if (!CF_TOKEN) return null;
  try {
    const res = await fetch(CF_MCP_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: tool, arguments: params },
      }),
    });
    const data = await res.json();
    if (data.result?.content?.[0]?.text) {
      try { return JSON.parse(data.result.content[0].text); }
      catch (_) { return data.result.content[0].text; }
    }
    return null;
  } catch (_) { return null; }
}

async function mcpKvPut(key, value) {
  const result = await mcpCall("kv_put", {
    namespaceId: CF_KV_NS,
    key,
    value: JSON.stringify(value),
  });
  if (result !== null) return true;
  // fallback to REST
  return cfKvPutRest(key, value);
}

async function mcpD1Exec(sql) {
  const result = await mcpCall("d1_database_query", {
    databaseId: CF_D1_ID,
    sql,
  });
  if (result !== null) return true;
  // fallback to REST
  return cfD1ExecRest(sql);
}

async function mcpD1Init() {
  await mcpD1Exec(`CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, project TEXT, timestamp TEXT, turns TEXT, note_ids TEXT)`);
  await mcpD1Exec(`CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, project TEXT, timestamp TEXT, signal_type TEXT, note TEXT, tags TEXT)`);
}

async function mcpD1InsertNote(note) {
  const sql = `INSERT OR REPLACE INTO notes (id, project, timestamp, signal_type, note, tags) VALUES ('${note.id}', '${esc(note.project)}', '${note.timestamp}', '${note.signal_type}', '${esc(note.note)}', '${esc(note.tags.join(","))}')`;
  return mcpD1Exec(sql);
}

async function mcpD1InsertConversation(convo) {
  const sql = `INSERT OR REPLACE INTO conversations (id, project, timestamp, turns, note_ids) VALUES ('${convo.id}', '${esc(convo.project)}', '${convo.timestamp}', '${esc(JSON.stringify(convo.turns))}', '${esc(convo.note_ids.join(","))}')`;
  return mcpD1Exec(sql);
}


// ─── FILE SYSTEM MCP ───────────────────────────────────────────────────────────
function fsReadNumbered(filePath) {
  const resolved = path.resolve(CONFIG.context_dir, filePath);
  if (!fs.existsSync(resolved)) return null;
  const lines = fs.readFileSync(resolved, "utf8").split("\n");
  return lines.map((l, i) => `${String(i+1).padStart(4)} | ${l}`).join("\n");
}

function fsEdit(filePath, oldStr, newStr) {
  const resolved = path.resolve(CONFIG.context_dir, filePath);
  if (!fs.existsSync(resolved)) return { ok: false, error: "File not found" };
  const content = fs.readFileSync(resolved, "utf8");
  if (!content.includes(oldStr)) return { ok: false, error: "String not found in file" };
  const count = content.split(oldStr).length - 1;
  if (count > 1) return { ok: false, error: `Ambiguous — '${oldStr}' appears ${count} times` };
  fs.writeFileSync(resolved, content.replace(oldStr, newStr));
  return { ok: true };
}

function fsDiff(filePath, originalContent) {
  const resolved = path.resolve(CONFIG.context_dir, filePath);
  if (!fs.existsSync(resolved)) return null;
  const current = fs.readFileSync(resolved, "utf8").split("\n");
  const original = originalContent.split("\n");
  const changes = [];
  const maxLen = Math.max(current.length, original.length);
  for (let i = 0; i < maxLen; i++) {
    if (current[i] !== original[i]) {
      if (original[i] !== undefined) changes.push(`- ${String(i+1).padStart(4)} | ${original[i]}`);
      if (current[i]  !== undefined) changes.push(`+ ${String(i+1).padStart(4)} | ${current[i]}`);
    }
  }
  return changes.length ? changes.join("\n") : "(no changes)";
}

function fsTree(dirPath, prefix = "", depth = 0) {
  if (depth > 3) return "";
  const resolved = path.resolve(CONFIG.context_dir, dirPath || ".");
  if (!fs.existsSync(resolved)) return "Not found";
  const entries = fs.readdirSync(resolved, { withFileTypes: true })
    .filter(e => !e.name.startsWith(".") && e.name !== "node_modules");
  return entries.map((e, i) => {
    const isLast = i === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const line = prefix + connector + e.name;
    if (e.isDirectory()) {
      const sub = fsTree(path.join(dirPath || ".", e.name), prefix + (isLast ? "    " : "│   "), depth + 1);
      return line + (sub ? "\n" + sub : "");
    }
    return line;
  }).join("\n");
}

function fsBatchLoad(dirPath, extensions, loadedFiles) {
  const files = [];
  const resolved = path.resolve(CONFIG.context_dir, dirPath || ".");
  function walk(dir, depth = 0) {
    if (depth > 3) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (!extensions.length || extensions.some(e => entry.name.endsWith(e))) {
        const stat = fs.statSync(full);
        if (stat.size <= 80000) {
          loadedFiles[full] = fs.readFileSync(full, "utf8");
          files.push(`${full} (${stat.size}b)`);
        }
      }
    }
  }
  walk(resolved);
  return files;
}

async function main() {
  const apiKey = CONFIG.groq_api_key;
  if (!apiKey || apiKey === "REPLACE_WITH_YOUR_API_KEY") {
    print(C.red, "Error: GROQ_API_KEY not set.");
    print(C.gray, "Please add your GROQ_API_KEY to index.js or set it as an environment variable.");
    process.exit(1);
  }

  const client = new Groq({ apiKey });
  let history = loadHistory();
  let loadedFiles = {};
  let sessionNoteIds = [];
  let pendingPythonOutput = null;

  await mcpD1Init();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  print(C.bold + C.cyan, "\n╔══ BWB Code Assistant ═════════════════════╗");
  print(C.cyan,           "║  Claude · Python · Cloudflare Memory REPL  ║");
  print(C.cyan,           "╚═════════════════════════════════════════════╝");
  print(C.gray, `Model: ${CONFIG.model}  |  Project: ${CONFIG.project_name}`);
  print(C.gray, `History: ${Math.floor(history.length/2)} turns  |  Notes: ${loadNotes().length} stored`);
  print(C.gray, `CWD: ${CONFIG.context_dir}`);
  print(C.gray, `Type :help for commands\n`);

  function buildUserMessage(userInput) {
    const parts = [];
    const recentNotes = getNotesByTags([]);
    if (recentNotes.length) parts.push(buildNotesContext(recentNotes));
    for (const [fp, content] of Object.entries(loadedFiles))
      parts.push(`--- FILE: ${fp} ---\n${content}\n--- END FILE ---`);
    if (pendingPythonOutput) {
      parts.push(`--- PYTHON OUTPUT ---\n${pendingPythonOutput}\n--- END PYTHON OUTPUT ---`);
      pendingPythonOutput = null;
    }
    parts.push(userInput);
    return parts.join("\n\n");
  }

  async function chat(userInput) {
    const messageContent = buildUserMessage(userInput);
    history.push({ role: "user", content: messageContent });

    if (history.length > CONFIG.max_history_turns * 2) {
      print(C.magenta, `[memory] Hard cap — flushing to Cloudflare...`);
      const r = await flushToCloudflare(history, sessionNoteIds, "cap-flush");
      print(C.gray, `[memory] Flushed ${r.id} | D1:${r.d1} KV:${r.kv}`);
      history = []; sessionNoteIds = []; saveHistory(history);
    }

    process.stdout.write(C.green + "\nAssistant: " + C.reset);
    let fullResponse = "";
    try {
      const stream = await client.chat.completions.create({
        model: CONFIG.model,
        max_tokens: CONFIG.max_tokens,
        messages: [{ role: "system", content: SYSTEM_MAIN }, ...history],
        stream: true,
      });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        process.stdout.write(text);
        fullResponse += text;
      }
    } catch (err) {
      print(C.red, `\nAPI Error: ${err.message}`);
      history.pop(); return;
    }

    console.log("\n");
    history.push({ role: "assistant", content: fullResponse });
    saveHistory(history);

    const signal = await evaluateSignal(client, userInput, fullResponse);
    if (signal.has_signal) {
      const noteId = `note_${Date.now()}`;
      const noteObj = {
        id: noteId,
        project: signal.project || CONFIG.project_name,
        timestamp: new Date().toISOString(),
        signal_type: signal.signal_type,
        note: signal.note,
        tags: signal.tags || [],
      };
      addNote(noteObj);
      sessionNoteIds.push(noteId);
      const kv = await mcpKvPut(`note:${noteId}`, noteObj);
      const d1 = await mcpD1InsertNote(noteObj);
      print(C.magenta, `[memory] ${signal.signal_type.toUpperCase()} [${noteObj.tags.join(", ")}] | KV:${kv} D1:${d1}`);
    }

    const turns = Math.floor(history.length / 2);
    if (turns > 0 && turns % CONFIG.auto_flush_turns === 0) {
      print(C.magenta, `[memory] Auto-flush at ${turns} turns...`);
      const r = await flushToCloudflare(history, sessionNoteIds, "auto");
      print(C.gray, `[memory] Flushed ${r.id} | D1:${r.d1} KV:${r.kv}`);
      history = []; sessionNoteIds = []; saveHistory(history);
    }
  }

  async function handleCommand(input) {
    const parts = input.trim().split(/\s+/);
    const cmd = parts[0]; const arg1 = parts[1];
    const extArgs = parts.filter(p => p.startsWith("."));

    switch (cmd) {
      case ":help":
        print(C.cyan, `Commands:
  :load <file>          Inject file into context
  :scan [dir] [.ext]    List files (e.g. :scan src .js .py)
  :context              Show loaded files
  :clear                Drop file context, keep history
  :reset                Wipe files + history (local)
  :save [file]          Save last code block (no arg = CF flush)
  :run <file.py>        Execute Python, inject output into next message
  :write <file> [lang]  Extract last code block and write to file
  :notes [tag]          Show memory notes (optional tag filter)
  :flush                Manual flush to Cloudflare
  :dir [path]           Change working directory
  :pwd                  Print working directory
  :project [name]       Show or set project name
  :exit / :quit         Exit`);
        break;
      case ":pwd": print(C.cyan, CONFIG.context_dir); break;
      case ":dir": {
        const d = arg1 ? path.resolve(arg1) : os.homedir();
        if (!fs.existsSync(d)) { print(C.red, `Not found: ${d}`); break; }
        CONFIG.context_dir = d; print(C.green, `CWD: ${d}`); break;
      }
      case ":project":
        if (arg1) { CONFIG.project_name = arg1; print(C.green, `Project: ${arg1}`); }
        else print(C.cyan, `Project: ${CONFIG.project_name}`);
        break;
      case ":load": {
        if (!arg1) { print(C.yellow, "Usage: :load <file>"); break; }
        const r = loadFile(arg1);
        if (!r.ok) { print(C.red, r.error); break; }
        loadedFiles[r.path] = r.content; print(C.green, `Loaded: ${r.path} (${r.size}b)`); break;
      }
      case ":scan": {
        const dir = arg1 && !arg1.startsWith(".") ? arg1 : ".";
        const files = scanDir(dir, extArgs);
        if (!files.length) { print(C.yellow, "No files found."); break; }
        print(C.cyan, `${files.length} file(s):`);
        files.forEach(f => print(C.gray, "  " + f)); break;
      }
      case ":context": {
        const keys = Object.keys(loadedFiles);
        if (!keys.length) { print(C.yellow, "No files loaded."); break; }
        print(C.cyan, "Loaded:"); keys.forEach(k => print(C.gray, "  " + k)); break;
      }
      case ":clear": loadedFiles = {}; print(C.green, "File context cleared."); break;
      case ":reset":
        loadedFiles = {}; history = []; sessionNoteIds = [];
        saveHistory(history); print(C.green, "Reset."); break;
      case ":run": {
        if (!arg1) { print(C.yellow, "Usage: :run <file.py>"); break; }
        print(C.gray, `Running ${arg1}...`);
        const r = runPython(arg1);
        print(r.ok ? C.green : C.red, `Exit ${r.exit_code} — injected into next message:`);
        print(C.gray, r.output);
        pendingPythonOutput = `File: ${arg1}\nExit: ${r.exit_code}\n${r.output}`; break;
      }
      case ":write": {
        const lang = parts[2] || "";
        if (!arg1) { print(C.yellow, "Usage: :write <file> [lang]"); break; }
        const last = [...history].reverse().find(m => m.role === "assistant");
        if (!last) { print(C.yellow, "No assistant response in history."); break; }
        const code = extractCodeBlock(last.content, lang);
        if (!code) { print(C.yellow, `No ${lang||"code"} block found.`); break; }
        print(C.green, `Written: ${writeFileToDisk(arg1, code)}`); break;
      }
      case ":save": {
        if (arg1) {
          const last = [...history].reverse().find(m => m.role === "assistant");
          if (!last) { print(C.yellow, "No assistant response."); break; }
          const code = extractCodeBlock(last.content, "");
          if (!code) { print(C.yellow, "No code block found."); break; }
          print(C.green, `Saved: ${writeFileToDisk(arg1, code)}`);
        } else {
          print(C.magenta, "Flushing to Cloudflare...");
          const r = await flushToCloudflare(history, sessionNoteIds, "manual");
          print(C.gray, `Flushed ${r.id} | D1:${r.d1} KV:${r.kv}`);
          history = []; sessionNoteIds = []; saveHistory(history);
        }
        break;
      }
      case ":notes": {
        const notes = getNotesByTags(parts.slice(1));
        if (!notes.length) { print(C.yellow, "No notes found."); break; }
        print(C.cyan, `${notes.length} note(s):`);
        notes.forEach(n => print(C.gray, `  [${n.timestamp.slice(0,16)}] [${(n.tags||[]).join(",")}] ${n.note}`)); break;
      }
      case ":flush": {
        print(C.magenta, "Flushing...");
        const r = await flushToCloudflare(history, sessionNoteIds, "manual");
        print(C.gray, `Flushed ${r.id} | D1:${r.d1} KV:${r.kv}`);
        history = []; sessionNoteIds = []; saveHistory(history); break;
      }
      case ":exit": case ":quit":
        print(C.gray, "Exiting."); rl.close(); process.exit(0);


      case ":fs": {
        const subcmd = parts[1];
        const fsarg1 = parts[2];
        const fsarg2 = parts.slice(3).join(" ");

        if (subcmd === "read") {
          if (!fsarg1) { print(C.yellow, "Usage: :fs read <file>"); break; }
          const numbered = fsReadNumbered(fsarg1);
          if (!numbered) { print(C.red, `Not found: ${fsarg1}`); break; }
          print(C.cyan, `--- ${fsarg1} ---`);
          console.log(numbered);
        } else if (subcmd === "write") {
          if (!fsarg1) { print(C.yellow, "Usage: :fs write <file>"); break; }
          const last = [...history].reverse().find(m => m.role === "assistant");
          if (!last) { print(C.yellow, "No assistant response in history."); break; }
          const code = extractCodeBlock(last.content, "");
          if (!code) { print(C.yellow, "No code block found in last response."); break; }
          writeFileToDisk(fsarg1, code);
          print(C.green, `Written: ${path.resolve(CONFIG.context_dir, fsarg1)}`);
        } else if (subcmd === "edit") {
          if (!fsarg1 || !fsarg2) { print(C.yellow, "Usage: :fs edit <file> <old_string> <new_string>"); break; }
          const [oldStr, newStr] = fsarg2.split("|||").map(s => s.trim());
          if (!oldStr || newStr === undefined) { print(C.yellow, "Separate old and new with |||"); break; }
          const result = fsEdit(fsarg1, oldStr, newStr);
          result.ok ? print(C.green, `Edited: ${fsarg1}`) : print(C.red, result.error);
        } else if (subcmd === "diff") {
          if (!fsarg1) { print(C.yellow, "Usage: :fs diff <file>"); break; }
          const original = loadedFiles[path.resolve(CONFIG.context_dir, fsarg1)];
          if (!original) { print(C.yellow, "File not loaded in context — load it first with :load"); break; }
          const diff = fsDiff(fsarg1, original);
          print(C.cyan, `--- diff: ${fsarg1} ---`);
          console.log(diff);
        } else if (subcmd === "batch") {
          const dir  = fsarg1 || ".";
          const exts = parts.slice(3).filter(p => p.startsWith("."));
          const loaded = fsBatchLoad(dir, exts, loadedFiles);
          if (!loaded.length) { print(C.yellow, "No files loaded."); break; }
          print(C.green, `Batch loaded ${loaded.length} file(s):`);
          loaded.forEach(f => print(C.gray, "  " + f));
        } else if (subcmd === "tree") {
          const tree = fsTree(fsarg1 || ".");
          print(C.cyan, `${path.resolve(CONFIG.context_dir, fsarg1 || ".")}`);
          console.log(tree);
        } else {
          print(C.cyan, `File System commands:
  :fs read <file>                    Read file with line numbers
  :fs write <file>                   Write last code block to file
  :fs edit <file> <old>|||<new>      Surgical string replace in file
  :fs diff <file>                    Diff current file vs loaded version
  :fs batch <dir> [.ext .ext]        Load all matching files in dir
  :fs tree [dir]                     Visual directory tree`);
        }
        break;
      }
      case ":gh": {
        const subcmd = parts[1];
        const gharg1 = parts[2];
        const gharg2 = parts[3];
        const gharg3 = parts.slice(4).join(" ") || "update via BWB REPL";

        if (!GH_TOKEN) { print(C.red, "GH_TOKEN not set."); break; }

        if (subcmd === "repos") {
          print(C.gray, "Fetching repos...");
          const repos = await ghListRepos();
          print(C.cyan, `${repos.length} repos:`);
          repos.forEach(r => print(C.gray, "  " + r));
        } else if (subcmd === "ls") {
          if (!gharg1) { print(C.yellow, "Usage: :gh ls <repo> [path]"); break; }
          print(C.gray, `Listing ${gharg1}...`);
          const files = await ghListFiles(gharg1, gharg2 || "");
          files.forEach(f => print(C.gray, "  " + f));
        } else if (subcmd === "pull") {
          if (!gharg1 || !gharg2) { print(C.yellow, "Usage: :gh pull <repo> <filepath>"); break; }
          print(C.gray, `Pulling ${gharg2} from ${gharg1}...`);
          const content = await ghPullFile(gharg1, gharg2);
          if (!content) { print(C.red, "File not found or empty."); break; }
          const localPath = path.basename(gharg2);
          writeFileToDisk(localPath, content);
          loadedFiles[path.resolve(CONFIG.context_dir, localPath)] = content;
          print(C.green, `Pulled and loaded: ${localPath} (${content.length}b)`);
        } else if (subcmd === "push") {
          if (!gharg1 || !gharg2) { print(C.yellow, "Usage: :gh push <repo> <filepath> [commit message]"); break; }
          const localContent = fs.existsSync(path.resolve(CONFIG.context_dir, gharg2))
            ? fs.readFileSync(path.resolve(CONFIG.context_dir, gharg2), "utf8")
            : null;
          if (!localContent) { print(C.red, `Local file not found: ${gharg2}`); break; }
          print(C.gray, `Pushing ${gharg2} to ${gharg1}...`);
          const sha = await ghPushFile(gharg1, gharg2, localContent, gharg3);
          if (sha) print(C.green, `Pushed. Commit: ${sha.slice(0,7)}`);
          else print(C.red, "Push failed. Check repo name and token scope.");
        } else {
          print(C.yellow, `Usage:
  :gh repos                          List all your repos
  :gh ls <repo> [path]               List files in repo
  :gh pull <repo> <file>             Pull file into context
  :gh push <repo> <file> [message]   Push local file to repo`);
        }
        break;
      }
      case ":myth": await handleMythCommand(parts, print); break;
      default: print(C.yellow, `Unknown command: ${cmd}. Type :help`);
    }
  }

  function prompt() {
    rl.question(C.yellow + "You: " + C.reset, async (input) => {
      const trimmed = input.trim();
      if (!trimmed) { prompt(); return; }
      if (trimmed.startsWith(":")) await handleCommand(trimmed);
      else await chat(trimmed);
      prompt();
    });
  }

  prompt();
}

main();
