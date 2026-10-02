"use strict";

const path = require("node:path");
const { env } = require("../src/config/env");
const logger = require("../src/config/logger");
const { runMigrations } = require("../src/db/migrationRunner");

async function main() {
  if (env.DB_DRIVER === "oracle") {
    const { migrationAdapter, closePool } = require("../src/db/oracle/pool");
    await runMigrations({
      migrationsDir: path.join(__dirname, "..", "src", "db", "oracle", "migrations"),
      adapter: migrationAdapter(),
      logger
    });
    await closePool();
  } else {
    const { getDb, migrationAdapter, closeDb } = require("../src/db/sqlite/client");
    const db = getDb();
    await runMigrations({
      migrationsDir: path.join(__dirname, "..", "src", "db", "sqlite", "migrations"),
      adapter: migrationAdapter(db),
      logger
    });
    closeDb();
  }
  logger.info(`Migrations em dia (DB_DRIVER=${env.DB_DRIVER}).`);
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("Falha ao rodar migrations", err);
    process.exit(1);
  });
}

module.exports = { main };
