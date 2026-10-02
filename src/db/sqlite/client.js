"use strict";

const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
const { env } = require("../../config/env");

let db = null;

/** Conexão única (arquivo local) usada em desenvolvimento/testes — DB_DRIVER=sqlite. */
function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(env.sqliteFileAbs), { recursive: true });
  db = new DatabaseSync(env.sqliteFileAbs);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

function migrationAdapter(database) {
  return {
    ensureMigrationsTable() {
      database.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          nome TEXT PRIMARY KEY,
          aplicado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        )
      `);
    },
    isApplied(name) {
      const row = database.prepare("SELECT 1 FROM schema_migrations WHERE nome = ?").get(name);
      return !!row;
    },
    runFile(sql) {
      database.exec(sql);
    },
    recordApplied(name) {
      database.prepare("INSERT INTO schema_migrations (nome) VALUES (?)").run(name);
    }
  };
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, migrationAdapter, closeDb };
