"use strict";

/**
 * Storage alternativo (ATTACHMENT_STORAGE=oracle_blob) — usar só se a política de TI exigir
 * tudo centralizado no Oracle. Espera que o registro em ANEXO já exista (chama depois de
 * repos.anexo.criar) e grava o binário em anexo_conteudo, referenciado pelo mesmo id.
 */
async function salvar({ anexoId, buffer }) {
  const { withConnection, getOracledb } = require("../../db/oracle/pool");
  const oracledb = getOracledb();
  await withConnection(async (conn) => {
    await conn.execute("INSERT INTO anexo_conteudo (anexo_id, conteudo) VALUES (:anexoId, :conteudo)", {
      anexoId,
      conteudo: { val: buffer, type: oracledb.BLOB }
    });
  });
}

async function ler(anexoId) {
  const { withConnection } = require("../../db/oracle/pool");
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT conteudo FROM anexo_conteudo WHERE anexo_id = :anexoId", { anexoId });
    const lob = result.rows[0]?.CONTEUDO;
    if (!lob) return null;
    return lob.getData ? lob.getData() : lob;
  });
}

module.exports = { salvar, ler };
