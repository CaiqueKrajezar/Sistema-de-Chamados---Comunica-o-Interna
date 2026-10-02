"use strict";

const { withConnection, getOracledb, lowerRow, lowerRows } = require("../pool");

function row(r) {
  if (!r) return null;
  return {
    id: r.id,
    nome: r.nome,
    slaDias: r.sla_dias,
    slaContaDiasUteis: r.sla_conta_dias_uteis === "S",
    requerBriefingEvento: r.requer_briefing_evento === "S",
    ativo: r.ativo === "S",
    ordemExibicao: r.ordem_exibicao
  };
}

async function listarAtivos() {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM tipo_solicitacao WHERE ativo = 'S' ORDER BY ordem_exibicao, nome");
    return lowerRows(result.rows).map(row);
  });
}

async function buscarPorId(id) {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM tipo_solicitacao WHERE id = :id", { id });
    return row(lowerRow(result.rows[0]));
  });
}

async function buscarPorNome(nome) {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM tipo_solicitacao WHERE nome = :nome", { nome });
    return row(lowerRow(result.rows[0]));
  });
}

async function criar(dados) {
  const oracledb = getOracledb();
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `INSERT INTO tipo_solicitacao (nome, sla_dias, sla_conta_dias_uteis, requer_briefing_evento, ordem_exibicao)
       VALUES (:nome, :slaDias, :slaContaDiasUteis, :requerBriefingEvento, :ordemExibicao)
       RETURNING id INTO :id`,
      {
        nome: dados.nome,
        slaDias: dados.slaDias,
        slaContaDiasUteis: dados.slaContaDiasUteis === false ? "N" : "S",
        requerBriefingEvento: dados.requerBriefingEvento ? "S" : "N",
        ordemExibicao: dados.ordemExibicao ?? 0,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );
    const newId = result.outBinds.id[0];
    const check = await conn.execute("SELECT * FROM tipo_solicitacao WHERE id = :id", { id: newId });
    return row(lowerRow(check.rows[0]));
  });
}

module.exports = { listarAtivos, buscarPorId, buscarPorNome, criar };
