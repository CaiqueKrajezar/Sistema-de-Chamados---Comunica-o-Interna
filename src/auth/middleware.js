"use strict";

const { verificarCookieSessao } = require("./session");
const { env } = require("../config/env");

/** Roda em toda request: se houver cookie de sessão válido, popula req.sessao (senão, null). */
async function carregarSessao(req, res, next) {
  const token = req.cookies?.[env.APP_SESSION_COOKIE_NAME];
  req.sessao = token ? await verificarCookieSessao(token) : null;
  next();
}

/** Para rotas de API: exige sessão, senão 401 JSON. */
function requireAuth(req, res, next) {
  if (!req.sessao) return res.status(401).json({ erro: "Não autenticado." });
  next();
}

/** Para rotas de API: exige sessão com um dos papéis informados, senão 401/403 JSON. */
function requireRole(...papeis) {
  return (req, res, next) => {
    if (!req.sessao) return res.status(401).json({ erro: "Não autenticado." });
    if (!papeis.includes(req.sessao.papel)) return res.status(403).json({ erro: "Sem permissão para esta ação." });
    next();
  };
}

/** Para páginas HTML estáticas (/analista/*): sem sessão, manda pro login em vez de 401. */
function requirePagina(req, res, next) {
  if (!req.sessao) return res.redirect("/analista/login.html");
  next();
}

/**
 * Dashboard de Visitas em Loja: liberado pra quem tem a flag `acessoDashboardOperacoes`
 * (hoje só o Rafael, setado no seed) ou pra qualquer coordenador.
 */
function requireAcessoOperacoes(req, res, next) {
  if (!req.sessao) return res.status(401).json({ erro: "Não autenticado." });
  if (!req.sessao.acessoDashboardOperacoes && req.sessao.papel !== "coordenador") {
    return res.status(403).json({ erro: "Sem permissão para o dashboard de operações." });
  }
  next();
}

module.exports = { carregarSessao, requireAuth, requireRole, requirePagina, requireAcessoOperacoes };
