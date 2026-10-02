"use strict";

const LABEL_PILAR = {
  auditoria_fisica: "comunicação operacional (auditoria física)",
  entrevista_lider: "alinhamento com a liderança",
  validacao_equipe: "composição e comunicação com a equipe"
};

function media(numeros) {
  const validos = numeros.filter((n) => n != null && !Number.isNaN(n));
  if (!validos.length) return null;
  return validos.reduce((a, b) => a + b, 0) / validos.length;
}

function gerarFocoPrincipal(topOfensores, mediasPorPilar) {
  if (!topOfensores.length) return null;
  const nomes = topOfensores.slice(0, 3).map((o) => o.indicador);
  const piorPilar = Object.entries(mediasPorPilar)
    .filter(([, valor]) => valor != null)
    .sort((a, b) => a[1] - b[1])[0];
  let texto = `Reforçar: ${nomes.join(", ")}.`;
  if (piorPilar) texto += ` As maiores oportunidades estão relacionadas a ${LABEL_PILAR[piorPilar[0]] || piorPilar[0]}.`;
  return texto;
}

/**
 * @param {Array} visitas linhas de visita_loja (já filtradas por período/CL/loja)
 * @param {Array} indicadores linhas de visita_loja_indicador correspondentes às mesmas
 *   visitas — cada item pode trazer `lojaNome` (join feito no repositório) pra permitir o
 *   drill-down "quais lojas responderam sim/não" por pergunta.
 */
