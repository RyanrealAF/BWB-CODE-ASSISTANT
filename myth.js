import { UrbanMythEngine } from "../engine/urban-myth-engine.js";
import fs from "fs";
import path from "path";

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

let engine = null;

async function getEngine(config) {
  if (!engine) {
    engine = new UrbanMythEngine(config.gemini_api_key, config.model);
    await engine.init();
  }
  return engine;
}

function generateMythHTML(result) {
  const css = `
    body { font-family: 'Courier New', monospace; background: #1a1a1a; color: #e0e0e0; padding: 2rem; }
    h1, h2 { font-weight: bold; }
    h1 { color: #50fa7b; font-size: 1.5rem; }
    h2 { color: #bd93f9; margin-top: 2rem; border-bottom: 1px solid #44475a; padding-bottom: 0.5rem;}
    p { line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; background: #282a36; padding: 2rem; border-radius: 8px; box-shadow: 0 0 15px rgba(0,0,0,0.5); }
    .meta { font-size: 0.9rem; color: #6272a4; margin-top: 2rem; }
    .label { font-weight: bold; color: #ff79c6; }
  `;
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Myth Preview: ${result.seed}</title>
      <style>${css}</style>
    </head>
    <body>
      <div class="container">
        <h1>Myth Preview</h1>
        <p><span class="label">Seed:</span> ${result.seed}</p>
        
        <h2>Narrative</h2>
        <p>${result.narrative}</p>
        
        <h2>Distortion</h2>
        <p>${result.distorted}</p>
        
        <div class="meta">
          <p><span class="label">Archetypes:</span> ${result.archetypes.join(", ") || "none extracted"}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function handleMythCommand(parts, print, config) {
  const subcmd = parts[1];
  const eng    = await getEngine(config);

  if (!subcmd || subcmd === "help") {
    print(C.cyan, `Myth Engine commands:
  :myth "seed phrase"        Generate a myth from seed
  :myth archetypes           List all cached archetypes
  :myth history <name>       View archetype mutation history
  :myth reset                Clear archetype database`);
    return;
  }

  if (subcmd === "archetypes") {
    const list = await eng.listArchetypes();
    if (!list.length) { print(C.yellow, "No archetypes cached yet."); return; }
    print(C.cyan, `${list.length} archetype(s):`);
    list.forEach(a => print(C.gray, `  [${a.count}x] ${a.name} — last seen ${a.lastSeen?.slice(0,16)}`));
    return;
  }

  if (subcmd === "history") {
    const name = parts.slice(2).join(" ");
    if (!name) { print(C.yellow, "Usage: :myth history <archetype name>"); return; }
    const h = await eng.getHistory(name);
    if (!h) { print(C.yellow, `Archetype not found: ${name}`); return; }
    print(C.cyan, `${h.name} — ${h.count} appearances`);
    h.mutations.forEach((m, i) => print(C.gray, `  [${i+1}] ${m}`));
    return;
  }

  if (subcmd === "reset") {
    await eng.reset();
    print(C.green, "Archetype database cleared.");
    return;
  }

  // Generate myth from seed
  const seed = parts.slice(1).join(" ").replace(/^[\"\']|[\"\']$/g, "");
  if (!seed) { print(C.yellow, 'Usage: :myth "your seed phrase"'); return; }

  print(C.gray, `Generating myth from seed: "${seed}"...`);
  try {
    const result = await eng.generate(seed);

    print(C.bold + C.cyan, "\n── NARRATIVE ────────────────────────────");
    console.log(result.narrative);
    print(C.bold + C.magenta, "\n── DISTORTION ───────────────────────────");
    console.log(result.distorted);
    print(C.gray, `\nArchetypes: ${result.archetypes.join(", ") || "none extracted"}`);
    console.log("");

    const html = generateMythHTML(result);
    const previewPath = path.resolve(process.cwd(), "myth_preview.html");
    fs.writeFileSync(previewPath, html);
    print(C.green, `Preview written to: ${previewPath}`);

  } catch (err) {
    print(C.red, `Myth engine error: ${err.message}`);
  }
}
