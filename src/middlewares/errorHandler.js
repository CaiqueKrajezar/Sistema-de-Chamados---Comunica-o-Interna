"use strict";

const logger = require("../config/logger");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(err.message || String(err), err);
  if (res.headersSent) return next(err);
  const status = err.status || (err.name === "MulterError" ? 400 : 500);
  res.status(status).json({ erro: err.publicMessage || err.message || "Erro interno." });
}

module.exports = { errorHandler };
