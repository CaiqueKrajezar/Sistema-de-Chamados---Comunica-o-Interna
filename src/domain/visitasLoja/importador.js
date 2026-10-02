"use strict";

const { tokenizarLinhas } = require("../../services/csvParser");

/**
 * Mapeia o CSV "Visita Estruturada" exportado do Checklist Fácil (formato confirmado com o
 * Rafael em 01/10/2026 — uma linha por VISITA, não por item) pro formato aceito por
 * visitaLojaRepository.substituirDataset.
 *
 * O arquivo tem DUAS linhas de cabeçalho: a 1ª é uma linha de "categoria" que só preenche
 * o nome do pilar (Auditoria física / Entrevista com o Líder / Validação com a equipe da
 * Loja) acima do bloco de colunas daquele pilar — as colunas de metadado (Status, Unidade,
 * Resultado etc.) ficam em branco nessa linha. A 2ª linha é o nome de cada pergunta. Como
 * "Percentual da área" se repete uma vez por pilar, não dá pra usar nome de coluna como
 * chave única — por isso o parser aqui trabalha por ÍNDICE de coluna, casando cada índice
 * com a categoria (pilar) da linha 1.
 *
 * Dentro de cada pilar, a maioria das perguntas é Sim/Não; algumas são "de
 * acompanhamento" (só preenchidas quando a pergunta anterior foi respondida de um jeito
 * específico, ex. "O que está no Mural?" só vem preenchido quando "O espaço de Cultura...”
 * foi Sim) — não precisamos saber quais são: qualquer valor que não dá pra interpretar
 * como Sim/Não fica de fora do ranking de indicadores automaticamente.
 */

const ALIAS_STATUS = ["status"];
const ALIAS_UNIDADE = ["unidade", "loja", "nome da loja"];
const ALIAS_RESULTADO_GERAL = ["resultado", "resultado geral", "nota geral"];
const ALIAS_DATA_VISITA = ["data de início", "data de inicio", "data da visita", "data visita"];
const ALIAS_DATA_ABERTURA = ["data abertura"];
const ALIAS_PERCENTUAL_AREA = ["percentual da área", "percentual da area", "% da área", "% da area"];

function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Heurística pra achar a pergunta "quem é o CL" — o texto exato varia um pouco entre
// versões do checklist.
function itemEhClResponsavel(campoTexto) {
  return normalizar(campoTexto).includes("cl responsavel");
}

function inferirPilarDaCategoria(valorCategoria) {
  const norm = normalizar(valorCategoria);
  if (norm.includes("auditoria")) return "auditoria_fisica";
  if (norm.includes("entrevista") || norm.includes("lider")) return "entrevista_lider";
  if (norm.includes("validacao") || norm.includes("equipe")) return "validacao_equipe";
  return "outro";
}

