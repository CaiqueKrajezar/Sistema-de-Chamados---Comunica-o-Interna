"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mapearLinhasParaVisitas, paraNumero, paraData, paraRespostaPositiva } = require("../../src/domain/visitasLoja/importador");
const { calcularMetricas } = require("../../src/domain/visitasLoja/metricas");

test("paraNumero interpreta vírgula decimal e percentual", () => {
  assert.equal(paraNumero("76,92"), 76.92);
  assert.equal(paraNumero("80%"), 80);
  assert.equal(paraNumero("80.5"), 80.5);
  assert.equal(paraNumero("61.54"), 61.54);
  assert.equal(paraNumero(""), null);
  assert.equal(paraNumero(null), null);
});

test("paraData interpreta dd/mm/aaaa e ISO", () => {
  assert.equal(paraData("23/09/2026"), "2026-09-23");
  assert.equal(paraData("2026-09-23"), "2026-09-23");
  assert.equal(paraData(""), null);
});

test("paraRespostaPositiva reconhece variações de sim/não", () => {
  assert.equal(paraRespostaPositiva("Sim"), true);
  assert.equal(paraRespostaPositiva("s"), true);
  assert.equal(paraRespostaPositiva("Não"), false);
  assert.equal(paraRespostaPositiva("n"), false);
  assert.equal(paraRespostaPositiva("texto livre qualquer"), null);
});

// Formato real do export "Visita Estruturada" do Checklist Fácil: uma linha por VISITA,
// com DUAS linhas de cabeçalho — a 1ª só marca o pilar (categoria) acima do bloco de
// colunas daquele pilar, a 2ª tem o nome de cada pergunta. "Percentual da área" se repete
// uma vez por pilar. Amostra reduzida do arquivo real recebido do Rafael em 01/10/2026.
const CSV_REAL_EXEMPLO = [
  '"";"";"";"Auditoria física";"Auditoria física";"Entrevista com o Líder";"Entrevista com o Líder";"Validação com a equipe da Loja";"Validação com a equipe da Loja"',
  '"Status";"Unidade";"Resultado";"Percentual da área";"A Cascata está atualizada?";"Percentual da área";"O Líder possui acesso ao Conecta?";"Percentual da área";"Qual é o CL responsável pela Loja?"',
  '"Concluído";"Loja A | Mercado M";"76.92";"50,00%";"Sim";"100,00%";"Sim";"100,00%";"Luiz"',
  '"Concluído";"Loja B | Mercado P";"90";"100,00%";"Sim";"0,00%";"Não";"100,00%";"Ana"',
  '"Cancelado";"Loja C | Mercado G";"50";"0,00%";"Não";"";"";"";"Fernando"'
].join("\n");

test("mapearLinhasParaVisitas lê as duas linhas de cabeçalho e usa uma linha por visita", () => {
  const { visitas, colunasReconhecidas, colunasIndicador } = mapearLinhasParaVisitas(CSV_REAL_EXEMPLO);

  assert.equal(colunasReconhecidas.loja, "Unidade");
  assert.equal(colunasReconhecidas.cl, "Pergunta: Qual é o CL responsável pela Loja?");
  assert.equal(colunasReconhecidas.resultadoGeral, "Resultado");
  assert.deepEqual(colunasReconhecidas.pilaresComPercentual.sort(), ["auditoria_fisica", "entrevista_lider", "validacao_equipe"].sort());
  assert.deepEqual(colunasIndicador, ["A Cascata está atualizada?", "O Líder possui acesso ao Conecta?"]);

  // a loja C está com status "Cancelado" — não entra como visita
  assert.equal(visitas.length, 2);

  const lojaA = visitas.find((v) => v.lojaNome === "Loja A | Mercado M");
  assert.equal(lojaA.clNome, "Luiz");
  assert.equal(lojaA.resultadoGeralPct, 76.92);
  assert.equal(lojaA.resultadoAuditoriaFisicaPct, 50);
  assert.equal(lojaA.resultadoEntrevistaLiderPct, 100);
  assert.equal(lojaA.resultadoValidacaoEquipePct, 100);

  const cascata = lojaA.indicadores.find((i) => i.indicador === "A Cascata está atualizada?");
  assert.equal(cascata.respostaPositiva, true);
  assert.equal(cascata.pilar, "auditoria_fisica");

  // a pergunta do CL não é Sim/Não — não entra no ranking de indicadores
  const itemCl = lojaA.indicadores.find((i) => i.indicador.includes("CL responsável"));
  assert.equal(itemCl.respostaPositiva, null);
});

// "Pergunta faseada": uma coluna de texto livre que NUNCA tem resposta Sim/Não, logo após
// uma coluna Sim/Não no mesmo pilar, é marcada como derivada (`indicadorPai`) daquela.
const CSV_PERGUNTA_FASEADA = [
  '"";"";"Auditoria física";"Auditoria física"',
  '"Status";"Unidade";"A Loja possui a comunicação do Programa Vida Plena e Canal de Ética?";"Informe se a Loja possui as duas comunicações, uma ou nenhuma."',
  '"Concluído";"Loja A";"Sim";"As duas comunicações"',
  '"Concluído";"Loja B";"Sim";"Somente Programa Vida Plena"',
  '"Concluído";"Loja C";"Não";""'
].join("\n");

