"use strict";

const { withConnection, getOracledb, lowerRow, lowerRows } = require("../pool");

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

async function criar(dados) {
  const oracledb = getOracledb();
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `INSERT INTO anexo (chamado_id, nome_original, nome_armazenado, caminho_relativo, mime_type, tamanho_bytes, checksum_sha256, enviado_por)
       VALUES (:chamadoId, :nomeOriginal, :nomeArmazenado, :caminhoRelativo, :mimeType, :tamanhoBytes, :checksumSha256, :enviadoPor)
       RETURNING id INTO :id`,
      {
        chamadoId: dados.chamadoId,
        nomeOriginal: dados.nomeOriginal,
        nomeArmazenado: dados.nomeArmazenado,
        caminhoRelativo: dados.caminhoRelativo,
        mimeType: dados.mimeType ?? null,
        tamanhoBytes: dados.tamanhoBytes,
        checksumSha256: dados.checksumSha256 ?? null,
        enviadoPor: dados.enviadoPor ?? null,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );
    const check = await conn.execute("SELECT * FROM anexo WHERE id = :id", { id: result.outBinds.id[0] });
    return row(lowerRow(check.rows[0]));
  });
}

async function listarPorChamado(chamadoId) {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM anexo WHERE chamado_id = :chamadoId ORDER BY enviado_em", { chamadoId });
    return lowerRows(result.rows).map(row);
  });
}

async function buscarPorId(id) {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM anexo WHERE id = :id", { id });
    return row(lowerRow(result.rows[0]));
  });
}

async function contarPorChamado(chamadoId) {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT COUNT(*) AS n FROM anexo WHERE chamado_id = :chamadoId", { chamadoId });
    return lowerRow(result.rows[0]).n;
  });
}

module.exports = { criar, listarPorChamado, buscarPorId, contarPorChamado };
