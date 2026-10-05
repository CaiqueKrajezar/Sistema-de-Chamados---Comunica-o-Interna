"use strict";

const express = require("express");
const { z } = require("zod");
const repos = require("../repositories");
const { requireAuth, requireRole } = require("../auth/middleware");
const { validateBody } = require("../middlewares/validate");

const router = express.Router();
router.use(requireAuth);

const PUBLICOS = ["Holding", "Operacao-Lojas", "Operacao-CD", "Todos"];

const regraSchema = z.object({
  publicos: z.array(z.enum(PUBLICOS)).min(1, "Selecione pelo menos um público."),
  areaId: z.coerce.number().int().positive().nullable().optional(),
  tipoSolicitacaoId: z.coerce.number().int().positive().nullable().optional(),
  analistaPrincipalId: z.coerce.number().int().positive(),
  analistaSecundarioId: z.coerce.number().int().positive().nullable().optional(),
  responsavelSla: z.enum(["PRINCIPAL", "SECUNDARIO"]).optional(),
  prioridade: z.coerce.number().int().optional(),
  ativo: z.boolean().optional(),
  observacao: z.string().optional()
});

router.get("/", async (req, res, next) => {
  try {
    res.json(await repos.regraRoteamento.listarComPublicos());
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRole("coordenador"), express.json(), validateBody(regraSchema), async (req, res, next) => {
  try {
    const regra = await repos.regraRoteamento.criar({ ...req.body, atualizadoPor: req.sessao.nome });
    res.status(201).json(regra);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRole("coordenador"), express.json(), validateBody(regraSchema), async (req, res, next) => {
  try {
    const regra = await repos.regraRoteamento.atualizar(Number(req.params.id), { ...req.body, atualizadoPor: req.sessao.nome });
    res.json(regra);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("coordenador"), async (req, res, next) => {
  try {
    const regra = await repos.regraRoteamento.desativar(Number(req.params.id), req.sessao.nome);
    res.json(regra);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