test("mapearLinhasParaVisitas marca pergunta derivada (indicadorPai) quando a coluna seguinte nunca é Sim/Não", () => {
  const { visitas } = mapearLinhasParaVisitas(CSV_PERGUNTA_FASEADA);
  const lojaA = visitas.find((v) => v.lojaNome === "Loja A");
  const pai = lojaA.indicadores.find((i) => i.indicador.startsWith("A Loja possui a comunicação"));
  const filha = lojaA.indicadores.find((i) => i.indicador.startsWith("Informe se"));
  assert.equal(pai.indicadorPai, null);
  assert.equal(pai.respostaPositiva, true);
  assert.equal(filha.indicadorPai, pai.indicador);
  assert.equal(filha.respostaPositiva, null);
  assert.equal(filha.respostaTexto, "As duas comunicações");
});

test("mapearLinhasParaVisitas ignora linha sem loja identificada", () => {
  const csv = [
    '"";"";"Auditoria física"',
    '"Status";"Unidade";"Pergunta"',
    '"Concluído";"";"Sim"',
    '"Concluído";"Centro";"Sim"'
  ].join("\n");
  const { visitas } = mapearLinhasParaVisitas(csv);
  assert.equal(visitas.length, 1);
  assert.equal(visitas[0].lojaNome, "Centro");
});

test("calcularMetricas agrega médias, ranking de CLs/lojas e top positivos/ofensores", () => {
  const visitas = [
    { lojaNome: "A", clNome: "Luiz", resultadoGeralPct: 80, resultadoAuditoriaFisicaPct: 70, resultadoEntrevistaLiderPct: 90, resultadoValidacaoEquipePct: 85 },
    { lojaNome: "B", clNome: "Luiz", resultadoGeralPct: 60, resultadoAuditoriaFisicaPct: 50, resultadoEntrevistaLiderPct: 70, resultadoValidacaoEquipePct: 65 },
    { lojaNome: "C", clNome: "Ana", resultadoGeralPct: 100, resultadoAuditoriaFisicaPct: 100, resultadoEntrevistaLiderPct: 100, resultadoValidacaoEquipePct: 100 }
  ];
  const indicadores = [
    { indicador: "Cascata", pilar: "auditoria_fisica", respostaPositiva: true, lojaNome: "A" },
    { indicador: "Cascata", pilar: "auditoria_fisica", respostaPositiva: true, lojaNome: "B" },
    { indicador: "Cascata", pilar: "auditoria_fisica", respostaPositiva: false, lojaNome: "C" },
    { indicador: "UAU", pilar: "auditoria_fisica", respostaPositiva: false, lojaNome: "A" },
    { indicador: "UAU", pilar: "auditoria_fisica", respostaPositiva: false, lojaNome: "B" }
  ];

  const m = calcularMetricas(visitas, indicadores);
  assert.equal(m.totalVisitas, 3);
  assert.equal(m.lojasVisitadas, 3);
  assert.equal(m.clsAvaliados, 2);
  assert.equal(Math.round(m.mediaGeral * 100) / 100, 80);

  assert.equal(m.rankingCls[0].cl, "Luiz");
  assert.equal(m.rankingCls[0].totalVisitas, 2);
  assert.equal(m.rankingCls[0].mediaGeralPct, 70);
  assert.deepEqual(m.clsComMaisVisitas, ["Luiz"]);

  assert.equal(m.melhorLoja.loja, "C");
  assert.equal(m.piorLoja.loja, "B");

  assert.equal(m.topPositivos[0].indicador, "Cascata");
  assert.equal(m.topPositivos[0].pct, 67);
  assert.deepEqual(m.topPositivos[0].lojasSim.sort(), ["A", "B"]);
  assert.equal(m.topOfensores[0].indicador, "UAU");
  assert.equal(m.topOfensores[0].pct, 0);
  assert.deepEqual(m.topOfensores[0].lojasNao.sort(), ["A", "B"]);

  assert.equal(m.perguntasPorPilar.auditoria_fisica.length, 2);
  assert.equal(m.distribuicaoSimNao.sim, 2);
  assert.equal(m.distribuicaoSimNao.nao, 3);
  assert.ok(m.focoPrincipal.includes("UAU"));
});

test("calcularMetricas anexa a quebra de respostas da pergunta derivada na pergunta-mãe", () => {
  const visitas = [
    { lojaNome: "A", clNome: "Luiz", resultadoGeralPct: 80 },
    { lojaNome: "B", clNome: "Luiz", resultadoGeralPct: 60 },
    { lojaNome: "C", clNome: "Ana", resultadoGeralPct: 100 }
  ];
  const indicadores = [
    { indicador: "Vida Plena/Ética", pilar: "auditoria_fisica", respostaPositiva: true, lojaNome: "A" },
    { indicador: "Vida Plena/Ética", pilar: "auditoria_fisica", respostaPositiva: true, lojaNome: "B" },
    { indicador: "Vida Plena/Ética", pilar: "auditoria_fisica", respostaPositiva: false, lojaNome: "C" },
    { indicador: "Informe quais", pilar: "auditoria_fisica", respostaPositiva: null, respostaTexto: "As duas comunicações", lojaNome: "A", indicadorPai: "Vida Plena/Ética" },
    { indicador: "Informe quais", pilar: "auditoria_fisica", respostaPositiva: null, respostaTexto: "Somente Programa Vida Plena", lojaNome: "B", indicadorPai: "Vida Plena/Ética" }
  ];

  const m = calcularMetricas(visitas, indicadores);
  const pai = m.perguntasPorPilar.auditoria_fisica.find((p) => p.indicador === "Vida Plena/Ética");
  assert.ok(pai.respostasSecundarias);
  assert.equal(pai.respostasSecundarias.length, 2);
  const duas = pai.respostasSecundarias.find((r) => r.resposta === "As duas comunicações");
  assert.equal(duas.total, 1);
  assert.equal(duas.pct, 50);
  assert.deepEqual(duas.lojas, ["A"]);
});
