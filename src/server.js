"use strict";

const { env } = require("./config/env");
const logger = require("./config/logger");
const app = require("./app");
const notificacaoWorker = require("./services/notificacaoWorker");

const server = app.listen(env.PORT, () => {
  logger.info(`Servidor rodando em ${env.APP_BASE_URL} (DB_DRIVER=${env.DB_DRIVER}, AUTH_MODE=${env.AUTH_MODE}, MAIL_MODE=${env.MAIL_MODE})`);
});

notificacaoWorker.iniciarLoop();

process.on("SIGTERM", () => {
  logger.info("Encerrando servidor (SIGTERM)...");
  server.close(() => process.exit(0));
});
