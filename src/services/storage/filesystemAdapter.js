"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { env } = require("../../config/env");

/** Storage padrão (ATTACHMENT_STORAGE=filesystem): grava em UPLOAD_DIR/<chamadoId>/<uuid>-<nome>. */
async function salvar({ chamadoId, buffer, nomeOriginal }) {
  const dir = path.join(env.uploadDirAbs, String(chamadoId));
  fs.mkdirSync(dir, { recursive: true });
  const nomeSanitizado = nomeOriginal.replace(/[^a-zA-Z0-9._-]/g, "_");
  const nomeArmazenado = `${crypto.randomUUID()}-${nomeSanitizado}`;
  const caminhoAbsolutoArquivo = path.join(dir, nomeArmazenado);
  fs.writeFileSync(caminhoAbsolutoArquivo, buffer);
  const caminhoRelativo = path.relative(env.uploadDirAbs, caminhoAbsolutoArquivo).split(path.sep).join("/");
  const checksumSha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  return { nomeArmazenado, caminhoRelativo, checksumSha256 };
}

function caminhoAbsoluto(caminhoRelativo) {
  return path.join(env.uploadDirAbs, caminhoRelativo);
}

module.exports = { salvar, caminhoAbsoluto };
