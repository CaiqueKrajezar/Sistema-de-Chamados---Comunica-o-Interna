"use strict";

const { getDb } = require("../client");

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

function listarAtivos() {
  const rows = getDb()
    .prepare("SELECT * FROM tipo_solicitacao WHERE ativo = 'S' ORDER BY ordem_exibicao, nome")
    .all();
  return rows.map(row);
}

function buscarPorId(id) {
  return row(getDb().prepare("SELECT * FROM tipo_solicitacao WHERE id = ?").get(id));
}

function buscarPorNome(nome) {
  return row(getDb().prepare("SELECT * FROM tipo_solicitacao WHERE nome = ?").get(nome));
}

function criar(dados) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO tipo_solicitacao (nome, sla_dias, sla_conta_dias_uteis, requer_briefing_evento, ordem_exibicao)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      dados.nome,
      dados.slaDias,
      dados.slaContaDiasUteis === false ? "N" : "S",
      dados.requerBriefingEvento ? "S" : "N",
      dados.ordemExibicao ?? 0
    );
  return buscarPorId(Number(info.lastInsertRowid));
}

module.exports = { listarAtivos, buscarPorId, buscarPorNome, criar };
