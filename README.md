# BWB Code Assistant

Interactive Claude-powered code assistant REPL for Termux.
Persistent chat session with codebase file injection and streaming output.

---

## Install

```bash
# 1. Install Node (if not already)
pkg install nodejs

# 2. Install dependencies
cd bwb-code-assistant
npm install

# 3. Set your API key (add to ~/.bashrc to persist across sessions)
export ANTHROPIC_API_KEY=your_key_here

# 4. Make executable and link globally (optional)
chmod +x index.js
npm link
```

---

## Run

```bash
node index.js
# or if npm linked:
bwb
```

---

## Commands

| Command | Action |
|---|---|
| `:load <file>` | Inject file into context |
| `:scan [dir] [.ext]` | List files (e.g. `:scan src .js .ts`) |
| `:context` | Show loaded files |
| `:clear` | Drop file context, keep history |
| `:reset` | Wipe files + history |
| `:dir [path]` | Change working directory |
| `:pwd` | Print working directory |
| `:save` | Force-save history |
| `:exit` | Quit |
| `:help` | Command list |

---

## Example session

```
You: :scan . .js
You: :load src/worker.js
You: :load wrangler.toml
You: KV write is silently failing on second request — why?
```

File contents + question go into a single context window.
Responses stream token-by-token to stdout.
History persists at ~/.bwb_repl_history.json between sessions.

---

## Config (index.js top)

```js
const CONFIG = {
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  max_file_bytes: 80_000,
  max_history_turns: 20,
};
```

---

## Notes

- Requires Node 18+ (`pkg install nodejs` in Termux)
- Files are injected per-message only — nothing stored externally
- Use `:reset` when switching projects to prevent context bleed
