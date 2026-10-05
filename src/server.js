"use strict";

// Zé, ponto de entrada mesmo — `npm start` roda isso. Separei de app.js de propósito
// (app.js só monta as rotas, não sobe servidor) porque os testes importam o app direto
// sem precisar abrir porta nenhuma (ver tests/integration/*.test.js, cada teste sobe sua
// própria instância em porta aleatória com `app.listen(0)`). O worker de notificação
// (fila de e-mail) roda num loop separado, iniciado logo abaixo — é outbox pattern: toda
// ação relevante grava uma linha em NOTIFICACAO, esse worker processa e manda de fato.
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
