import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../data/archetypes.db");

let db = null;

export async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  db.run(`CREATE TABLE IF NOT EXISTS archetypes (
    name TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0,
    mutations TEXT DEFAULT '[]',
    lastSeen TEXT
  )`);
  saveDB();
  return db;
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export function getArchetype(name) {
  const stmt = db.prepare("SELECT * FROM archetypes WHERE name = ?");
  const rows = [];
  stmt.bind([name]);
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows[0] || null;
}

export function upsertArchetype(name, mutation) {
  const existing = getArchetype(name);
  const mutations = existing ? JSON.parse(existing.mutations) : [];
  mutations.push(mutation);
  if (mutations.length > 10) mutations.shift();
  if (existing) {
    db.run(
      "UPDATE archetypes SET count = count + 1, mutations = ?, lastSeen = ? WHERE name = ?",
      [JSON.stringify(mutations), new Date().toISOString(), name]
    );
  } else {
    db.run(
      "INSERT INTO archetypes (name, count, mutations, lastSeen) VALUES (?, 1, ?, ?)",
      [name, JSON.stringify(mutations), new Date().toISOString()]
    );
  }
  saveDB();
}

export function listArchetypes() {
  const stmt = db.prepare("SELECT name, count, lastSeen FROM archetypes ORDER BY count DESC");
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export function getArchetypeHistory(name) {
  const a = getArchetype(name);
  if (!a) return null;
  return { name: a.name, count: a.count, mutations: JSON.parse(a.mutations), lastSeen: a.lastSeen };
}

export function resetDB() {
  db.run("DELETE FROM archetypes");
  saveDB();
}
