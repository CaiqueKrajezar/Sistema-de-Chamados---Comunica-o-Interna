"use strict";

const { withConnection, getOracledb, lowerRow, lowerRows } = require("../pool");

function row(r) {
  if (!r) return null;
  return { id: r.id, nome: r.nome, ativo: r.ativo === "S", ordemExibicao: r.ordem_exibicao };
}

async function listarAtivas() {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM area_solicitante WHERE ativo = 'S' ORDER BY ordem_exibicao, nome");
    return lowerRows(result.rows).map(row);
  });
}

async function buscarPorId(id) {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM area_solicitante WHERE id = :id", { id });
    return row(lowerRow(result.rows[0]));
  });
}

async function buscarPorNome(nome) {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM area_solicitante WHERE nome = :nome", { nome });
    return row(lowerRow(result.rows[0]));
  });
}

async function criar(dados) {
  const oracledb = getOracledb();
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `INSERT INTO area_solicitante (nome, ordem_exibicao) VALUES (:nome, :ordemExibicao) RETURNING id INTO :id`,
      { nome: dados.nome, ordemExibicao: dados.ordemExibicao ?? 0, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
    );
    const newId = result.outBinds.id[0];
    const check = await conn.execute("SELECT * FROM area_solicitante WHERE id = :id", { id: newId });
    return row(lowerRow(check.rows[0]));
  });
}

module.exports = { listarAtivas, buscarPorId, buscarPorNome, criar };
