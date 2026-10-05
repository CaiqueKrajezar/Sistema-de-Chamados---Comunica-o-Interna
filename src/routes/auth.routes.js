"use strict";

const express = require("express");
const { env } = require("../config/env");
const logger = require("../config/logger");
const { criarCookieSessao, definirCookie, limparCookie } = require("../auth/session");
const devAuth = require("../auth/devAuth");

const router = express.Router();

const OIDC_STATE_COOKIE = "ci_oidc_state";

router.get("/session", (req, res) => {
  if (!req.sessao) return res.json({ autenticado: false, authMode: env.AUTH_MODE });
  const { analistaId, nome, email, papel, cor, acessoDashboardOperacoes } = req.sessao;
  res.json({ autenticado: true, authMode: env.AUTH_MODE, analistaId, nome, email, papel, cor, acessoDashboardOperacoes: !!acessoDashboardOperacoes });
});

// --- Modo dev: lista os analistas semeados e loga como qualquer um deles, sem Keycloak ---
router.get("/dev/analistas", async (req, res, next) => {
  if (env.AUTH_MODE !== "dev") return res.status(404).json({ erro: "AUTH_MODE não é dev." });
  try {
    res.json(await devAuth.listarParaEscolha());
  } catch (err) {
    next(err);
  }
});

router.post("/dev/login", express.json(), async (req, res, next) => {
  if (env.AUTH_MODE !== "dev") return res.status(404).json({ erro: "AUTH_MODE não é dev." });
  try {
    const sessao = await devAuth.autenticar(req.body?.analistaId);
    if (!sessao) return res.status(401).json({ erro: "Analista não encontrado ou inativo." });
    const token = await criarCookieSessao(sessao);
    definirCookie(res, token);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Modo keycloak: fluxo OpenID Connect real ---
router.get("/login", async (req, res, next) => {
  if (env.AUTH_MODE !== "keycloak") return res.redirect("/analista/login.html");
  try {
    const keycloak = require("../auth/keycloak");
    const { codeVerifier, codeChallenge, state } = keycloak.gerarPkce();
    res.cookie(OIDC_STATE_COOKIE, JSON.stringify({ codeVerifier, state }), {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      maxAge: 10 * 60 * 1000
    });
    const url = await keycloak.getAuthorizationUrl({ codeChallenge, state });
    res.redirect(url);
  } catch (err) {
    next(err);
  }
});

router.get("/callback", async (req, res, next) => {
  if (env.AUTH_MODE !== "keycloak") return res.status(404).send("AUTH_MODE não é keycloak.");
  try {
    const raw = req.cookies?.[OIDC_STATE_COOKIE];
    if (!raw) return res.status(400).send("Sessão de login expirada, tente novamente.");
    const { codeVerifier, state } = JSON.parse(raw);
    res.clearCookie(OIDC_STATE_COOKIE);

    const keycloak = require("../auth/keycloak");
    const { claims } = await keycloak.handleCallback(req, { codeVerifier, state });
    const roles = keycloak.extrairRoles(claims);
    const papel = keycloak.resolverPapel(roles);
    if (!papel) {
      return res.status(403).send("Seu usuário não tem a role 'analista' nem 'coordenador' configurada no Keycloak.");
    }

    const repos = require("../repositories");
    let analista = await repos.analista.buscarPorKeycloakSubject(claims.sub);
    if (!analista) analista = await repos.analista.buscarPorEmail(claims.email);

    if (!analista) {
      if (!env.AUTH_JIT_PROVISION) {
        return res.status(403).send("Usuário autenticado no Keycloak, mas ainda não cadastrado como analista neste sistema.");
      }
      analista = await repos.analista.criar({
        nome: claims.name || claims.email,
        email: claims.email,
        keycloakSubject: claims.sub,
        papel
      });
      logger.info(`Analista provisionado via Keycloak (JIT): ${analista.email}`);
    } else if (!analista.keycloakSubject) {
      analista = await repos.analista.atualizarKeycloakSubject(analista.id, claims.sub);
    }

    const token = await criarCookieSessao({
      analistaId: analista.id,
      nome: analista.nome,
      email: analista.email,
      papel: analista.papel,
      cor: analista.cor,
      acessoDashboardOperacoes: analista.acessoDashboardOperacoes
    });
    definirCookie(res, token);
    res.redirect("/analista/painel.html");
  } catch (err) {
    next(err);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    limparCookie(res);
    res.json({ ok: true, redirect: env.AUTH_MODE === "keycloak" ? env.KEYCLOAK_POST_LOGOUT_REDIRECT_URI : "/analista/login.html" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