function calcularMetricas(visitas, indicadores) {
  const mediaGeral = media(visitas.map((v) => v.resultadoGeralPct));
  const mediaAuditoriaFisica = media(visitas.map((v) => v.resultadoAuditoriaFisicaPct));
  const mediaEntrevistaLider = media(visitas.map((v) => v.resultadoEntrevistaLiderPct));
  const mediaValidacaoEquipe = media(visitas.map((v) => v.resultadoValidacaoEquipePct));

  // ranking de CLs: quantas visitas fez + média geral das visitas que ele é responsável
  const porCl = new Map();
  for (const v of visitas) {
    const chave = v.clNome || "Sem CL";
    if (!porCl.has(chave)) porCl.set(chave, { total: 0, soma: 0, qtd: 0 });
    const acc = porCl.get(chave);
    acc.total += 1;
    if (v.resultadoGeralPct != null) {
      acc.soma += v.resultadoGeralPct;
      acc.qtd += 1;
    }
  }
  const rankingCls = [...porCl.entries()]
    .map(([cl, acc]) => ({ cl, totalVisitas: acc.total, mediaGeralPct: acc.qtd ? acc.soma / acc.qtd : null }))
    .sort((a, b) => b.totalVisitas - a.totalVisitas || (b.mediaGeralPct ?? -1) - (a.mediaGeralPct ?? -1));
  const maxVisitasCl = rankingCls.length ? rankingCls[0].totalVisitas : 0;
  const clsComMaisVisitas = rankingCls.filter((c) => c.totalVisitas === maxVisitasCl).map((c) => c.cl);
  const porMedia = rankingCls.filter((c) => c.mediaGeralPct != null).sort((a, b) => b.mediaGeralPct - a.mediaGeralPct);
  const melhorClPorMedia = porMedia[0] || null;
  const piorClPorMedia = porMedia[porMedia.length - 1] || null;

  // ranking de lojas: média geral (uma loja pode ter mais de uma visita no período)
  const porLoja = new Map();
  for (const v of visitas) {
    if (!porLoja.has(v.lojaNome)) porLoja.set(v.lojaNome, { total: 0, soma: 0, qtd: 0 });
    const acc = porLoja.get(v.lojaNome);
    acc.total += 1;
    if (v.resultadoGeralPct != null) {
      acc.soma += v.resultadoGeralPct;
      acc.qtd += 1;
    }
  }
  const rankingLojas = [...porLoja.entries()]
    .map(([loja, acc]) => ({ loja, totalVisitas: acc.total, mediaGeralPct: acc.qtd ? acc.soma / acc.qtd : null }))
    .filter((x) => x.mediaGeralPct != null)
    .sort((a, b) => b.mediaGeralPct - a.mediaGeralPct);
  const melhorLoja = rankingLojas[0] || null;
  const piorLoja = rankingLojas.length ? rankingLojas[rankingLojas.length - 1] : null;

  // Perguntas derivadas (ex. "Informe se a Loja possui as duas comunicações...") não devem
  // aparecer como pergunta independente — mesmo quando, por erro de preenchimento, uma
  // resposta dela acaba parecendo Sim/Não (aconteceu na planilha real). Elas só aparecem
  // aninhadas dentro da pergunta-mãe (`respostasSecundarias`, calculado mais abaixo).
  const indicadoresFilhos = new Set(indicadores.filter((i) => i.indicadorPai).map((i) => i.indicador));

  // agrega por texto do indicador (pergunta) — % de respostas positivas entre as respondidas,
  // guardando também quais lojas disseram sim e quais disseram não (drill-down por pergunta)
  const porIndicador = new Map();
  let totalSim = 0;
  let totalNao = 0;
  for (const ind of indicadores) {
    if (indicadoresFilhos.has(ind.indicador)) continue;
    if (ind.respostaPositiva === true) totalSim += 1;
    else if (ind.respostaPositiva === false) totalNao += 1;
    if (ind.respostaPositiva == null) continue; // só entra no ranking quem deu pra interpretar como sim/não
    if (!porIndicador.has(ind.indicador)) {
      porIndicador.set(ind.indicador, { positivos: 0, total: 0, pilar: ind.pilar, lojasSim: [], lojasNao: [] });
    }
    const acc = porIndicador.get(ind.indicador);
    acc.total += 1;
    if (ind.respostaPositiva) {
      acc.positivos += 1;
      if (ind.lojaNome) acc.lojasSim.push(ind.lojaNome);
    } else if (ind.lojaNome) {
      acc.lojasNao.push(ind.lojaNome);
    }
  }
  const rankingIndicadores = [...porIndicador.entries()]
    .map(([indicador, acc]) => ({
      indicador,
      pilar: acc.pilar,
      pct: Math.round((acc.positivos / acc.total) * 100),
      total: acc.total,
      lojasSim: acc.lojasSim,
      lojasNao: acc.lojasNao
    }))
    .filter((x) => x.total >= 1);

  // Perguntas "faseadas": a pergunta derivada (ex. "Informe se a Loja possui as duas
  // comunicações, uma ou nenhuma.") não é Sim/Não — tem respostas categóricas próprias.
  // Agrega a % de cada resposta e as lojas que a deram, e anexa isso na pergunta-mãe
  // correspondente (marcada via `indicadorPai`, calculado na importação).
  const porIndicadorFilho = new Map();
  for (const ind of indicadores) {
    if (!ind.indicadorPai || !ind.respostaTexto) continue;
    if (!porIndicadorFilho.has(ind.indicadorPai)) porIndicadorFilho.set(ind.indicadorPai, new Map());
    const porResposta = porIndicadorFilho.get(ind.indicadorPai);
    if (!porResposta.has(ind.respostaTexto)) porResposta.set(ind.respostaTexto, { total: 0, lojas: [] });
    const acc = porResposta.get(ind.respostaTexto);
    acc.total += 1;
    if (ind.lojaNome) acc.lojas.push(ind.lojaNome);
  }
  for (const r of rankingIndicadores) {
    const porResposta = porIndicadorFilho.get(r.indicador);
    if (!porResposta) continue;
    const totalRespostas = [...porResposta.values()].reduce((a, b) => a + b.total, 0);
    r.respostasSecundarias = [...porResposta.entries()]
      .map(([resposta, acc]) => ({ resposta, total: acc.total, pct: Math.round((acc.total / totalRespostas) * 100), lojas: acc.lojas }))
      .sort((a, b) => b.total - a.total);
  }

  // Perguntas "de acompanhamento" (só preenchidas quando uma pergunta anterior permite)
  // podem ter resposta Sim/Não em pouquíssimas visitas — isso não é um indicador confiável
  // pra aparecer no top 5, é ruído estatístico. Só entram no ranking as que pelo menos
  // metade das visitas respondeu.
  const amostraMinima = Math.max(1, Math.ceil(visitas.length / 2));
  const indicadoresComAmostra = rankingIndicadores.filter((r) => r.total >= amostraMinima);
  const topPositivos = [...indicadoresComAmostra].sort((a, b) => b.pct - a.pct || b.total - a.total).slice(0, 5);
  const topOfensores = [...indicadoresComAmostra].sort((a, b) => a.pct - b.pct || b.total - a.total).slice(0, 5);

  // perguntas agrupadas por pilar (todas, não só o top 5) — alimenta o drill-down ao clicar
  // no card de um pilar (auditoria física / entrevista com líder / validação com equipe)
  const perguntasPorPilar = { auditoria_fisica: [], entrevista_lider: [], validacao_equipe: [] };
  for (const r of rankingIndicadores) {
    if (perguntasPorPilar[r.pilar]) perguntasPorPilar[r.pilar].push(r);
  }
  for (const lista of Object.values(perguntasPorPilar)) {
    lista.sort((a, b) => b.pct - a.pct);
  }

  const distribuicaoIndicadores = { excelentes: 0, atencao: 0, criticos: 0 };
  for (const r of rankingIndicadores) {
    if (r.pct >= 70) distribuicaoIndicadores.excelentes += 1;
    else if (r.pct >= 50) distribuicaoIndicadores.atencao += 1;
    else distribuicaoIndicadores.criticos += 1;
  }

  const focoPrincipal = gerarFocoPrincipal(topOfensores, {
    auditoria_fisica: mediaAuditoriaFisica,
    entrevista_lider: mediaEntrevistaLider,
    validacao_equipe: mediaValidacaoEquipe
  });

  return {
    totalVisitas: visitas.length,
    lojasVisitadas: new Set(visitas.map((v) => v.lojaNome)).size,
    clsAvaliados: new Set(visitas.map((v) => v.clNome).filter(Boolean)).size,
    mediaGeral,
    mediaAuditoriaFisica,
    mediaEntrevistaLider,
    mediaValidacaoEquipe,
    rankingCls,
    clsComMaisVisitas,
    melhorClPorMedia,
    piorClPorMedia,
    rankingLojas,
    melhorLoja,
    piorLoja,
    topPositivos,
    topOfensores,
    perguntasPorPilar,
    distribuicaoSimNao: { sim: totalSim, nao: totalNao },
    distribuicaoIndicadores,
    focoPrincipal
  };
}

module.exports = { calcularMetricas };
