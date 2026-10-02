"use strict";

const { withConnection, getOracledb, lowerRow, lowerRows } = require("../pool");

function row(r) {
  if (!r) return null;
  return {
    id: r.id,
    chamadoId: r.chamado_id,
    tipoRevisao: r.tipo_revisao,
    numeroSequencial: r.numero_sequencial,
    solicitadoPor: r.solicitado_por,
    descricao: r.descricao,
    criadoEm: r.criado_em
  };
}

async function listarPorChamado(chamadoId) {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM revisao WHERE chamado_id = :chamadoId ORDER BY criado_em", { chamadoId });
    return lowerRows(result.rows).map(row);
  });
}

async function contarPorTipo(chamadoId, tipoRevisao) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      "SELECT COUNT(*) AS n FROM revisao WHERE chamado_id = :chamadoId AND tipo_revisao = :tipoRevisao",
      { chamadoId, tipoRevisao }
    );
    return lowerRow(result.rows[0]).n;
  });
}

async function criar(dados) {
  const oracledb = getOracledb();
  return withConnection(async (conn) => {
    const countResult = await conn.execute(
      "SELECT COUNT(*) AS n FROM revisao WHERE chamado_id = :chamadoId AND tipo_revisao = :tipoRevisao",
      { chamadoId: dados.chamadoId, tipoRevisao: dados.tipoRevisao }
    );
    const jaExistem = lowerRow(countResult.rows[0]).n;

    const result = await conn.execute(
      `INSERT INTO revisao (chamado_id, tipo_revisao, numero_sequencial, solicitado_por, descricao)
       VALUES (:chamadoId, :tipoRevisao, :numeroSequencial, :solicitadoPor, :descricao)
       RETURNING id INTO :id`,
      {
        chamadoId: dados.chamadoId,
        tipoRevisao: dados.tipoRevisao,
        numeroSequencial: jaExistem + 1,
        solicitadoPor: dados.solicitadoPor ?? null,
        descricao: dados.descricao ?? null,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );
    const check = await conn.execute("SELECT * FROM revisao WHERE id = :id", { id: result.outBinds.id[0] });
    return row(lowerRow(check.rows[0]));
  });
}

module.exports = { listarPorChamado, contarPorTipo, criar };
