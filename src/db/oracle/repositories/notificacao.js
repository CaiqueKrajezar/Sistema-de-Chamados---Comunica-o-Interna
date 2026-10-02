"use strict";

const { withConnection, getOracledb, lowerRow, lowerRows } = require("../pool");

function row(r) {
  if (!r) return null;
  return {
    id: r.id,
    chamadoId: r.chamado_id,
    analistaId: r.analista_id,
    destinatarioEmail: r.destinatario_email,
    tipoEvento: r.tipo_evento,
    assunto: r.assunto,
    corpo: r.corpo,
    statusEnvio: r.status_envio,
    tentativas: r.tentativas,
    erroMensagem: r.erro_mensagem,
    criadoEm: r.criado_em,
    enviadoEm: r.enviado_em
  };
}

async function criar(dados) {
  const oracledb = getOracledb();
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `INSERT INTO notificacao (chamado_id, analista_id, destinatario_email, tipo_evento, assunto, corpo)
       VALUES (:chamadoId, :analistaId, :destinatarioEmail, :tipoEvento, :assunto, :corpo)
       RETURNING id INTO :id`,
      {
        chamadoId: dados.chamadoId ?? null,
        analistaId: dados.analistaId ?? null,
        destinatarioEmail: dados.destinatarioEmail,
        tipoEvento: dados.tipoEvento,
        assunto: dados.assunto,
        corpo: dados.corpo ?? null,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );
    const check = await conn.execute("SELECT * FROM notificacao WHERE id = :id", { id: result.outBinds.id[0] });
    return row(lowerRow(check.rows[0]));
  });
}

async function listarPendentes(limit = 20) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `SELECT * FROM notificacao WHERE status_envio = 'pendente' ORDER BY criado_em FETCH FIRST :limit ROWS ONLY`,
      { limit }
    );
    return lowerRows(result.rows).map(row);
  });
}

async function listarRecentes(limit = 20) {
  return withConnection(async (conn) => {
    const result = await conn.execute(`SELECT * FROM notificacao ORDER BY criado_em DESC FETCH FIRST :limit ROWS ONLY`, { limit });
    return lowerRows(result.rows).map(row);
  });
}

async function marcarEnviada(id) {
  return withConnection(async (conn) => {
    await conn.execute("UPDATE notificacao SET status_envio = 'enviado', enviado_em = SYSTIMESTAMP WHERE id = :id", { id });
  });
}

async function marcarFalha(id, erro) {
  return withConnection(async (conn) => {
    await conn.execute(
      "UPDATE notificacao SET status_envio = 'falha', tentativas = tentativas + 1, erro_mensagem = :erro WHERE id = :id",
      { erro: String(erro).slice(0, 1000), id }
    );
  });
}

module.exports = { criar, listarPendentes, listarRecentes, marcarEnviada, marcarFalha };
