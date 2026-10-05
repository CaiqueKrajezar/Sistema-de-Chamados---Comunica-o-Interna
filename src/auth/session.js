"use strict";

const { SignJWT, jwtVerify } = require("jose");
const { env } = require("../config/env");

const secretKey = new TextEncoder().encode(env.APP_SESSION_SECRET);

/**
 * Zé, essa é a peça que faz o dev mode e o Keycloak conviverem sem duplicar lógica em
 * lugar nenhum: tanto faz se o login veio da telinha de dev (escolhe um analista da
 * lista) ou do fluxo OIDC de verdade — no final das contas os dois chamam
 * `criarCookieSessao` com o mesmo formato de payload, e a aplicação inteira (middleware,
 * rotas, frontend) só enxerga esse cookie. Nunca expus o token do Keycloak pro
 * navegador — o front não sabe que o Keycloak existe, só conversa com esse cookie
 * próprio, assinado com APP_SESSION_SECRET (JWT via `jose`).
 * payload: { analistaId, nome, email, papel, acessoDashboardOperacoes }
 */
async function criarCookieSessao(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${env.APP_SESSION_TTL_HOURS}h`)
    .sign(secretKey);
}

async function verificarCookieSessao(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch {
    return null;
  }
}

function definirCookie(res, token) {
  res.cookie(env.APP_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    maxAge: env.APP_SESSION_TTL_HOURS * 3600 * 1000
  });
}

function limparCookie(res) {
  res.clearCookie(env.APP_SESSION_COOKIE_NAME);
}

module.exports = { criarCookieSessao, verificarCookieSessao, definirCookie, limparCookie };
