"use strict";

const { calcularPrazo } = require("../sla/diasUteis");

/**
 * Zé, isso aqui veio direto de uma regra que a área de Comunicação Interna foi bem
 * enfática ao me passar: "o prazo só conta a partir do recebimento de um briefing
 * completo". Então modelei literalmente assim — se o solicitante indicou um segundo
 * aprovador no formulário, o chamado nasce em 'aguardando_aprovacao' com SLA ainda
 * parado (dataInicioSla null), e só quando esse aprovador confirma (resolverAprovacao)
 * o relógio começa a contar. Sem segundo aprovador, considero o briefing completo já no
 * envio — o próprio formulário público já exige os campos obrigatórios e a ciência do
 * SLA antes de deixar enviar, então não tem o que esperar.
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
