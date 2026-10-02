"use strict";

const express = require("express");
const { z } = require("zod");
const repos = require("../repositories");
const { requireRole } = require("../auth/middleware");
const { validateBody } = require("../middlewares/validate");
const templates = require("../services/notificacaoTemplates");

const router = express.Router();

const schema = z.object({ analistaPrincipalId: z.coerce.number().int().positive() });

router.patch("/:id/reatribuir", requireRole("supervisor"), express.json(), validateBody(schema), async (req, res, next) => {
  try {
    const chamado = await repos.chamado.buscarPorId(Number(req.params.id));
    if (!chamado) return res.status(404).json({ erro: "Chamado não encontrado." });

    const novoAnalista = await repos.analista.buscarPorId(req.body.analistaPrincipalId);
    if (!novoAnalista || !novoAnalista.ativo) return res.status(400).json({ erro: "Analista inválido." });

    const atualizado = await repos.chamado.reatribuir(chamado.id, novoAnalista.id);

    const tipo = await repos.tipoSolicitacao.buscarPorId(chamado.tipoSolicitacaoId);
    const { assunto, corpo } = templates.reatribuicao({ chamado: atualizado, tipoNome: tipo.nome });
    await repos.notificacao.criar({
      chamadoId: chamado.id,
      analistaId: novoAnalista.id,
      destinatarioEmail: novoAnalista.email,
      tipoEvento: "reatribuicao",
      assunto,
      corpo
    });

    res.json(atualizado);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
