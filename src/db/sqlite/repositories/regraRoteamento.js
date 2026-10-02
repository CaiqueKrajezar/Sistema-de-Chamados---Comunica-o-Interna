"use strict";

const { getDb } = require("../client");

function row(r, publicos) {
  if (!r) return null;
  return {
    id: r.id,
    areaId: r.area_id,
    tipoSolicitacaoId: r.tipo_solicitacao_id,
    analistaPrincipalId: r.analista_principal_id,
    analistaSecundarioId: r.analista_secundario_id,
    responsavelSla: r.responsavel_sla,
    prioridade: r.prioridade,
    ativo: r.ativo === "S",
    observacao: r.observacao,
    publicos: publicos ?? [],
    atualizadoPor: r.atualizado_por,
    atualizadoEm: r.atualizado_em
  };
}

function publicosDaRegra(db, regraId) {
  return db
    .prepare("SELECT publico FROM regra_roteamento_publico WHERE regra_id = ?")
    .all(regraId)
    .map((p) => p.publico);
}

function listarComPublicos({ apenasAtivas = false } = {}) {
  const db = getDb();
  const sql = apenasAtivas
    ? "SELECT * FROM regra_roteamento WHERE ativo = 'S' ORDER BY prioridade DESC, id"
    : "SELECT * FROM regra_roteamento ORDER BY prioridade DESC, id";
  return db
    .prepare(sql)
    .all()
    .map((r) => row(r, publicosDaRegra(db, r.id)));
}

function buscarPorId(id) {
  const db = getDb();
  const r = db.prepare("SELECT * FROM regra_roteamento WHERE id = ?").get(id);
  if (!r) return null;
  return row(r, publicosDaRegra(db, id));
}

/** Motor de roteamento consome isso: candidatas ativas cujo público bate e cuja área/tipo é NULL (qualquer) ou igual. */
function buscarCandidatas({ publico, areaId, tipoSolicitacaoId }) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT r.* FROM regra_roteamento r
       JOIN regra_roteamento_publico p ON p.regra_id = r.id
       WHERE r.ativo = 'S'
         AND p.publico = ?
         AND (r.area_id IS NULL OR r.area_id = ?)
         AND (r.tipo_solicitacao_id IS NULL OR r.tipo_solicitacao_id = ?)
       ORDER BY r.prioridade DESC, r.id`
    )
    .all(publico, areaId ?? null, tipoSolicitacaoId ?? null);
  return rows.map((r) => row(r, publicosDaRegra(db, r.id)));
}

function criar(dados) {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const info = db
      .prepare(
        `INSERT INTO regra_roteamento
           (area_id, tipo_solicitacao_id, analista_principal_id, analista_secundario_id,
            responsavel_sla, prioridade, observacao, atualizado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        dados.areaId ?? null,
        dados.tipoSolicitacaoId ?? null,
        dados.analistaPrincipalId,
        dados.analistaSecundarioId ?? null,
        dados.responsavelSla ?? "PRINCIPAL",
        dados.prioridade ?? 0,
        dados.observacao ?? null,
        dados.atualizadoPor ?? null
      );
    const regraId = Number(info.lastInsertRowid);
    const insertPublico = db.prepare("INSERT INTO regra_roteamento_publico (regra_id, publico) VALUES (?, ?)");
    for (const publico of dados.publicos) insertPublico.run(regraId, publico);
    db.exec("COMMIT");
    return buscarPorId(regraId);
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function atualizar(id, dados) {
  const db = getDb();
  db.exec("BEGIN");
  try {
    db.prepare(
      `UPDATE regra_roteamento SET
         area_id = ?, tipo_solicitacao_id = ?, analista_principal_id = ?, analista_secundario_id = ?,
         responsavel_sla = ?, prioridade = ?, ativo = ?, observacao = ?, atualizado_por = ?,
         atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`
    ).run(
      dados.areaId ?? null,
      dados.tipoSolicitacaoId ?? null,
      dados.analistaPrincipalId,
      dados.analistaSecundarioId ?? null,
      dados.responsavelSla ?? "PRINCIPAL",
      dados.prioridade ?? 0,
      dados.ativo === false ? "N" : "S",
      dados.observacao ?? null,
      dados.atualizadoPor ?? null,
      id
    );
    if (dados.publicos) {
      db.prepare("DELETE FROM regra_roteamento_publico WHERE regra_id = ?").run(id);
      const insertPublico = db.prepare("INSERT INTO regra_roteamento_publico (regra_id, publico) VALUES (?, ?)");
      for (const publico of dados.publicos) insertPublico.run(id, publico);
    }
    db.exec("COMMIT");
    return buscarPorId(id);
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function desativar(id, atualizadoPor) {
  getDb()
    .prepare(
      `UPDATE regra_roteamento SET ativo = 'N', atualizado_por = ?, atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`
    )
    .run(atualizadoPor ?? null, id);
  return buscarPorId(id);
}

module.exports = { listarComPublicos, buscarPorId, buscarCandidatas, criar, atualizar, desativar };
