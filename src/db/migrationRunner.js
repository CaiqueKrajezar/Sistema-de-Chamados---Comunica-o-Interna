"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * Aplica, em ordem, as migrations .sql pendentes de um diretório.
 * `adapter` isola as diferenças entre drivers (Oracle vs SQLite):
 *   - ensureMigrationsTable(): cria a tabela de controle se não existir
 *   - isApplied(nomeArquivo): boolean
 *   - runFile(sqlTexto): executa o conteúdo do arquivo (pode ser 1+ statements)
 *   - recordApplied(nomeArquivo): grava que foi aplicada
 */
async function runMigrations({ migrationsDir, adapter, logger }) {
  await adapter.ensureMigrationsTable();

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const already = await adapter.isApplied(file);
    if (already) {
      logger?.debug(`Migration já aplicada: ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    logger?.info(`Aplicando migration: ${file}`);
    await adapter.runFile(sql);
    await adapter.recordApplied(file);
    logger?.info(`Migration aplicada: ${file}`);
  }
}

module.exports = { runMigrations };
