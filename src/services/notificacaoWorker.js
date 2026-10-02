"use strict";

const repos = require("../repositories");
const logger = require("../config/logger");
const emailService = require("./emailService");

async function processarPendentes(limite = 20) {
  const pendentes = await repos.notificacao.listarPendentes(limite);
  for (const n of pendentes) {
    try {
      await emailService.enviar({ destinatarioEmail: n.destinatarioEmail, assunto: n.assunto, corpo: n.corpo });
      await repos.notificacao.marcarEnviada(n.id);
    } catch (err) {
      logger.error(`Falha ao enviar notificação ${n.id}`, err);
      await repos.notificacao.marcarFalha(n.id, err.message || String(err));
    }
  }
  return pendentes.length;
}

/** Loop simples em memória — suficiente pro volume esperado de um sistema interno de uma área. */
function iniciarLoop(intervaloMs = 15000) {
  const timer = setInterval(() => {
    processarPendentes().catch((err) => logger.error("Erro no worker de notificação", err));
  }, intervaloMs);
  timer.unref();
  return timer;
}

module.exports = { processarPendentes, iniciarLoop };
