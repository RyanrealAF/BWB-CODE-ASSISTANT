import sqlite3 from 'sqlite3';

const db = new (sqlite3.verbose()).Database('./data/archetypes.db');

class ArchetypeCache {
  constructor() {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS archetypes (
          name TEXT PRIMARY KEY,
          count INTEGER,
          mutations TEXT,
          lastSeen TEXT
        )
      `);
    });
  }

  async getArchetypes() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM archetypes', (err, rows) => {
        if (err) {
          reject(err);
        }
        resolve(rows);
      });
    });
  }

  async getArchetypeHistory(name) {
    return new Promise((resolve, reject) => {
      db.get('SELECT mutations FROM archetypes WHERE name = ?', [name], (err, row) => {
        if (err) {
          reject(err);
        }
        resolve(row ? row.mutations : null);
      });
    });
  }

  async updateArchetype(name, mutation) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM archetypes WHERE name = ?', [name], (err, row) => {
        if (err) {
          reject(err);
        }

        if (row) {
          const newCount = row.count + 1;
          const newMutations = `${row.mutations}\
${mutation}`;
          db.run(
            'UPDATE archetypes SET count = ?, mutations = ?, lastSeen = ? WHERE name = ?',
            [newCount, newMutations, new Date().toISOString(), name],
            (err) => {
              if (err) {
                reject(err);
              }
              resolve();
            }
          );
        } else {
          db.run(
            'INSERT INTO archetypes (name, count, mutations, lastSeen) VALUES (?, ?, ?, ?)',
            [name, 1, mutation, new Date().toISOString()],
            (err) => {
              if (err) {
                reject(err);
              }
              resolve();
            }
          );
        }
      });
    });
  }

  async reset() {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM archetypes', (err) => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }
}

export default ArchetypeCache;
