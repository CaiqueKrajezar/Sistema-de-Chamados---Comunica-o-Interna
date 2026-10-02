"use strict";

require("./testEnv");
const fs = require("node:fs");
const { env } = require("../src/config/env");

function resetTestDb() {
  if (fs.existsSync(env.sqliteFileAbs)) fs.unlinkSync(env.sqliteFileAbs);
}

async function setupTestDb() {
  resetTestDb();
  const { main: migrate } = require("../scripts/migrate");
  const { main: seed } = require("../scripts/seed");
  await migrate();
  await seed();
}

module.exports = { setupTestDb, resetTestDb };
