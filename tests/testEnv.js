"use strict";

// Requerido no topo de cada arquivo de teste que precisa de config/banco — node --test roda cada
// arquivo de teste em paralelo (processos/workers separados), então cada um precisa do seu
// próprio arquivo SQLite (senão "database is locked" quando dois arquivos de teste rodam ao
// mesmo tempo). O arquivo é apagado quando o processo termina.
const path = require("node:path");
const fs = require("node:fs");

const arquivoTeste = path.join("./data", `test-${process.pid}-${Date.now()}.sqlite3`);

process.env.NODE_ENV = "test";
process.env.DB_DRIVER = "sqlite";
process.env.SQLITE_FILE = arquivoTeste;
process.env.APP_SESSION_SECRET = "test-secret-minimum-16-characters";
process.env.AUTH_MODE = "dev";
process.env.MAIL_MODE = "console";

process.on("exit", () => {
  try {
    fs.unlinkSync(arquivoTeste);
  } catch {
    // arquivo pode não existir ainda — sem problema
  }
});

module.exports = {};
