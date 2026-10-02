"use strict";

const { calcularPrazo } = require("../sla/diasUteis");

/**
 * Decide o status inicial do chamado e quando o SLA começa a contar.
 * Sem segundo aprovador: briefing já é considerado completo no envio (o form já exige
 * todos os campos obrigatórios + ciência do SLA) → SLA começa na hora.
 * Com segundo aprovador: chamado fica 'aguardando_aprovacao' e o SLA só começa quando
 * alguém aprovar (ver resolverAprovacao) — implementa literalmente "o prazo conta a
 * partir do recebimento de um briefing completo".
 */
function resolverAberturaChamado({ tipo, segundoAprovadorEmail, feriados = [] }) {
  const agora = new Date();
  if (segundoAprovadorEmail) {
    return { status: "aguardando_aprovacao", aprovacaoStatus: "pendente", dataInicioSla: null, dataPrazo: null };
  }
  const prazo = calcularPrazo(tipo, agora, feriados);
  return { status: "novo", aprovacaoStatus: "nao_aplicavel", dataInicioSla: agora.toISOString(), dataPrazo: prazo.toISOString() };
}

function resolverAprovacao({ tipo, feriados = [] }) {
  const agora = new Date();
  const prazo = calcularPrazo(tipo, agora, feriados);
  return { dataInicioSla: agora.toISOString(), dataPrazo: prazo.toISOString() };
}

module.exports = { resolverAberturaChamado, resolverAprovacao };
