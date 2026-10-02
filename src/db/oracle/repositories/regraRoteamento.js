"use strict";

const { withConnection, getOracledb, lowerRow, lowerRows } = require("../pool");

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

async function publicosDaRegra(conn, regraId) {
  const result = await conn.execute("SELECT publico FROM regra_roteamento_publico WHERE regra_id = :regraId", { regraId });
  return lowerRows(result.rows).map((p) => p.publico);
}

async function listarComPublicos({ apenasAtivas = false } = {}) {
  return withConnection(async (conn) => {
    const sql = apenasAtivas
      ? "SELECT * FROM regra_roteamento WHERE ativo = 'S' ORDER BY prioridade DESC, id"
      : "SELECT * FROM regra_roteamento ORDER BY prioridade DESC, id";
    const result = await conn.execute(sql);
    const rows = lowerRows(result.rows);
    const out = [];
    for (const r of rows) out.push(row(r, await publicosDaRegra(conn, r.id)));
    return out;
  });
}

async function buscarPorId(id) {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM regra_roteamento WHERE id = :id", { id });
    const r = lowerRow(result.rows[0]);
    if (!r) return null;
    return row(r, await publicosDaRegra(conn, id));
  });
}

async function buscarCandidatas({ publico, areaId, tipoSolicitacaoId }) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `SELECT r.* FROM regra_roteamento r
       JOIN regra_roteamento_publico p ON p.regra_id = r.id
       WHERE r.ativo = 'S'
         AND p.publico = :publico
         AND (r.area_id IS NULL OR r.area_id = :areaId)
         AND (r.tipo_solicitacao_id IS NULL OR r.tipo_solicitacao_id = :tipoSolicitacaoId)
       ORDER BY r.prioridade DESC, r.id`,
      { publico, areaId: areaId ?? null, tipoSolicitacaoId: tipoSolicitacaoId ?? null }
    );
    const rows = lowerRows(result.rows);
    const out = [];
    for (const r of rows) out.push(row(r, await publicosDaRegra(conn, r.id)));
    return out;
  });
}

async function criar(dados) {
  const oracledb = getOracledb();
  return withConnection(async (conn) => {
    const result = await conn.execute(
      `INSERT INTO regra_roteamento
         (area_id, tipo_solicitacao_id, analista_principal_id, analista_secundario_id,
          responsavel_sla, prioridade, observacao, atualizado_por)
       VALUES (:areaId, :tipoSolicitacaoId, :analistaPrincipalId, :analistaSecundarioId,
               :responsavelSla, :prioridade, :observacao, :atualizadoPor)
       RETURNING id INTO :id`,
      {
        areaId: dados.areaId ?? null,
        tipoSolicitacaoId: dados.tipoSolicitacaoId ?? null,
        analistaPrincipalId: dados.analistaPrincipalId,
        analistaSecundarioId: dados.analistaSecundarioId ?? null,
        responsavelSla: dados.responsavelSla ?? "PRINCIPAL",
        prioridade: dados.prioridade ?? 0,
        observacao: dados.observacao ?? null,
        atualizadoPor: dados.atualizadoPor ?? null,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );
    const regraId = result.outBinds.id[0];
    for (const publico of dados.publicos) {
      await conn.execute("INSERT INTO regra_roteamento_publico (regra_id, publico) VALUES (:regraId, :publico)", {
        regraId,
        publico
      });
    }
    const check = await conn.execute("SELECT * FROM regra_roteamento WHERE id = :id", { id: regraId });
    return row(lowerRow(check.rows[0]), await publicosDaRegra(conn, regraId));
  });
}

async function atualizar(id, dados) {
  return withConnection(async (conn) => {
    await conn.execute(
      `UPDATE regra_roteamento SET
         area_id = :areaId, tipo_solicitacao_id = :tipoSolicitacaoId, analista_principal_id = :analistaPrincipalId,
         analista_secundario_id = :analistaSecundarioId, responsavel_sla = :responsavelSla, prioridade = :prioridade,
         ativo = :ativo, observacao = :observacao, atualizado_por = :atualizadoPor, atualizado_em = SYSTIMESTAMP
       WHERE id = :id`,
      {
        areaId: dados.areaId ?? null,
        tipoSolicitacaoId: dados.tipoSolicitacaoId ?? null,
        analistaPrincipalId: dados.analistaPrincipalId,
        analistaSecundarioId: dados.analistaSecundarioId ?? null,
        responsavelSla: dados.responsavelSla ?? "PRINCIPAL",
        prioridade: dados.prioridade ?? 0,
        ativo: dados.ativo === false ? "N" : "S",
        observacao: dados.observacao ?? null,
        atualizadoPor: dados.atualizadoPor ?? null,
        id
      }
    );
    if (dados.publicos) {
      await conn.execute("DELETE FROM regra_roteamento_publico WHERE regra_id = :id", { id });
      for (const publico of dados.publicos) {
        await conn.execute("INSERT INTO regra_roteamento_publico (regra_id, publico) VALUES (:id, :publico)", { id, publico });
      }
    }
    const check = await conn.execute("SELECT * FROM regra_roteamento WHERE id = :id", { id });
    return row(lowerRow(check.rows[0]), await publicosDaRegra(conn, id));
  });
}

async function desativar(id, atualizadoPor) {
  return withConnection(async (conn) => {
    await conn.execute(
      "UPDATE regra_roteamento SET ativo = 'N', atualizado_por = :atualizadoPor, atualizado_em = SYSTIMESTAMP WHERE id = :id",
      { atualizadoPor: atualizadoPor ?? null, id }
    );
    const check = await conn.execute("SELECT * FROM regra_roteamento WHERE id = :id", { id });
    return row(lowerRow(check.rows[0]), await publicosDaRegra(conn, id));
  });
}

module.exports = { listarComPublicos, buscarPorId, buscarCandidatas, criar, atualizar, desativar };
