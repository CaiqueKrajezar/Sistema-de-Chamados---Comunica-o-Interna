"use strict";

require("../testEnv");
const test = require("node:test");
const assert = require("node:assert/strict");
const { setupTestDb } = require("../setupTestDb");

let baseUrl;
let server;

function getCookie(resp) {
  return (resp.headers.get("set-cookie") || "").split(";")[0];
}

async function call(method, path, opts = {}) {
  const resp = await fetch(baseUrl + path, { method, ...opts });
  const text = await resp.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: resp.status, data, resp };
}

// Formato real do export "Visita Estruturada" do Checklist Fácil: uma linha por VISITA,
// com duas linhas de cabeçalho — a 1ª marca o pilar (categoria), a 2ª o nome da pergunta
// (ver src/domain/visitasLoja/importador.js).
const CSV_EXEMPLO = [
  '"";"";"";"Auditoria física";"Auditoria física";"Auditoria física";"Validação com a equipe da Loja";"Validação com a equipe da Loja"',
  '"Status";"Unidade";"Resultado";"Percentual da área";"Cascata atualizada exposta";"Canal de ética exposto";"Percentual da área";"Qual é o CL responsável pela Loja?"',
  '"Concluído";"Miro Vetaraso";"76,92";"50,00%";"Sim";"Não";"100,00%";"Luiz"',
  '"Concluído";"Centro SP";"90";"100,00%";"Sim";"Sim";"100,00%";"Ana"',
  '"Concluído";"Sul";"60";"0,00%";"Não";"Não";"100,00%";"Luiz"'
].join("\n");

test("Dashboard de Visitas em Loja — upload, métricas e permissão restrita ao Rafael/coordenador", async (t) => {
  await setupTestDb();
  const app = require("../../src/app");
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const analistas = (await call("GET", "/auth/dev/analistas")).data;
  const rafael = analistas.find((a) => a.nome === "Rafael Campos");
  const tiago = analistas.find((a) => a.nome === "Tiago Oliveira");
  const coordenador = analistas.find((a) => a.papel === "coordenador");

  await t.test("Tiago (sem a permissão) recebe 403 em qualquer rota de visitas-loja", async () => {
    const login = await call("POST", "/auth/dev/login", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ analistaId: tiago.id })
    });
    const cookie = getCookie(login.resp);
    const r = await call("GET", "/api/visitas-loja/metricas", { headers: { cookie } });
    assert.equal(r.status, 403);
  });

  let cookieRafael;
  await t.test("Rafael (com a permissão do seed) consegue importar o CSV", async () => {
    const login = await call("POST", "/auth/dev/login", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ analistaId: rafael.id })
    });
    cookieRafael = getCookie(login.resp);

    const fd = new FormData();
    fd.append("arquivo", new Blob([CSV_EXEMPLO], { type: "text/csv" }), "visitas.csv");
    const r = await call("POST", "/api/visitas-loja/importar", { headers: { cookie: cookieRafael }, body: fd });
    assert.equal(r.status, 201);
    assert.equal(r.data.totalVisitasImportadas, 3);
    assert.equal(r.data.colunasReconhecidas.loja, "Unidade");
    assert.equal(r.data.colunasReconhecidas.cl, "Pergunta: Qual é o CL responsável pela Loja?");
  });

  await t.test("métricas batem com o CSV importado", async () => {
    const r = await call("GET", "/api/visitas-loja/metricas", { headers: { cookie: cookieRafael } });
    assert.equal(r.status, 200);
    assert.equal(r.data.totalVisitas, 3);
    assert.equal(r.data.lojasVisitadas, 3);
    assert.ok(Math.abs(r.data.mediaGeral - (76.92 + 90 + 60) / 3) < 0.01);
    assert.equal(r.data.rankingCls[0].cl, "Luiz");
    assert.equal(r.data.rankingCls[0].totalVisitas, 2);
  });

  await t.test("filtro por CL funciona", async () => {
    const r = await call("GET", "/api/visitas-loja/metricas?cl=Ana", { headers: { cookie: cookieRafael } });
    assert.equal(r.data.totalVisitas, 1);
    assert.equal(r.data.lojasVisitadas, 1);
  });

  await t.test("nova importação SUBSTITUI o dataset anterior por completo", async () => {
    const csvMenor = [
      '"";"";""',
      '"Status";"Unidade";"Resultado"',
      '"Concluído";"Só uma loja";"50"'
    ].join("\n");
    const fd = new FormData();
    fd.append("arquivo", new Blob([csvMenor], { type: "text/csv" }), "visitas2.csv");
    await call("POST", "/api/visitas-loja/importar", { headers: { cookie: cookieRafael }, body: fd });

    const r = await call("GET", "/api/visitas-loja/metricas", { headers: { cookie: cookieRafael } });
    assert.equal(r.data.totalVisitas, 1);
    assert.equal(r.data.mediaGeral, 50);
  });

  await t.test("coordenador também tem acesso (via papel), mesmo sem a flag específica", async () => {
    const login = await call("POST", "/auth/dev/login", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ analistaId: coordenador.id })
    });
    const cookieSup = getCookie(login.resp);
    const r = await call("GET", "/api/visitas-loja/metricas", { headers: { cookie: cookieSup } });
    assert.equal(r.status, 200); // vê o próprio dataset (vazio, já que quem importou foi o Rafael)
    assert.equal(r.data.totalVisitas, 0);
  });

  await t.test("upload de extensão errada é rejeitado", async () => {
    const fd = new FormData();
    fd.append("arquivo", new Blob(["x"], { type: "text/plain" }), "visitas.txt");
    const r = await call("POST", "/api/visitas-loja/importar", { headers: { cookie: cookieRafael }, body: fd });
    assert.equal(r.status, 400);
  });

  server.close();
});
