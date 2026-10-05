"use strict";

/**
 * Zé, esse arquivo é o coração de "trocar Oracle/Keycloak sem mexer em código": tudo
 * que é configuração de ambiente passa por aqui e é validado com zod antes do app subir.
 * Se faltar alguma variável obrigatória pro modo escolhido, o processo nem sobe — prefiro
 * falhar na inicialização com uma mensagem clara do que deixar o app rodar pela metade e
 * quebrar em produção na primeira requisição. Repara que AUTH_MODE e DB_DRIVER são os dois
 * "interruptores" principais: dev/sqlite é o que eu uso pra desenvolver sem acesso a nada
 * real, keycloak/oracle é o que vocês vão usar em produção. O resto do código quase não
 * verifica AUTH_MODE ou DB_DRIVER diretamente — os pontos que decidem com base nisso são
 * só src/db/index.js (qual implementação de repositório carregar) e
 * src/routes/auth.routes.js (qual fluxo de login expor). Todo o resto do app trabalha só
 * com o cookie de sessão já resolvido (req.sessao), sem saber se veio do modo dev ou do
 * Keycloak de verdade — isso é proposital, pra não espalhar "if (AUTH_MODE === ...)" pelo
 * código inteiro.
 */

const path = require("node:path");
const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const boolFromString = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_BASE_URL: z.string().default("http://localhost:3000"),
  APP_SESSION_SECRET: z.string().min(16, "APP_SESSION_SECRET precisa ter pelo menos 16 caracteres"),
  APP_SESSION_COOKIE_NAME: z.string().default("ci_session"),
  APP_SESSION_TTL_HOURS: z.coerce.number().positive().default(10),

  AUTH_MODE: z.enum(["dev", "keycloak"]).default("dev"),
  AUTH_JIT_PROVISION: boolFromString,

  KEYCLOAK_BASE_URL: z.string().optional(),
  KEYCLOAK_REALM: z.string().optional(),
  KEYCLOAK_CLIENT_ID: z.string().optional(),
  KEYCLOAK_CLIENT_SECRET: z.string().optional(),
  KEYCLOAK_REDIRECT_URI: z.string().optional(),
  KEYCLOAK_POST_LOGOUT_REDIRECT_URI: z.string().optional(),
  KEYCLOAK_ROLE_CLAIM_PATH: z.string().default("realm_access.roles"),
  KEYCLOAK_COORDENADOR_ROLE: z.string().default("coordenador"),
  KEYCLOAK_ANALISTA_ROLE: z.string().default("analista"),

  DB_DRIVER: z.enum(["sqlite", "oracle"]).default("sqlite"),
  SQLITE_FILE: z.string().default("./data/dev.sqlite3"),

  ORACLE_USER: z.string().optional(),
  ORACLE_PASSWORD: z.string().optional(),
  ORACLE_CONNECT_STRING: z.string().optional(),
  ORACLE_POOL_MIN: z.coerce.number().int().positive().default(2),
  ORACLE_POOL_MAX: z.coerce.number().int().positive().default(10),
  ORACLE_WALLET_LOCATION: z.string().optional(),
  ORACLE_CLIENT_MODE: z.enum(["thin", "thick"]).default("thin"),

  MAIL_MODE: z.enum(["console", "smtp"]).default("console"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: boolFromString,
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_NAME: z.string().default("Central de Chamados - Comunicação Interna"),
  SMTP_FROM_EMAIL: z.string().default("chamados-ci@empresa.com"),

  ATTACHMENT_STORAGE: z.enum(["filesystem", "oracle_blob"]).default("filesystem"),
  UPLOAD_DIR: z.string().default("./data/uploads"),
  MAX_ANEXO_MB: z.coerce.number().positive().default(100),
  MAX_ANEXOS_POR_CHAMADO: z.coerce.number().int().positive().default(4),
  ANEXO_TIPOS_PERMITIDOS: z
    .string()
    .default(".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.png,.jpg,.jpeg,.mp4,.mov,.mp3,.wav"),

  SLA_TIMEZONE: z.string().default("America/Sao_Paulo")
});

function parseEnv(source) {
  const result = baseSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuração inválida em .env:\n${issues}`);
  }
  const env = result.data;

  const missing = [];
  if (env.AUTH_MODE === "keycloak") {
    for (const key of ["KEYCLOAK_BASE_URL", "KEYCLOAK_REALM", "KEYCLOAK_CLIENT_ID", "KEYCLOAK_CLIENT_SECRET", "KEYCLOAK_REDIRECT_URI"]) {
      if (!env[key]) missing.push(key);
    }
  }
  if (env.DB_DRIVER === "oracle") {
    for (const key of ["ORACLE_USER", "ORACLE_PASSWORD", "ORACLE_CONNECT_STRING"]) {
      if (!env[key]) missing.push(key);
    }
  }
  if (env.MAIL_MODE === "smtp") {
    for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]) {
      if (!env[key]) missing.push(key);
    }
  }
  if (missing.length) {
    throw new Error(
      `Configuração incompleta em .env para o modo escolhido (AUTH_MODE=${env.AUTH_MODE}, DB_DRIVER=${env.DB_DRIVER}, MAIL_MODE=${env.MAIL_MODE}).\n` +
        `Faltam: ${missing.join(", ")}`
    );
  }

  return {
    ...env,
    isProduction: env.NODE_ENV === "production",
    isTest: env.NODE_ENV === "test",
    anexoTiposPermitidos: env.ANEXO_TIPOS_PERMITIDOS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    uploadDirAbs: path.resolve(process.cwd(), env.UPLOAD_DIR),
    sqliteFileAbs: path.resolve(process.cwd(), env.SQLITE_FILE)
  };
}

const env = parseEnv(process.env);

module.exports = { env, parseEnv, baseSchema };
