#!/usr/bin/env node
// ENTRY POINT: standalone bwb CLI
import { handleMythCommand } from "./commands/myth.js";

const C = {
  reset: "\x1b[0m", cyan: "\x1b[36m", yellow: "\x1b[33m",
  red: "\x1b[31m", gray: "\x1b[90m",
};
const print = (color, ...args) => console.log(color + args.join(" ") + C.reset);

const args  = process.argv.slice(2);
const cmd   = args[0];

if (!cmd || cmd === "help") {
  print(C.cyan, `BWB CLI
  bwb myth "seed"          Generate urban myth
  bwb myth archetypes      List archetypes
  bwb myth history <name>  View archetype history
  bwb myth reset           Clear database`);
  process.exit(0);
}

if (cmd === "myth") {
  await handleMythCommand(["myth", ...args.slice(1)], print);
} else {
  print(C.yellow, `Unknown command: ${cmd}`);
}
