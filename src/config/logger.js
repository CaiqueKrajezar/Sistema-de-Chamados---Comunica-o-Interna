"use strict";

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function timestamp() {
  return new Date().toISOString();
}

function log(level, msg, meta) {
  if (LEVELS[level] > currentLevel) return;
  const line = `[${timestamp()}] ${level.toUpperCase()} ${msg}`;
  const out = level === "error" ? console.error : console.log;
  if (meta !== undefined) out(line, meta);
  else out(line);
}

module.exports = {
  error: (msg, meta) => log("error", msg, meta),
  warn: (msg, meta) => log("warn", msg, meta),
  info: (msg, meta) => log("info", msg, meta),
  debug: (msg, meta) => log("debug", msg, meta)
};
