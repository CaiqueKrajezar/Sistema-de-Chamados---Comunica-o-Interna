"use strict";

const express = require("express");
const multer = require("multer");
const path = require("node:path");
const repos = require("../repositories");
const { env } = require("../config/env");
const filesystemAdapter = require("../services/storage/filesystemAdapter");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_ANEXO_MB * 1024 * 1024, files: env.MAX_ANEXOS_POR_CHAMADO },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!env.anexoTiposPermitidos.includes(ext)) {
      const err = new Error(`Tipo de arquivo não permitido: ${ext}`);
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

/**
 * Sem requireAuth de propósito: faz parte do fluxo público de abertura (o solicitante anexa
 * arquivos logo após criar o chamado, na mesma sessão, sem login). Validação de quantidade/
 * tamanho/tipo é feita pelo multer com os limites de MAX_ANEXO_MB/MAX_ANEXOS_POR_CHAMADO/
 * ANEXO_TIPOS_PERMITIDOS. Ver README para o hardening pendente (ex.: token de upload de uso único).
 */
router.post("/:id/anexos", upload.array("arquivos", env.MAX_ANEXOS_POR_CHAMADO), async (req, res, next) => {
  try {
    const chamadoId = Number(req.params.id);
    const chamado = await repos.chamado.buscarPorId(chamadoId);
    if (!chamado) return res.status(404).json({ erro: "Chamado não encontrado." });

    const arquivos = req.files || [];
    const jaEnviados = await repos.anexo.contarPorChamado(chamadoId);
    if (jaEnviados + arquivos.length > env.MAX_ANEXOS_POR_CHAMADO) {
      return res.status(400).json({ erro: `Máximo de ${env.MAX_ANEXOS_POR_CHAMADO} arquivos por chamado.` });
    }

    const enviadoPor = req.sessao?.nome || chamado.solicitanteNome || "solicitante";
    const criados = [];

    for (const file of arquivos) {
      let anexo;
      if (env.ATTACHMENT_STORAGE === "oracle_blob") {
        anexo = await repos.anexo.criar({
          chamadoId,
          nomeOriginal: file.originalname,
          nomeArmazenado: file.originalname,
          caminhoRelativo: "oracle_blob",
          mimeType: file.mimetype,
          tamanhoBytes: file.size,
          checksumSha256: null,
          enviadoPor
        });
        const oracleBlobAdapter = require("../services/storage/oracleBlobAdapter");
        await oracleBlobAdapter.salvar({ anexoId: anexo.id, buffer: file.buffer });
      } else {
        const { nomeArmazenado, caminhoRelativo, checksumSha256 } = await filesystemAdapter.salvar({
          chamadoId,
          buffer: file.buffer,
          nomeOriginal: file.originalname
        });
        anexo = await repos.anexo.criar({
          chamadoId,
          nomeOriginal: file.originalname,
          nomeArmazenado,
          caminhoRelativo,
          mimeType: file.mimetype,
          tamanhoBytes: file.size,
          checksumSha256,
          enviadoPor
        });
      }
      criados.push(anexo);
    }

    res.status(201).json(criados);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/anexos", async (req, res, next) => {
  try {
    res.json(await repos.anexo.listarPorChamado(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
