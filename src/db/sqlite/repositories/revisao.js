"use strict";

const { getDb } = require("../client");

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

function listarPorChamado(chamadoId) {
  return getDb()
    .prepare("SELECT * FROM revisao WHERE chamado_id = ? ORDER BY criado_em")
    .all(chamadoId)
    .map(row);
}

function contarPorTipo(chamadoId, tipoRevisao) {
  return getDb()
    .prepare("SELECT COUNT(*) AS n FROM revisao WHERE chamado_id = ? AND tipo_revisao = ?")
    .get(chamadoId, tipoRevisao).n;
}

function criar(dados) {
  const db = getDb();
  const jaExistem = contarPorTipo(dados.chamadoId, dados.tipoRevisao);
  const info = db
    .prepare(
      `INSERT INTO revisao (chamado_id, tipo_revisao, numero_sequencial, solicitado_por, descricao)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(dados.chamadoId, dados.tipoRevisao, jaExistem + 1, dados.solicitadoPor ?? null, dados.descricao ?? null);
  return row(db.prepare("SELECT * FROM revisao WHERE id = ?").get(Number(info.lastInsertRowid)));
}

module.exports = { listarPorChamado, contarPorTipo, criar };
