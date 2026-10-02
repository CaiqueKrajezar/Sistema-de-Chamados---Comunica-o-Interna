"use strict";

const { withConnection, getOracledb, lowerRow, lowerRows } = require("../pool");

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

async function listarAtivos() {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM analista WHERE ativo = 'S' ORDER BY nome");
    return lowerRows(result.rows).map(row);
  });
}

async function buscarPorId(id) {
  if (id == null) return null;
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM analista WHERE id = :id", { id });
    return row(lowerRow(result.rows[0]));
  });
}

async function buscarPorEmail(email) {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM analista WHERE lower(email) = lower(:email)", { email });
    return row(lowerRow(result.rows[0]));
  });
}

async function buscarPorKeycloakSubject(sub) {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM analista WHERE keycloak_subject = :sub", { sub });
    return row(lowerRow(result.rows[0]));
  });
}

async function criar(dados) {
  const oracledb = getOracledb();
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `INSERT INTO analista (nome, email, keycloak_subject, papel, cor)
       VALUES (:nome, :email, :keycloakSubject, :papel, :cor)
       RETURNING id INTO :id`,
      {
        nome: dados.nome,
        email: dados.email,
        keycloakSubject: dados.keycloakSubject ?? null,
        papel: dados.papel ?? "analista",
        cor: dados.cor ?? "#3b6fd4",
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );
    const newId = result.outBinds.id[0];
    const check = await conn.execute("SELECT * FROM analista WHERE id = :id", { id: newId });
    return row(lowerRow(check.rows[0]));
  });
}

async function atualizarKeycloakSubject(id, keycloakSubject) {
  return withConnection(async (conn) => {
    await conn.execute("UPDATE analista SET keycloak_subject = :sub WHERE id = :id", { sub: keycloakSubject, id });
    const check = await conn.execute("SELECT * FROM analista WHERE id = :id", { id });
    return row(lowerRow(check.rows[0]));
  });
}

async function definirAcessoDashboardOperacoes(id, acesso) {
  return withConnection(async (conn) => {
    await conn.execute("UPDATE analista SET acesso_dashboard_operacoes = :acesso WHERE id = :id", {
      acesso: acesso ? "S" : "N",
      id
    });
    const check = await conn.execute("SELECT * FROM analista WHERE id = :id", { id });
    return row(lowerRow(check.rows[0]));
  });
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
