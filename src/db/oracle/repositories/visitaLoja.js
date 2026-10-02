"use strict";

const { withConnection, getOracledb, lowerRow, lowerRows } = require("../pool");

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

async function buscarUltimaImportacao(analistaId) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      "SELECT * FROM visita_loja_importacao WHERE analista_id = :analistaId ORDER BY importado_em DESC FETCH FIRST 1 ROWS ONLY",
      { analistaId }
    );
    return importacaoRow(lowerRow(result.rows[0]));
  });
}

function montarFiltros({ desde, ate, cl, loja }, prefixo = "") {
  const clauses = [];
  const binds = {};
  if (desde) {
    clauses.push(`${prefixo}data_visita >= :desde`);
    binds.desde = desde;
  }
  if (ate) {
    clauses.push(`${prefixo}data_visita <= :ate`);
    binds.ate = ate;
  }
  if (cl) {
    clauses.push(`${prefixo}cl_nome = :cl`);
    binds.cl = cl;
  }
  if (loja) {
    clauses.push(`${prefixo}loja_nome LIKE '%' || :loja || '%'`);
    binds.loja = loja;
  }
  return { clauses, binds };
}

async function listarPorAnalista(analistaId, filtros = {}) {
  return withConnection(async (conn) => {
    const { clauses, binds } = montarFiltros(filtros);
    const where = ["analista_id = :analistaId", ...clauses].join(" AND ");
    const result = await conn.execute(`SELECT * FROM visita_loja WHERE ${where} ORDER BY data_visita DESC`, {
      analistaId,
      ...binds
    });
    return lowerRows(result.rows).map(visitaRow);
  });
}

async function listarIndicadoresPorAnalista(analistaId, filtros = {}) {
  return withConnection(async (conn) => {
    const { clauses, binds } = montarFiltros(filtros, "v.");
    const where = ["v.analista_id = :analistaId", ...clauses].join(" AND ");
    const result = await conn.execute(
      `SELECT i.*, v.loja_nome FROM visita_loja_indicador i
       JOIN visita_loja v ON v.id = i.visita_loja_id
       WHERE ${where}`,
      { analistaId, ...binds }
    );
    return lowerRows(result.rows).map(indicadorRow);
  });
}

async function listarClsDistintos(analistaId) {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      "SELECT DISTINCT cl_nome FROM visita_loja WHERE analista_id = :analistaId AND cl_nome IS NOT NULL ORDER BY cl_nome",
      { analistaId }
    );
    return lowerRows(result.rows).map((r) => r.cl_nome);
  });
}

async function substituirDataset({ analistaId, nomeArquivo, importadoPor, visitas }) {
  const oracledb = getOracledb();
  return withConnection(async (conn) => {
    const insertImportacao = await conn.execute(
      `INSERT INTO visita_loja_importacao (analista_id, nome_arquivo, total_linhas, importado_por)
       VALUES (:analistaId, :nomeArquivo, :totalLinhas, :importadoPor)
       RETURNING id INTO :id`,
      {
        analistaId,
        nomeArquivo: nomeArquivo ?? null,
        totalLinhas: visitas.length,
        importadoPor: importadoPor ?? null,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );
    const importacaoId = insertImportacao.outBinds.id[0];

    await conn.execute("DELETE FROM visita_loja WHERE analista_id = :analistaId", { analistaId });
    await conn.execute("DELETE FROM visita_loja_importacao WHERE analista_id = :analistaId AND id != :importacaoId", {
      analistaId,
      importacaoId
    });

    for (const v of visitas) {
      const insertVisita = await conn.execute(
        `INSERT INTO visita_loja (
           analista_id, importacao_id, loja_nome, cl_nome, data_visita,
           resultado_geral_pct, resultado_auditoria_fisica_pct,
           resultado_entrevista_lider_pct, resultado_validacao_equipe_pct
         ) VALUES (
           :analistaId, :importacaoId, :lojaNome, :clNome, :dataVisita,
           :resultadoGeralPct, :resultadoAuditoriaFisicaPct,
           :resultadoEntrevistaLiderPct, :resultadoValidacaoEquipePct
         ) RETURNING id INTO :id`,
        {
          analistaId,
          importacaoId,
          lojaNome: v.lojaNome,
          clNome: v.clNome ?? null,
          dataVisita: v.dataVisita ?? null,
          resultadoGeralPct: v.resultadoGeralPct ?? null,
          resultadoAuditoriaFisicaPct: v.resultadoAuditoriaFisicaPct ?? null,
          resultadoEntrevistaLiderPct: v.resultadoEntrevistaLiderPct ?? null,
          resultadoValidacaoEquipePct: v.resultadoValidacaoEquipePct ?? null,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        }
      );
      const visitaId = insertVisita.outBinds.id[0];
      for (const ind of v.indicadores || []) {
        await conn.execute(
          `INSERT INTO visita_loja_indicador (visita_loja_id, pilar, indicador, resposta_texto, resposta_positiva, indicador_pai)
           VALUES (:visitaId, :pilar, :indicador, :respostaTexto, :respostaPositiva, :indicadorPai)`,
          {
            visitaId,
            pilar: ind.pilar || "outro",
            indicador: ind.indicador,
            respostaTexto: ind.respostaTexto ?? null,
            respostaPositiva: ind.respostaPositiva == null ? null : ind.respostaPositiva ? "S" : "N",
            indicadorPai: ind.indicadorPai ?? null
          }
        );
      }
    }

    const check = await conn.execute("SELECT * FROM visita_loja_importacao WHERE id = :id", { id: importacaoId });
    return importacaoRow(lowerRow(check.rows[0]));
  });
}

module.exports = {
  buscarUltimaImportacao,
  listarPorAnalista,
  listarIndicadoresPorAnalista,
  listarClsDistintos,
  substituirDataset
};
