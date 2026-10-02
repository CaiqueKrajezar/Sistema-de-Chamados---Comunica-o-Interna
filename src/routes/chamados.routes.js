"use strict";

const express = require("express");
const { z } = require("zod");
const repos = require("../repositories");
const { requireAuth } = require("../auth/middleware");
const { validateBody } = require("../middlewares/validate");
const regrasRevisao = require("../domain/revisoes/regrasRevisao");
const fluxoAprovacao = require("../domain/aprovacao/fluxoAprovacao");
const { slaEstado } = require("../domain/sla/slaStatus");
const templates = require("../services/notificacaoTemplates");

const router = express.Router();
router.use(requireAuth);

const STATUS_VALIDOS = ["aguardando_aprovacao", "novo", "em_andamento", "em_revisao", "aguardando_solicitante", "resolvido", "cancelado"];

/** Anexa slaEstado ("ok"|"atencao"|"atrasado"|null) pra não duplicar essa lógica no front-end. */
function comSla(chamado) {
  if (!chamado) return chamado;
  return { ...chamado, slaEstado: slaEstado(chamado) };
}

router.get("/", async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status).split(",") : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const chamados = await repos.chamado.listar({ status, limit });
    res.json(chamados.map(comSla));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const chamado = await repos.chamado.buscarPorId(Number(req.params.id));
    if (!chamado) return res.status(404).json({ erro: "Chamado não encontrado." });
    res.json(comSla(chamado));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/historico", async (req, res, next) => {
  try {
    res.json(await repos.historico.listarPorChamado(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/revisoes", async (req, res, next) => {
  try {
    res.json(await repos.revisao.listarPorChamado(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
});

const atualizarStatusSchema = z.object({
  status: z.enum(STATUS_VALIDOS),
  observacao: z.string().optional()
});

router.patch("/:id/status", express.json(), validateBody(atualizarStatusSchema), async (req, res, next) => {
  try {
    const chamado = await repos.chamado.atualizarStatus(Number(req.params.id), req.body.status, req.sessao.nome, req.body.observacao);
    res.json(chamado);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/aprovar", express.json(), async (req, res, next) => {
  try {
    const chamado = await repos.chamado.buscarPorId(Number(req.params.id));
    if (!chamado) return res.status(404).json({ erro: "Chamado não encontrado." });
    if (chamado.status !== "aguardando_aprovacao") {
      return res.status(409).json({ erro: "Este chamado não está aguardando aprovação." });
    }
    const tipo = await repos.tipoSolicitacao.buscarPorId(chamado.tipoSolicitacaoId);
    const { dataInicioSla, dataPrazo } = fluxoAprovacao.resolverAprovacao({ tipo });
    const atualizado = await repos.chamado.aprovar(chamado.id, { dataInicioSla, dataPrazo });

    if (chamado.analistaPrincipalId) {
      const analista = await repos.analista.buscarPorId(chamado.analistaPrincipalId);
      if (analista) {
        const { assunto, corpo } = templates.aprovado({ chamado: atualizado, tipoNome: tipo.nome, analistaNome: analista.nome });
        await repos.notificacao.criar({
          chamadoId: chamado.id,
          analistaId: analista.id,
          destinatarioEmail: analista.email,
          tipoEvento: "aprovado",
          assunto,
          corpo
        });
      }
    }
    res.json(atualizado);
  } catch (err) {
    next(err);
  }
});

const revisaoSchema = z.object({
  tipoRevisao: z.enum(["conteudo", "design"]),
  descricao: z.string().optional()
});

router.post("/:id/revisoes", express.json(), validateBody(revisaoSchema), async (req, res, next) => {
  try {
    const chamado = await repos.chamado.buscarPorId(Number(req.params.id));
    if (!chamado) return res.status(404).json({ erro: "Chamado não encontrado." });

    if (!regrasRevisao.podeSolicitarRevisao(chamado, req.body.tipoRevisao)) {
      const limite = req.body.tipoRevisao === "conteudo" ? regrasRevisao.LIMITE_REVISAO_CONTEUDO : regrasRevisao.LIMITE_REVISAO_DESIGN;
      return res.status(409).json({
        erro: `Limite de ${limite} revisões de ${req.body.tipoRevisao} já foi atingido neste chamado. Abra um novo chamado para continuar o ajuste.`,
        chamadoOrigemId: chamado.id
      });
    }

    const revisao = await repos.revisao.criar({
      chamadoId: chamado.id,
      tipoRevisao: req.body.tipoRevisao,
      solicitadoPor: req.sessao.nome,
      descricao: req.body.descricao
    });
    await repos.chamado.incrementarContadorRevisao(chamado.id, req.body.tipoRevisao);
    if (chamado.status !== "resolvido") {
      await repos.chamado.atualizarStatus(chamado.id, "em_revisao", req.sessao.nome, `Revisão de ${req.body.tipoRevisao} solicitada`);
    }
    res.status(201).json(revisao);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