function paraNumero(valor) {
  if (valor == null || valor === "") return null;
  let s = String(valor).replace(/%/g, "").trim();
  if (s.includes(",") && s.includes(".")) {
    // formato BR com milhar: "1.234,56" — ponto é separador de milhar, vírgula é decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    // só vírgula: decimal BR simples, "76,92" ou "57,14%" (o % já foi removido acima)
    s = s.replace(",", ".");
  }
  // só ponto ou nenhum separador: já é um número válido pro Number(), ex. "61.54"
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function paraData(valor) {
  if (!valor) return null;
  const s = String(valor).trim();
  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    const [, d, m, a] = brMatch;
    return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return s.slice(0, 10);
  return null;
}

// Normaliza capitalização de nome próprio (ex.: "tomas" e "Tomas" digitados de formas
// diferentes pelo mesmo CL em visitas distintas não devem virar duas pessoas no ranking).
function normalizarNomePessoa(valor) {
  if (!valor) return null;
  const limpo = String(valor).trim();
  if (!limpo) return null;
  return limpo.toLowerCase().replace(/\p{L}+/gu, (palavra) => palavra[0].toUpperCase() + palavra.slice(1));
}

function paraRespostaPositiva(valor) {
  const norm = normalizar(valor);
  if (["sim", "s", "yes", "y", "true", "1"].includes(norm)) return true;
  if (["nao", "não", "n", "no", "false", "0"].includes(norm)) return false;
  return null;
}

/** Acha o PRIMEIRO índice de coluna cujo nome bate com um dos aliases, opcionalmente só
    entre as colunas "de metadado" (sem categoria/pilar associado). */
function encontrarIndice(colunas, aliases, { somenteSemCategoria = false } = {}) {
  for (const alias of aliases) {
    const aliasNorm = normalizar(alias);
    const achado = colunas.find((c) => (!somenteSemCategoria || !c.categoria) && normalizar(c.campo) === aliasNorm);
    if (achado) return achado.indice;
  }
  return null;
}

/** Localiza a linha de cabeçalho real (a que contém "Status") — a linha imediatamente
    anterior, se houver, é a linha de categoria/pilar. Alguns exports podem vir sem a linha
    de categoria; nesse caso todo indicador cai em pilar "outro". */
function localizarCabecalho(linhas) {
  const limite = Math.min(linhas.length, 5);
  for (let i = 0; i < limite; i++) {
    if (linhas[i].some((c) => normalizar(c) === "status")) return i;
  }
  return 0;
}

/** @param {string} texto conteúdo bruto do CSV
 *  @returns {{ visitas: Array, colunasReconhecidas: object, colunasIndicador: string[] }} */
function mapearLinhasParaVisitas(texto) {
  const { linhas } = tokenizarLinhas(texto);
  if (linhas.length < 2) return { visitas: [], colunasReconhecidas: {}, colunasIndicador: [] };

  const idxCabecalho = localizarCabecalho(linhas);
  const campoRow = linhas[idxCabecalho];
  const categoriaRow = idxCabecalho > 0 ? linhas[idxCabecalho - 1] : [];
  const dataRows = linhas.slice(idxCabecalho + 1);

  const colunas = campoRow.map((campo, indice) => ({ indice, campo, categoria: (categoriaRow[indice] || "").trim() }));

  const idxStatus = encontrarIndice(colunas, ALIAS_STATUS, { somenteSemCategoria: true });
  const idxUnidade = encontrarIndice(colunas, ALIAS_UNIDADE, { somenteSemCategoria: true });
  const idxResultadoGeral = encontrarIndice(colunas, ALIAS_RESULTADO_GERAL, { somenteSemCategoria: true });
  const idxData =
    encontrarIndice(colunas, ALIAS_DATA_VISITA, { somenteSemCategoria: true }) ??
    encontrarIndice(colunas, ALIAS_DATA_ABERTURA, { somenteSemCategoria: true });

  const colunasComPilar = colunas.filter((c) => c.categoria);
  const idxPercentualPorPilar = {};
  for (const c of colunasComPilar) {
    if (ALIAS_PERCENTUAL_AREA.includes(normalizar(c.campo))) {
      idxPercentualPorPilar[inferirPilarDaCategoria(c.categoria)] = c.indice;
    }
  }
  const colunasIndicadorMeta = colunasComPilar.filter((c) => !ALIAS_PERCENTUAL_AREA.includes(normalizar(c.campo)));
  const colIdxCl = colunasIndicadorMeta.find((c) => itemEhClResponsavel(c.campo));

  const linhasValidas = dataRows
    .filter((row) => idxUnidade != null && row[idxUnidade])
    .filter((row) => idxStatus == null || !row[idxStatus] || normalizar(row[idxStatus]) === "concluido");

  // Perguntas "faseadas": o Checklist Fácil só libera uma coluna quando a pergunta anterior
  // (do mesmo pilar) foi respondida "Sim" — ex. "Informe se a Loja possui as duas
  // comunicações, uma ou nenhuma." só vem preenchido quando "A Loja possui a comunicação do
  // Programa Vida Plena e Canal de Ética?" foi Sim. Detecta isso olhando a correlação
  // (toda vez que a coluna está preenchida, a anterior foi Sim) em vez de confiar que a
  // coluna derivada nunca tem valor "Sim"/"Não" por coincidência — a planilha real tem
  // linhas com erro de preenchimento (uma pergunta de texto livre respondida como "Não")
  // que quebrariam essa suposição mais simples. Só conta como derivada se, além disso, a
  // maioria das respostas dela não é Sim/Não (senão é só uma pergunta booleana normal que
  // por coincidência só aparece quando a anterior é Sim, e deve continuar com sua própria
  // barra independente, não virar uma "resposta secundária").
  const indicadorPaiPorIndice = new Map();
  colunasIndicadorMeta.forEach((c, i) => {
    const anterior = colunasIndicadorMeta[i - 1];
    if (!anterior || anterior.categoria !== c.categoria) return;
    const linhasPreenchidas = linhasValidas.filter((row) => row[c.indice] !== "" && row[c.indice] != null);
    if (!linhasPreenchidas.length) return;
    const sempreDependeDeSimNaAnterior = linhasPreenchidas.every((row) => paraRespostaPositiva(row[anterior.indice]) === true);
    if (!sempreDependeDeSimNaAnterior) return;
    const qtdNaoBooleana = linhasPreenchidas.filter((row) => paraRespostaPositiva(row[c.indice]) == null).length;
    if (qtdNaoBooleana / linhasPreenchidas.length < 0.5) return;
    indicadorPaiPorIndice.set(c.indice, anterior.campo);
  });

  const indicadoresRankeados = new Set();

  const visitas = linhasValidas.map((row) => {
    const indicadores = colunasIndicadorMeta
      .map((c) => {
        const valor = row[c.indice];
        if (valor === "" || valor == null) return null;
        const respostaPositiva = paraRespostaPositiva(valor);
        if (respostaPositiva != null) indicadoresRankeados.add(c.campo);
        return {
          pilar: inferirPilarDaCategoria(c.categoria),
          indicador: c.campo,
          respostaTexto: valor,
          respostaPositiva,
          indicadorPai: indicadorPaiPorIndice.get(c.indice) || null
        };
      })
      .filter(Boolean);

    return {
      lojaNome: String(row[idxUnidade]).trim(),
      clNome: colIdxCl ? normalizarNomePessoa(row[colIdxCl.indice]) : null,
      dataVisita: idxData != null ? paraData(row[idxData]) : null,
      resultadoGeralPct: idxResultadoGeral != null ? paraNumero(row[idxResultadoGeral]) : null,
      resultadoAuditoriaFisicaPct: idxPercentualPorPilar.auditoria_fisica != null ? paraNumero(row[idxPercentualPorPilar.auditoria_fisica]) : null,
      resultadoEntrevistaLiderPct: idxPercentualPorPilar.entrevista_lider != null ? paraNumero(row[idxPercentualPorPilar.entrevista_lider]) : null,
      resultadoValidacaoEquipePct: idxPercentualPorPilar.validacao_equipe != null ? paraNumero(row[idxPercentualPorPilar.validacao_equipe]) : null,
      indicadores
    };
  });

  return {
    visitas,
    colunasReconhecidas: {
      loja: idxUnidade != null ? campoRow[idxUnidade] : null,
      cl: colIdxCl ? `Pergunta: ${colIdxCl.campo}` : null,
      data: idxData != null ? campoRow[idxData] : null,
      resultadoGeral: idxResultadoGeral != null ? campoRow[idxResultadoGeral] : null,
      pilaresComPercentual: Object.keys(idxPercentualPorPilar)
    },
    colunasIndicador: [...indicadoresRankeados]
  };
}

module.exports = { mapearLinhasParaVisitas, normalizar, paraNumero, paraData, paraRespostaPositiva };
