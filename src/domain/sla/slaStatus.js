"use strict";

const ABERTOS = ["aguardando_aprovacao", "novo", "em_andamento", "em_revisao", "aguardando_solicitante"];

/** @returns {"ok"|"atencao"|"atrasado"|null} null = SLA ainda não começou (aguardando aprovação) */
function slaEstado(chamado, agora = new Date()) {
  if (!chamado.dataPrazo) return null;
  if (chamado.status === "resolvido") {
    return new Date(chamado.dataResolucao) <= new Date(chamado.dataPrazo) ? "ok" : "atrasado";
  }
  if (chamado.status === "cancelado") return null;
  const faltamHoras = (new Date(chamado.dataPrazo) - agora) / 3_600_000;
  if (faltamHoras < 0) return "atrasado";
  if (faltamHoras <= 24) return "atencao";
  return "ok";
}

function estaAtrasado(chamado, agora = new Date()) {
  return ABERTOS.includes(chamado.status) && slaEstado(chamado, agora) === "atrasado";
}

/**
 * Agregados para o dashboard: visão geral + quebra por analista.
 * @param {Array} chamados @param {Array} analistas
 */
function metricas(chamados, analistas, agora = new Date()) {
  const porAnalista = new Map(
    analistas.map((a) => [
      a.id,
      { analista: a, total: 0, abertos: 0, resolvido: 0, atrasados: 0, somaHorasResolucao: 0, qtdResolvidosComTempo: 0, slaCumprido: 0, slaAvaliado: 0 }
    ])
  );

  const geral = { total: 0, abertos: 0, resolvido: 0, cancelado: 0, atrasados: 0, slaCumprido: 0, slaAvaliado: 0 };

  for (const c of chamados) {
    geral.total += 1;
    if (c.status === "resolvido") geral.resolvido += 1;
    else if (c.status === "cancelado") geral.cancelado += 1;
    else geral.abertos += 1;

    const atrasado = estaAtrasado(c, agora);
    if (atrasado) geral.atrasados += 1;

    if (c.status === "resolvido" && c.dataPrazo) {
      geral.slaAvaliado += 1;
      if (slaEstado(c, agora) === "ok") geral.slaCumprido += 1;
    }

    const bucket = porAnalista.get(c.analistaPrincipalId);
    if (!bucket) continue;
    bucket.total += 1;
    if (c.status === "resolvido") bucket.resolvido += 1;
    else bucket.abertos += 1;
    if (atrasado) bucket.atrasados += 1;
    if (c.status === "resolvido") {
      if (c.dataAbertura && c.dataResolucao) {
        bucket.somaHorasResolucao += (new Date(c.dataResolucao) - new Date(c.dataAbertura)) / 3_600_000;
        bucket.qtdResolvidosComTempo += 1;
      }
      if (c.dataPrazo) {
        bucket.slaAvaliado += 1;
        if (slaEstado(c, agora) === "ok") bucket.slaCumprido += 1;
      }
    }
  }

  const porAnalistaArr = [...porAnalista.values()].map((b) => ({
    analista: b.analista,
    total: b.total,
    abertos: b.abertos,
    resolvido: b.resolvido,
    atrasados: b.atrasados,
    tempoMedioResolucaoHoras: b.qtdResolvidosComTempo ? b.somaHorasResolucao / b.qtdResolvidosComTempo : null,
    slaPct: b.slaAvaliado ? Math.round((b.slaCumprido / b.slaAvaliado) * 100) : null
  }));

  return {
    geral,
    slaPctGeral: geral.slaAvaliado ? Math.round((geral.slaCumprido / geral.slaAvaliado) * 100) : null,
    porAnalista: porAnalistaArr
  };
}

module.exports = { slaEstado, estaAtrasado, metricas, ABERTOS };
