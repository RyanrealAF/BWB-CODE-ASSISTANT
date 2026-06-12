import { UrbanMythEngine } from "../engine/urban-myth-engine.js";

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

async function getEngine() {
  if (!engine) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) { print(C.red, "GROQ_API_KEY not set."); process.exit(1); }
    engine = new UrbanMythEngine(apiKey);
    await engine.init();
  }
  return engine;
}

export async function handleMythCommand(parts, print) {
  const subcmd = parts[1];
  const eng    = await getEngine();

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
  const seed = parts.slice(1).join(" ").replace(/^["']|["']$/g, "");
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
  } catch (err) {
    print(C.red, `Myth engine error: ${err.message}`);
  }
}
