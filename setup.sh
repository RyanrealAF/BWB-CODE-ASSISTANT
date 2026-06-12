#!/data/data/com.termux/files/usr/bin/bash
# setup.sh — Run once to install and configure bwb-code-assistant in Termux

set -e

echo ""
echo "  BWB Code Assistant — Termux Setup"
echo "  buildwhilebleeding.com"
echo ""

# ─── 1. VERIFY NODE ────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "[!] Node.js not found. Installing..."
  pkg install nodejs -y
else
  NODE_VER=$(node -e "process.stdout.write(process.version)")
  echo "[✓] Node.js $NODE_VER found"
fi

# ─── 2. VERIFY NPM ────────────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  echo "[!] npm not found. Installing..."
  pkg install npm -y
else
  echo "[✓] npm found"
fi

# ─── 3. MAKE REPL EXECUTABLE ──────────────────────────────────────────────
chmod +x src/repl.js
echo "[✓] src/repl.js marked executable"

# ─── 4. INSTALL GLOBALLY (OPTIONAL) ───────────────────────────────────────
read -p "[?] Install globally as 'bwb-assist' command? (y/n): " GLOBAL_INSTALL
if [[ "$GLOBAL_INSTALL" == "y" || "$GLOBAL_INSTALL" == "Y" ]]; then
  npm install -g .
  echo "[✓] Installed globally. Run: bwb-assist [path/to/project]"
else
  echo "[✓] Local only. Run: node src/repl.js [path/to/project]"
fi

# ─── 5. API KEY ────────────────────────────────────────────────────────────
echo ""
echo "  ANTHROPIC_API_KEY must be set before running."
echo "  Add this to your ~/.bashrc or ~/.zshrc:"
echo ""
echo "    export ANTHROPIC_API_KEY=sk-ant-..."
echo ""
echo "  Or prefix each run:"
echo "    ANTHROPIC_API_KEY=sk-ant-... bwb-assist ~/my-project"
echo ""

if [[ -n "$ANTHROPIC_API_KEY" ]]; then
  echo "[✓] ANTHROPIC_API_KEY is already set in this session"
else
  echo "[!] ANTHROPIC_API_KEY not set in current session"
fi

echo ""
echo "  Setup complete."
echo ""
