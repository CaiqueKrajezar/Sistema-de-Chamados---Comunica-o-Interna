"use strict";

const { getDb } = require("../client");

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

function criar(dados) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO notificacao (chamado_id, analista_id, destinatario_email, tipo_evento, assunto, corpo)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      dados.chamadoId ?? null,
      dados.analistaId ?? null,
      dados.destinatarioEmail,
      dados.tipoEvento,
      dados.assunto,
      dados.corpo ?? null
    );
  return row(db.prepare("SELECT * FROM notificacao WHERE id = ?").get(Number(info.lastInsertRowid)));
}

function listarPendentes(limit = 20) {
  return getDb()
    .prepare("SELECT * FROM notificacao WHERE status_envio = 'pendente' ORDER BY criado_em LIMIT ?")
    .all(limit)
    .map(row);
}

function listarRecentes(limit = 20) {
  return getDb().prepare("SELECT * FROM notificacao ORDER BY criado_em DESC LIMIT ?").all(limit).map(row);
}

function marcarEnviada(id) {
  getDb()
    .prepare("UPDATE notificacao SET status_envio = 'enviado', enviado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
    .run(id);
}

function marcarFalha(id, erro) {
  getDb()
    .prepare("UPDATE notificacao SET status_envio = 'falha', tentativas = tentativas + 1, erro_mensagem = ? WHERE id = ?")
    .run(String(erro).slice(0, 1000), id);
}

module.exports = { criar, listarPendentes, listarRecentes, marcarEnviada, marcarFalha };
