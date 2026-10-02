"use strict";

const { SignJWT, jwtVerify } = require("jose");
const { env } = require("../config/env");

const secretKey = new TextEncoder().encode(env.APP_SESSION_SECRET);

/**
 * Formato único de sessão, igual em AUTH_MODE=dev e AUTH_MODE=keycloak — quem consome
 * (requireAuth/requireRole) nunca sabe qual modo gerou o cookie.
 * payload: { analistaId, nome, email, papel }
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
