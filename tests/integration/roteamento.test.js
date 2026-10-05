"use strict";

require("../testEnv");
const test = require("node:test");
const assert = require("node:assert/strict");
const { setupTestDb } = require("../setupTestDb");

test("motor de roteamento — regras 1 a 3 do briefing de Comunicação Interna", async (t) => {
  await setupTestDb();

  const repos = require("../../src/repositories");
  const { resolverAnalista } = require("../../src/domain/roteamento/motor");

  const rafael = await repos.analista.buscarPorEmail("rafael.campos@empresa.com");
  const daniela = await repos.analista.buscarPorEmail("daniela.giuzio@empresa.com");
  const tiago = await repos.analista.buscarPorEmail("tiago.oliveira@empresa.com");
  const areaTI = await repos.area.buscarPorNome("BU TI");
  const areaJuridico = await repos.area.buscarPorNome("BU Jurídico");
  const areaOutras = await repos.area.buscarPorNome("Outras");
  const tipoEventos = await repos.tipoSolicitacao.buscarPorNome("Eventos");
  const tipoComunicado = await repos.tipoSolicitacao.buscarPorNome("Comunicado");

  await t.test("Operação-Lojas/CD vai direto pro Rafael, sem precisar de área", async () => {
    const r = await resolverAnalista({ publico: "Operacao-Lojas", areaId: null, tipoSolicitacaoId: tipoComunicado.id });
    assert.equal(r.analistaPrincipalId, rafael.id);
  });

  await t.test("Eventos em Lojas/CD também vai pro Rafael (reforço da regra de público)", async () => {
    const r = await resolverAnalista({ publico: "Operacao-CD", areaId: null, tipoSolicitacaoId: tipoEventos.id });
    assert.equal(r.analistaPrincipalId, rafael.id);
  });

  await t.test("Holding + BU TI vai pro Tiago", async () => {
    const r = await resolverAnalista({ publico: "Holding", areaId: areaTI.id, tipoSolicitacaoId: tipoComunicado.id });
    assert.equal(r.analistaPrincipalId, tiago.id);
  });

  await t.test("Todos + BU Jurídico vai pra Daniela (Todos usa a mesma matriz de área que Holding)", async () => {
    const r = await resolverAnalista({ publico: "Todos", areaId: areaJuridico.id, tipoSolicitacaoId: tipoComunicado.id });
    assert.equal(r.analistaPrincipalId, daniela.id);
  });

  await t.test("Eventos corporativos (Holding): Tiago principal + Daniela secundária", async () => {
    const r = await resolverAnalista({ publico: "Holding", areaId: null, tipoSolicitacaoId: tipoEventos.id });
    assert.equal(r.analistaPrincipalId, tiago.id);
    assert.equal(r.analistaSecundarioId, daniela.id);
    assert.equal(r.responsavelSla, "PRINCIPAL");
  });

  await t.test("Área Outras não tem regra — cai na fila 'a triar' do coordenador", async () => {
    const r = await resolverAnalista({ publico: "Holding", areaId: areaOutras.id, tipoSolicitacaoId: tipoComunicado.id });
    assert.equal(r.analistaPrincipalId, null);
  });
});
