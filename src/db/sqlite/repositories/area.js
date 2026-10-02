"use strict";

const { getDb } = require("../client");

function row(r) {
  if (!r) return null;
  return { id: r.id, nome: r.nome, ativo: r.ativo === "S", ordemExibicao: r.ordem_exibicao };
}

function listarAtivas() {
  return getDb()
    .prepare("SELECT * FROM area_solicitante WHERE ativo = 'S' ORDER BY ordem_exibicao, nome")
    .all()
    .map(row);
}

function buscarPorId(id) {
  return row(getDb().prepare("SELECT * FROM area_solicitante WHERE id = ?").get(id));
}

function buscarPorNome(nome) {
  return row(getDb().prepare("SELECT * FROM area_solicitante WHERE nome = ?").get(nome));
}

function criar(dados) {
  const db = getDb();
  const info = db
    .prepare("INSERT INTO area_solicitante (nome, ordem_exibicao) VALUES (?, ?)")
    .run(dados.nome, dados.ordemExibicao ?? 0);
  return buscarPorId(Number(info.lastInsertRowid));
}

module.exports = { listarAtivas, buscarPorId, buscarPorNome, criar };
