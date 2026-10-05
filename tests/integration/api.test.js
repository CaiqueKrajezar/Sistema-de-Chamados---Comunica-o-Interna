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

async function call(method, path, body, cookie) {
  const opts = { method, headers: {} };
  if (cookie) opts.headers.cookie = cookie;
  if (body !== undefined) {
    opts.headers["content-type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(baseUrl + path, opts);
  const text = await resp.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: resp.status, data, resp };
}

test("API HTTP — fluxo completo de chamados, auth e SLA", async (t) => {
  await setupTestDb();
  const app = require("../../src/app");
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const tipos = (await call("GET", "/api/tipos-solicitacao")).data;
  const areas = (await call("GET", "/api/areas")).data;
  const tipoComunicado = tipos.find((x) => x.nome === "Comunicado");
  const tipoEventos = tipos.find((x) => x.nome === "Eventos");
  const areaTI = areas.find((x) => x.nome === "BU TI");
  const areaOutras = areas.find((x) => x.nome === "Outras");

  await t.test("roteia Holding + BU TI para o Tiago", async () => {
    const r = await call("POST", "/api/chamados", {
      publico: "Holding",
      areaId: areaTI.id,
      tipoSolicitacaoId: tipoComunicado.id,
      descricao: "Teste de integração.",
      cienciaSla: true
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.analistaPrincipal.nome, "Tiago Oliveira");
  });

  await t.test("upload de anexo só aceita extensão permitida", async () => {
    const create = await call("POST", "/api/chamados", {
      publico: "Operacao-Lojas",
      tipoSolicitacaoId: tipoComunicado.id,
      descricao: "Teste anexo.",
      cienciaSla: true
    });
    const fd = new FormData();
    fd.append("arquivos", new Blob(["x"], { type: "text/plain" }), "arquivo.txt");
    const rejeitado = await fetch(`${baseUrl}/api/chamados/${create.data.id}/anexos`, { method: "POST", body: fd });
    assert.equal(rejeitado.status, 400);

    const fd2 = new FormData();
    fd2.append("arquivos", new Blob(["x"], { type: "application/pdf" }), "arquivo.pdf");
    const aceito = await fetch(`${baseUrl}/api/chamados/${create.data.id}/anexos`, { method: "POST", body: fd2 });
    assert.equal(aceito.status, 201);
  });

  await t.test("evento corporativo notifica principal + secundário", async () => {
    const r = await call("POST", "/api/chamados", {
      publico: "Holding",
      areaId: areaTI.id,
      tipoSolicitacaoId: tipoEventos.id,
      cienciaSla: true,
      eventoDetalhe: { nomeEvento: "Convenção", responsavelNome: "Fulano", responsavelEmail: "fulano@empresa.com" }
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.analistaPrincipal.nome, "Tiago Oliveira");
    assert.equal(r.data.analistaSecundario.nome, "Daniela Giuzio");
    assert.equal(r.data.notificacoesEnviadas, 2);
  });

  await t.test("área sem regra nasce sem dono (fila a triar)", async () => {
    const r = await call("POST", "/api/chamados", {
      publico: "Holding",
      areaId: areaOutras.id,
      tipoSolicitacaoId: tipoComunicado.id,
      descricao: "Sem regra.",
      cienciaSla: true
    });
    assert.equal(r.data.analistaPrincipal, null);
  });

  await t.test("segundo aprovador atrasa o início do SLA até a aprovação", async () => {
    const create = await call("POST", "/api/chamados", {
      publico: "Operacao-Lojas",
      tipoSolicitacaoId: tipoComunicado.id,
      descricao: "Com aprovador.",
      segundoAprovadorEmail: "chefe@empresa.com",
      cienciaSla: true
    });
    assert.equal(create.data.status, "aguardando_aprovacao");

    const analistas = (await call("GET", "/auth/dev/analistas")).data;
    const tiago = analistas.find((a) => a.nome === "Tiago Oliveira");
    const login = await call("POST", "/auth/dev/login", { analistaId: tiago.id });
    const cookie = getCookie(login.resp);

    const aprovado = await call("POST", `/api/chamados/${create.data.id}/aprovar`, {}, cookie);
    assert.equal(aprovado.status, 200);
    assert.equal(aprovado.data.status, "novo");
    assert.ok(aprovado.data.dataPrazo);
  });

  await t.test("chamado sem ciência de SLA é rejeitado", async () => {
    const r = await call("POST", "/api/chamados", {
      publico: "Operacao-Lojas",
      tipoSolicitacaoId: tipoComunicado.id,
      descricao: "x",
      cienciaSla: false
    });
    assert.equal(r.status, 400);
  });

  await t.test("limite de revisão de conteúdo (2) é aplicado", async () => {
    const analistas = (await call("GET", "/auth/dev/analistas")).data;
    const tiago = analistas.find((a) => a.nome === "Tiago Oliveira");
    const login = await call("POST", "/auth/dev/login", { analistaId: tiago.id });
    const cookie = getCookie(login.resp);

    const create = await call("POST", "/api/chamados", {
      publico: "Operacao-Lojas",
      tipoSolicitacaoId: tipoComunicado.id,
      descricao: "Revisões.",
      cienciaSla: true
    });
    const id = create.data.id;
    const r1 = await call("POST", `/api/chamados/${id}/revisoes`, { tipoRevisao: "conteudo" }, cookie);
    const r2 = await call("POST", `/api/chamados/${id}/revisoes`, { tipoRevisao: "conteudo" }, cookie);
    const r3 = await call("POST", `/api/chamados/${id}/revisoes`, { tipoRevisao: "conteudo" }, cookie);
    assert.equal(r1.status, 201);
    assert.equal(r2.status, 201);
    assert.equal(r3.status, 409);
  });

  await t.test("reatribuição e dashboard são restritos a coordenador", async () => {
    const analistas = (await call("GET", "/auth/dev/analistas")).data;
    const tiago = analistas.find((a) => a.nome === "Tiago Oliveira");
    const coordenador = analistas.find((a) => a.papel === "coordenador");

    const loginAnalista = await call("POST", "/auth/dev/login", { analistaId: tiago.id });
    const cookieAnalista = getCookie(loginAnalista.resp);
    const loginCoordenador = await call("POST", "/auth/dev/login", { analistaId: coordenador.id });
    const cookieCoordenador = getCookie(loginCoordenador.resp);

    const create = await call("POST", "/api/chamados", {
      publico: "Operacao-Lojas",
      tipoSolicitacaoId: tipoComunicado.id,
      descricao: "Reatribuir.",
      cienciaSla: true
    });

    const negado = await call("PATCH", `/api/chamados/${create.data.id}/reatribuir`, { analistaPrincipalId: tiago.id }, cookieAnalista);
    assert.equal(negado.status, 403);
    const ok = await call("PATCH", `/api/chamados/${create.data.id}/reatribuir`, { analistaPrincipalId: tiago.id }, cookieCoordenador);
    assert.equal(ok.status, 200);

    const dashNegado = await call("GET", "/api/dashboard", undefined, cookieAnalista);
    assert.equal(dashNegado.status, 403);
    const dashOk = await call("GET", "/api/dashboard", undefined, cookieCoordenador);
    assert.equal(dashOk.status, 200);
    assert.ok(dashOk.data.geral.total >= 1);
  });

  await t.test("edição da matriz de roteamento é restrita a coordenador", async () => {
    const analistas = (await call("GET", "/auth/dev/analistas")).data;
    const tiago = analistas.find((a) => a.nome === "Tiago Oliveira");
    const coordenador = analistas.find((a) => a.papel === "coordenador");
    const cookieAnalista = getCookie((await call("POST", "/auth/dev/login", { analistaId: tiago.id })).resp);
    const cookieCoordenador = getCookie((await call("POST", "/auth/dev/login", { analistaId: coordenador.id })).resp);

    const negado = await call("POST", "/api/regras-roteamento", { publicos: ["Todos"], analistaPrincipalId: tiago.id, prioridade: 5 }, cookieAnalista);
    assert.equal(negado.status, 403);

    const criado = await call("POST", "/api/regras-roteamento", { publicos: ["Todos"], analistaPrincipalId: tiago.id, prioridade: 5 }, cookieCoordenador);
    assert.equal(criado.status, 201);
    const desativado = await call("DELETE", `/api/regras-roteamento/${criado.data.id}`, undefined, cookieCoordenador);
    assert.equal(desativado.status, 200);
    assert.equal(desativado.data.ativo, false);
  });

  server.close();
});
