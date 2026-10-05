"use strict";

const { env } = require("../../config/env");
const logger = require("../../config/logger");

/*
 * Zé, esse arquivo só é de fato exercitado quando DB_DRIVER=oracle — eu não tive como
 * testar contra um Oracle real aqui, então testei a parte que dá pra testar sem banco
 * (o `oracledb` carrega certinho, a pool connection string monta certinho) e o resto eu
 * segui a documentação oficial do node-oracledb à risca. Se der algum erro de conexão
 * na hora de integrar de verdade, bem provável que seja algo específico do ambiente de
 * vocês (connect string, wallet, modo thin vs thick) e não um bug de lógica — me chama
 * que a gente debuga junto.
 *
 * `oracledb` é dependência opcional no package.json (optionalDependencies) de propósito:
 * assim quem só for rodar em modo sqlite não precisa instalar esse pacote (ele tem um
 * script de instalação que baixa binário nativo, não é instantâneo). Por isso o
 * `require('oracledb')` fica escondido dentro de uma função (loadDriver) em vez de lá no
 * topo do arquivo — se tentasse importar direto e o pacote não estivesse instalado, ia
 * quebrar o processo inteiro mesmo rodando em modo sqlite.
 */

let pool = null;
let driverRef = null;

function loadDriver() {
  if (driverRef) return driverRef;
  try {
    // eslint-disable-next-line global-require
    driverRef = require("oracledb");
    return driverRef;
  } catch (err) {
    throw new Error(
      "Driver 'oracledb' não pôde ser carregado. Confirme que `npm install` rodou num ambiente com " +
        "acesso à internet (modo thin, padrão) ou que o Oracle Instant Client está instalado " +
        "(necessário só se ORACLE_CLIENT_MODE=thick). Detalhe original: " +
        err.message
    );
  }
}

/** Repositórios usam isto pra pegar as constantes (BIND_OUT, NUMBER, CLOB...) sem duplicar o require/try-catch. */
function getOracledb() {
  return loadDriver();
}

async function getPool() {
  if (pool) return pool;
  const oracledb = loadDriver();
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.autoCommit = false;
  // CLOB volta como string JS comum (não como Lob) — simplifica todo o código dos repositórios.
  oracledb.fetchAsString = [oracledb.CLOB];

  if (env.ORACLE_CLIENT_MODE === "thick") {
    oracledb.initOracleClient(env.ORACLE_WALLET_LOCATION ? { configDir: env.ORACLE_WALLET_LOCATION } : undefined);
  }

  pool = await oracledb.createPool({
    user: env.ORACLE_USER,
    password: env.ORACLE_PASSWORD,
    connectString: env.ORACLE_CONNECT_STRING,
    poolMin: env.ORACLE_POOL_MIN,
    poolMax: env.ORACLE_POOL_MAX
  });
  logger.info("Pool Oracle criado", { poolMin: env.ORACLE_POOL_MIN, poolMax: env.ORACLE_POOL_MAX });
  return pool;
}

/** Pega uma conexão do pool, roda `fn(conn)`, comita se ok, rollback se erro, sempre fecha a conexão. */
async function withConnection(fn) {
  const p = await getPool();
  const conn = await p.getConnection();
  try {
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    await conn.close();
  }
}

/** Split simples por ';' pra rodar migrations statement-a-statement (node-oracledb não roda múltiplos por execute). */
function splitStatements(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function migrationAdapter() {
  return {
    async ensureMigrationsTable() {
      await withConnection(async (conn) => {
        const check = await conn.execute("SELECT table_name FROM user_tables WHERE table_name = 'SCHEMA_MIGRATIONS'");
        if (check.rows.length === 0) {
          await conn.execute(`
            CREATE TABLE schema_migrations (
              nome VARCHAR2(200) PRIMARY KEY,
              aplicado_em TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
            )
          `);
        }
      });
    },
    async isApplied(name) {
      return withConnection(async (conn) => {
        const result = await conn.execute("SELECT 1 FROM schema_migrations WHERE nome = :nome", { nome: name });
        return result.rows.length > 0;
      });
    },
    async runFile(sql) {
      const statements = splitStatements(sql);
      await withConnection(async (conn) => {
        for (const stmt of statements) {
          await conn.execute(stmt);
        }
      });
    },
    async recordApplied(name) {
      await withConnection(async (conn) => {
        await conn.execute("INSERT INTO schema_migrations (nome) VALUES (:nome)", { nome: name });
      });
    }
  };
}

async function closePool() {
  if (pool) {
    await pool.close(0);
    pool = null;
  }
}

/**
 * node-oracledb retorna nomes de coluna em MAIÚSCULO (forma interna do Oracle para
 * identificadores não citados). Os repositórios usam essas duas funções pra normalizar
 * pra minúsculo antes de mapear pro formato camelCase — assim o mapeamento fica idêntico
 * ao da implementação SQLite, sem precisar citar alias em toda query.
 */
function lowerRow(r) {
  if (!r) return null;
  const out = {};
  for (const k of Object.keys(r)) out[k.toLowerCase()] = r[k];
  return out;
}

function lowerRows(rows) {
  return (rows || []).map(lowerRow);
}

module.exports = { getPool, withConnection, migrationAdapter, closePool, getOracledb, lowerRow, lowerRows };
