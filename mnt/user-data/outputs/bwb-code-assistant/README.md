# BWB Code Assistant
**Build While Bleeding — Termux Code Assistant**
Powered by Claude · buildwhilebleeding.com

An interactive REPL that loads your entire project into context and gives you a persistent Claude-backed chat session about the codebase. Zero external dependencies beyond Node.js.

---

## Requirements

- Termux with Node.js ≥ 18
- Anthropic API key (`sk-ant-...`)

---

## Install

```bash
bash setup.sh
```

Or manually:
```bash
chmod +x src/repl.js
```

---

## Usage

```bash
# Point at a project directory
node src/repl.js ~/projects/my-worker

# If installed globally
bwb-assist ~/projects/my-worker

# With API key inline
ANTHROPIC_API_KEY=sk-ant-... node src/repl.js ~/projects/my-worker

# Defaults to current directory if no path given
cd ~/projects/my-worker && node ~/bwb-code-assistant/src/repl.js
```

---

## REPL Commands

| Command | Action |
|---|---|
| `/reload` | Rescan project files and reset history |
| `/clear` | Clear chat history (keep context) |
| `/files` | List all files loaded into context |
| `/exit` | Quit |

---

## Context Rules

The context builder automatically:
- Includes: `.js .ts .py .sh .json .toml .yaml .md .html .css .sql .tf`
- Excludes: `node_modules`, `.git`, `dist`, `.wrangler`, `.env`
- Caps: 100KB per file, 80K chars total context
- Truncates large files with a notice rather than silently cutting

---

## API Key Setup (Persistent)

Add to `~/.bashrc` in Termux:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Then:
```bash
source ~/.bashrc
```

---

## Project Structure

```
bwb-code-assistant/
├── src/
│   ├── repl.js       # REPL loop and command handling
│   ├── claude.js     # Anthropic API client (streaming SSE)
│   ├── context.js    # Project file scanner + context builder
│   └── ui.js         # Terminal colors and banner
├── package.json
├── setup.sh
└── README.md
```

---

## Extending

**Add a new file type to scan:** Edit `INCLUDED_EXTENSIONS` in `src/context.js`.

**Change the model:** Edit `MODEL` in `src/claude.js`.

**Increase context window:** Edit `MAX_TOTAL_CHARS` in `src/context.js` — stay under the model's input limit (~180K tokens for Sonnet).

**Add a slash command:** Add a new `if (cmd === "/yourcommand")` block in `handleCommand()` in `src/repl.js`.
