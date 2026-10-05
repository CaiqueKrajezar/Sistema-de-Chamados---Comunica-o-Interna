"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * Zé, não quis trazer uma lib de migration pronta (Flyway, Knex etc.) só pra isso — é
 * simples o suficiente pra eu escrever na mão e assim fica mais fácil de qualquer um
 * entender o que roda. A ideia é: lê os .sql de um diretório em ordem (por isso o
 * prefixo numérico nos nomes dos arquivo, tipo 001_, 002_), confere numa tabela de
 * controle (schema_migrations) o que já rodou, e só aplica o que falta. Dá pra rodar
 * `npm run migrate` quantas vezes quiser que não duplica nada.
 *
 * `adapter` é o que isola a diferença entre Oracle e SQLite (sintaxe de SQL é um pouco
 * diferente nos dois, e o jeito de rodar statement também):
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
