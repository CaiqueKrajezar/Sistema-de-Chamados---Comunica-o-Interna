"use strict";

/*
 * Zé, esse é o fluxo OIDC de verdade (Authorization Code + PKCE), usando a lib
 * `openid-client` — não usei o pacote `keycloak-connect` porque ele tá descontinuado.
 * Fiz o require do `openid-client` escondido dentro de `loadOpenidClient()` (não lá no
 * topo do arquivo) pelo mesmo motivo do oracledb: esse módulo só é carregado quando
 * AUTH_MODE=keycloak de fato usa alguma função daqui, então quem roda em modo dev não
 * paga esse custo. O `getClient()` guarda a promise de descoberta do Issuer (aquele
 * `.well-known/openid-configuration`) num cache de módulo pra não ficar batendo no
 * Keycloak a cada request — só descobre uma vez.
 *
 * Eu não tinha um Keycloak de teste pra validar esse fluxo de ponta a ponta, então
 * segui a documentação do `openid-client` v5 à risca. O que vai precisar de validação
 * real: KEYCLOAK_BASE_URL + KEYCLOAK_REALM batendo certinho com a URL de discovery, e o
 * KEYCLOAK_ROLE_CLAIM_PATH batendo com onde as roles aparecem no token de vocês (depende
 * de como o realm foi configurado — por padrão o Keycloak manda em
 * `realm_access.roles`, que é o default aqui, mas se usarem roles de client em vez de
 * realm, o caminho muda).
 */

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

/** Lê o papel (coordenador/analista) de dentro do token pelo caminho configurado em KEYCLOAK_ROLE_CLAIM_PATH. */
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
  if (roles.includes(env.KEYCLOAK_COORDENADOR_ROLE)) return "coordenador";
  if (roles.includes(env.KEYCLOAK_ANALISTA_ROLE)) return "analista";
  return null;
}

async function getLogoutUrl(idToken) {
  const client = await getClient();
  return client.endSessionUrl({ id_token_hint: idToken, post_logout_redirect_uri: env.KEYCLOAK_POST_LOGOUT_REDIRECT_URI });
}

module.exports = { getClient, gerarPkce, getAuthorizationUrl, handleCallback, extrairRoles, resolverPapel, getLogoutUrl };
