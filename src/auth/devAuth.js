"use strict";

const repos = require("../repositories");

/** Lista os analistas semeados pra tela de login simular a escolha de usuário — só existe em AUTH_MODE=dev. */
async function listarParaEscolha() {
  const analistas = await repos.analista.listarAtivos();
  return analistas.map((a) => ({ id: a.id, nome: a.nome, papel: a.papel, cor: a.cor }));
}

async function autenticar(analistaId) {
  const analista = await repos.analista.buscarPorId(analistaId);
  if (!analista || !analista.ativo) return null;
  return {
    analistaId: analista.id,
    nome: analista.nome,
    email: analista.email,
    papel: analista.papel,
    cor: analista.cor,
    acessoDashboardOperacoes: analista.acessoDashboardOperacoes
  };
}

module.exports = { listarParaEscolha, autenticar };
