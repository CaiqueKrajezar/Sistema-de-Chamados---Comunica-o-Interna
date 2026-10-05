"use strict";

/*
 * Zé, deixa eu ser bem direto sobre esse arquivo: isso NÃO é autenticação de verdade.
 * Não checa senha nenhuma, é literalmente "escolhe um analista da lista e pronto". Só
 * existe pra eu conseguir testar o sistema inteiro (painel, dashboard, permissão de
 * coordenador etc.) sem ter acesso ao Keycloak. Só fica disponível quando AUTH_MODE=dev
 * no .env — em produção vocês vão deixar AUTH_MODE=keycloak e esse caminho nem fica
 * acessível (as rotas /auth/dev/* voltam 404, olha auth.routes.js). De qualquer forma,
 * bom garantir que ninguém sobe isso em produção com AUTH_MODE=dev por engano.
 */

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
