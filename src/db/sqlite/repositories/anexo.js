"use strict";

const { getDb } = require("../client");

function row(r) {
  if (!r) return null;
  return {
    id: r.id,
    chamadoId: r.chamado_id,
    nomeOriginal: r.nome_original,
    nomeArmazenado: r.nome_armazenado,
    caminhoRelativo: r.caminho_relativo,
    mimeType: r.mime_type,
    tamanhoBytes: r.tamanho_bytes,
    checksumSha256: r.checksum_sha256,
    enviadoPor: r.enviado_por,
    enviadoEm: r.enviado_em
  };
}

function criar(dados) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO anexo (chamado_id, nome_original, nome_armazenado, caminho_relativo, mime_type, tamanho_bytes, checksum_sha256, enviado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      dados.chamadoId,
      dados.nomeOriginal,
      dados.nomeArmazenado,
      dados.caminhoRelativo,
      dados.mimeType ?? null,
      dados.tamanhoBytes,
      dados.checksumSha256 ?? null,
      dados.enviadoPor ?? null
    );
  return row(db.prepare("SELECT * FROM anexo WHERE id = ?").get(Number(info.lastInsertRowid)));
}

function listarPorChamado(chamadoId) {
  return getDb().prepare("SELECT * FROM anexo WHERE chamado_id = ? ORDER BY enviado_em").all(chamadoId).map(row);
}

function buscarPorId(id) {
  return row(getDb().prepare("SELECT * FROM anexo WHERE id = ?").get(id));
}

function contarPorChamado(chamadoId) {
  return getDb().prepare("SELECT COUNT(*) AS n FROM anexo WHERE chamado_id = ?").get(chamadoId).n;
}

module.exports = { criar, listarPorChamado, buscarPorId, contarPorChamado };
