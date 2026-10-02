"use strict";

const { env } = require("../config/env");

let clientPromise = null;

function loadOpenidClient() {
  // eslint-disable-next-line global-require
  return require("openid-client");
}

async function getClient() {
  if (clientPromise) return clientPromise;
  const { Issuer } = loadOpenidClient();
  clientPromise = (async () => {
    const issuer = await Issuer.discover(`${env.KEYCLOAK_BASE_URL}/realms/${env.KEYCLOAK_REALM}`);
    return new issuer.Client({
      client_id: env.KEYCLOAK_CLIENT_ID,
      client_secret: env.KEYCLOAK_CLIENT_SECRET,
      redirect_uris: [env.KEYCLOAK_REDIRECT_URI],
      response_types: ["code"]
    });
  })();
  return clientPromise;
}

function gerarPkce() {
  const { generators } = loadOpenidClient();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);
  const state = generators.state();
  return { codeVerifier, codeChallenge, state };
}

async function getAuthorizationUrl({ codeChallenge, state }) {
  const client = await getClient();
  return client.authorizationUrl({
    scope: "openid profile email",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state
  });
}

/** @returns {{ claims: object }} claims do ID token (nome, email, roles...) */
async function handleCallback(req, { codeVerifier, state }) {
  const client = await getClient();
  const params = client.callbackParams(req);
  const tokenSet = await client.callback(env.KEYCLOAK_REDIRECT_URI, params, { code_verifier: codeVerifier, state });
  return { tokenSet, claims: tokenSet.claims() };
}

/** Lê o papel (supervisor/analista) de dentro do token pelo caminho configurado em KEYCLOAK_ROLE_CLAIM_PATH. */
function extrairRoles(claims) {
  const caminho = env.KEYCLOAK_ROLE_CLAIM_PATH.split(".");
  let node = claims;
  for (const chave of caminho) {
    node = node?.[chave];
    if (node === undefined) return [];
  }
  return Array.isArray(node) ? node : [];
}

function resolverPapel(roles) {
  if (roles.includes(env.KEYCLOAK_SUPERVISOR_ROLE)) return "supervisor";
  if (roles.includes(env.KEYCLOAK_ANALISTA_ROLE)) return "analista";
  return null;
}

async function getLogoutUrl(idToken) {
  const client = await getClient();
  return client.endSessionUrl({ id_token_hint: idToken, post_logout_redirect_uri: env.KEYCLOAK_POST_LOGOUT_REDIRECT_URI });
}

module.exports = { getClient, gerarPkce, getAuthorizationUrl, handleCallback, extrairRoles, resolverPapel, getLogoutUrl };
