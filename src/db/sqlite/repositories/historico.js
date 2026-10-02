"use strict";

const { getDb } = require("../client");

function row(r) {
  if (!r) return null;
  return {
    id: r.id,
    chamadoId: r.chamado_id,
    statusAnterior: r.status_anterior,
    statusNovo: r.status_novo,
    alteradoPor: r.alterado_por,
    observacao: r.observacao,
    alteradoEm: r.alterado_em
  };
}

function listarPorChamado(chamadoId) {
  return getDb()
    .prepare("SELECT * FROM historico_status WHERE chamado_id = ? ORDER BY alterado_em")
    .all(chamadoId)
    .map(row);
}

module.exports = { listarPorChamado };
