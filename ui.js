// ENTRY POINT: imported by repl.js
// Terminal color and formatting utilities — no external dependencies

// ─── CONFIG ────────────────────────────────────────────────────────────────
const COLORS = {
  red:    "\x1b[31m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  white:  "\x1b[37m",
  dim:    "\x1b[2m",
  bold:   "\x1b[1m",
  reset:  "\x1b[0m",
};
// ───────────────────────────────────────────────────────────────────────────

export function colorize(text, style) {
  const code = COLORS[style] || "";
  return `${code}${text}${COLORS.reset}`;
}

export function printBanner() {
  const lines = [
    "",
    "  ██████╗ ██╗    ██╗██████╗     ██████╗ ███████╗██████╗ ██╗     ",
    "  ██╔══██╗██║    ██║██╔══██╗    ██╔══██╗██╔════╝██╔══██╗██║     ",
    "  ██████╔╝██║ █╗ ██║██████╔╝    ██████╔╝█████╗  ██████╔╝██║     ",
    "  ██╔══██╗██║███╗██║██╔══██╗    ██╔══██╗██╔══╝  ██╔═══╝ ██║     ",
    "  ██████╔╝╚███╔███╔╝██████╔╝    ██║  ██║███████╗██║     ███████╗ ",
    "  ╚═════╝  ╚══╝╚══╝ ╚═════╝     ╚═╝  ╚═╝╚══════╝╚═╝     ╚══════╝",
    "",
    "  Build While Bleeding — Code Assistant v1.0",
    "  Powered by Claude · Running in Termux",
    "",
  ];

  lines.forEach((line) => console.log(colorize(line, "cyan")));
}
