"use strict";

const { getDb } = require("../client");

function visitaRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    analistaId: r.analista_id,
    importacaoId: r.importacao_id,
    lojaNome: r.loja_nome,
    clNome: r.cl_nome,
    dataVisita: r.data_visita,
    resultadoGeralPct: r.resultado_geral_pct,
    resultadoAuditoriaFisicaPct: r.resultado_auditoria_fisica_pct,
    resultadoEntrevistaLiderPct: r.resultado_entrevista_lider_pct,
    resultadoValidacaoEquipePct: r.resultado_validacao_equipe_pct,
    criadoEm: r.criado_em
  };
}

function importacaoRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    analistaId: r.analista_id,
    nomeArquivo: r.nome_arquivo,
    totalLinhas: r.total_linhas,
    importadoPor: r.importado_por,
    importadoEm: r.importado_em
  };
}

function indicadorRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    visitaLojaId: r.visita_loja_id,
    pilar: r.pilar,
    indicador: r.indicador,
    respostaTexto: r.resposta_texto,
    respostaPositiva: r.resposta_positiva == null ? null : r.resposta_positiva === "S",
    indicadorPai: r.indicador_pai,
    lojaNome: r.loja_nome
  };
}

function buscarUltimaImportacao(analistaId) {
  return importacaoRow(
    getDb()
      .prepare("SELECT * FROM visita_loja_importacao WHERE analista_id = ? ORDER BY importado_em DESC LIMIT 1")
      .get(analistaId)
  );
}

function listarPorAnalista(analistaId, filtros = {}) {
  const db = getDb();
  const clauses = ["analista_id = ?"];
  const params = [analistaId];
  if (filtros.desde) {
    clauses.push("data_visita >= ?");
    params.push(filtros.desde);
  }
  if (filtros.ate) {
    clauses.push("data_visita <= ?");
    params.push(filtros.ate);
  }
  if (filtros.cl) {
    clauses.push("cl_nome = ?");
    params.push(filtros.cl);
  }
  if (filtros.loja) {
    clauses.push("loja_nome LIKE ?");
    params.push(`%${filtros.loja}%`);
  }
  const rows = db
    .prepare(`SELECT * FROM visita_loja WHERE ${clauses.join(" AND ")} ORDER BY data_visita DESC`)
    .all(...params);
  return rows.map(visitaRow);
}

function listarIndicadoresPorAnalista(analistaId, filtros = {}) {
  const db = getDb();
  const clauses = ["v.analista_id = ?"];
  const params = [analistaId];
  if (filtros.desde) {
    clauses.push("v.data_visita >= ?");
    params.push(filtros.desde);
  }
  if (filtros.ate) {
    clauses.push("v.data_visita <= ?");
    params.push(filtros.ate);
  }
  if (filtros.cl) {
    clauses.push("v.cl_nome = ?");
    params.push(filtros.cl);
  }
  if (filtros.loja) {
    clauses.push("v.loja_nome LIKE ?");
    params.push(`%${filtros.loja}%`);
  }
  const rows = db
    .prepare(
      `SELECT i.*, v.loja_nome FROM visita_loja_indicador i
       JOIN visita_loja v ON v.id = i.visita_loja_id
       WHERE ${clauses.join(" AND ")}`
    )
    .all(...params);
  return rows.map(indicadorRow);
}

function listarClsDistintos(analistaId) {
  return getDb()
    .prepare("SELECT DISTINCT cl_nome FROM visita_loja WHERE analista_id = ? AND cl_nome IS NOT NULL ORDER BY cl_nome")
    .all(analistaId)
    .map((r) => r.cl_nome);
}

/**
 * Substitui TODO o dataset de visitas do analista pela nova importação — confirmado em
 * reunião que o app de checklist sempre exporta a planilha completa, não incremental.
 */
function substituirDataset({ analistaId, nomeArquivo, importadoPor, visitas }) {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const infoImportacao = db
      .prepare(
        `INSERT INTO visita_loja_importacao (analista_id, nome_arquivo, total_linhas, importado_por)
         VALUES (?, ?, ?, ?)`
      )
      .run(analistaId, nomeArquivo ?? null, visitas.length, importadoPor ?? null);
    const importacaoId = Number(infoImportacao.lastInsertRowid);

    // remove o dataset anterior inteiro desse analista (cascade cuida dos indicadores)
    const antigas = db.prepare("SELECT id FROM visita_loja WHERE analista_id = ?").all(analistaId);
    if (antigas.length) {
      db.prepare(`DELETE FROM visita_loja WHERE analista_id = ?`).run(analistaId);
    }
    db.prepare("DELETE FROM visita_loja_importacao WHERE analista_id = ? AND id != ?").run(analistaId, importacaoId);

    const insertVisita = db.prepare(
      `INSERT INTO visita_loja (
         analista_id, importacao_id, loja_nome, cl_nome, data_visita,
         resultado_geral_pct, resultado_auditoria_fisica_pct,
         resultado_entrevista_lider_pct, resultado_validacao_equipe_pct
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertIndicador = db.prepare(
      `INSERT INTO visita_loja_indicador (visita_loja_id, pilar, indicador, resposta_texto, resposta_positiva, indicador_pai)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    for (const v of visitas) {
      const info = insertVisita.run(
        analistaId,
        importacaoId,
        v.lojaNome,
        v.clNome ?? null,
        v.dataVisita ?? null,
        v.resultadoGeralPct ?? null,
        v.resultadoAuditoriaFisicaPct ?? null,
        v.resultadoEntrevistaLiderPct ?? null,
        v.resultadoValidacaoEquipePct ?? null
      );
      const visitaId = Number(info.lastInsertRowid);
      for (const ind of v.indicadores || []) {
        insertIndicador.run(
          visitaId,
          ind.pilar || "outro",
          ind.indicador,
          ind.respostaTexto ?? null,
          ind.respostaPositiva == null ? null : ind.respostaPositiva ? "S" : "N",
          ind.indicadorPai ?? null
        );
      }
    }

    db.exec("COMMIT");
    return importacaoRow(db.prepare("SELECT * FROM visita_loja_importacao WHERE id = ?").get(importacaoId));
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

module.exports = {
  buscarUltimaImportacao,
  listarPorAnalista,
  listarIndicadoresPorAnalista,
  listarClsDistintos,
  substituirDataset
};
