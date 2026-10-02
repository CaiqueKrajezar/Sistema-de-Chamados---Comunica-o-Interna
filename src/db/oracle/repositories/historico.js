"use strict";

const { withConnection, lowerRows } = require("../pool");

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

async function listarPorChamado(chamadoId) {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM historico_status WHERE chamado_id = :chamadoId ORDER BY alterado_em", {
      chamadoId
    });
    return lowerRows(result.rows).map(row);
  });
}

module.exports = { listarPorChamado };
