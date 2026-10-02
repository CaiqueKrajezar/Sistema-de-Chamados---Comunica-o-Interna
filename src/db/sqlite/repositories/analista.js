"use strict";

const { getDb } = require("../client");

function row(r) {
  if (!r) return null;
  return {
    id: r.id,
    nome: r.nome,
    email: r.email,
    keycloakSubject: r.keycloak_subject,
    papel: r.papel,
    cor: r.cor,
    ativo: r.ativo === "S",
    acessoDashboardOperacoes: r.acesso_dashboard_operacoes === "S"
  };
}

function listarAtivos() {
  return getDb().prepare("SELECT * FROM analista WHERE ativo = 'S' ORDER BY nome").all().map(row);
}

function buscarPorId(id) {
  if (id == null) return null;
  return row(getDb().prepare("SELECT * FROM analista WHERE id = ?").get(id));
}

function buscarPorEmail(email) {
  return row(getDb().prepare("SELECT * FROM analista WHERE lower(email) = lower(?)").get(email));
}

function buscarPorKeycloakSubject(sub) {
  return row(getDb().prepare("SELECT * FROM analista WHERE keycloak_subject = ?").get(sub));
}

function criar(dados) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO analista (nome, email, keycloak_subject, papel, cor)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(dados.nome, dados.email, dados.keycloakSubject ?? null, dados.papel ?? "analista", dados.cor ?? "#3b6fd4");
  return buscarPorId(Number(info.lastInsertRowid));
}

function atualizarKeycloakSubject(id, keycloakSubject) {
  getDb().prepare("UPDATE analista SET keycloak_subject = ? WHERE id = ?").run(keycloakSubject, id);
  return buscarPorId(id);
}

function definirAcessoDashboardOperacoes(id, acesso) {
  getDb().prepare("UPDATE analista SET acesso_dashboard_operacoes = ? WHERE id = ?").run(acesso ? "S" : "N", id);
  return buscarPorId(id);
}

module.exports = {
  listarAtivos,
  buscarPorId,
  buscarPorEmail,
  buscarPorKeycloakSubject,
  criar,
  atualizarKeycloakSubject,
  definirAcessoDashboardOperacoes
};
