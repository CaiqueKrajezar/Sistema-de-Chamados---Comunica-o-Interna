"use strict";

const express = require("express");
const { z } = require("zod");
const repos = require("../repositories");
const { validateBody } = require("../middlewares/validate");
const motor = require("../domain/roteamento/motor");
const fluxoAprovacao = require("../domain/aprovacao/fluxoAprovacao");
const templates = require("../services/notificacaoTemplates");
const logger = require("../config/logger");

const router = express.Router();

const PUBLICOS = ["Holding", "Operacao-Lojas", "Operacao-CD", "Todos"];
const PUBLICO_ALVO_CONTEUDO = ["Escritorio_SP", "Lojas", "CD"];

const eventoDetalheSchema = z.object({
  nomeEvento: z.string().min(1, "Informe o nome do evento."),
  responsavelNome: z.string().min(1, "Informe o nome do responsável."),
  responsavelArea: z.string().optional(),
  responsavelEmail: z.string().email("E-mail do responsável inválido."),
  responsavelTelefone: z.string().optional(),
  objetivo: z.string().optional(),
  publicoEvento: z.string().optional(),
  qtdParticipantesEstimada: z.coerce.number().int().positive().optional(),
  dataDesejada: z.string().optional(),
  horarioInicio: z.string().optional(),
  horarioFim: z.string().optional(),
  flexibilidadeData: z.boolean().optional(),
  localDefinido: z.boolean().optional(),
  localTexto: z.string().optional(),
  formato: z.enum(["presencial", "online", "hibrido"]).optional(),
  dinamicaEvento: z.string().optional(),
  identidadeVisualStatus: z.enum(["definida", "nao_definida", "em_desenvolvimento"]).optional(),
  budgetStatus: z.enum(["disponivel", "nao_disponivel", "em_aprovacao"]).optional(),
  budgetValorEstimado: z.coerce.number().optional(),
  fornecedorParceiro: z.string().optional(),
  restricoesObservacoes: z.string().optional(),
  checklistEstrutura: z.array(z.string()).optional(),
  checklistMateriaisComunicacao: z.array(z.string()).optional(),
  checklistEscopoEsperado: z.array(z.string()).optional()
});

const criarChamadoSchema = z
  .object({
    publico: z.enum(PUBLICOS),
    areaId: z.coerce.number().int().positive().optional(),
    tipoSolicitacaoId: z.coerce.number().int().positive(),
    solicitanteNome: z.string().optional(),
    solicitanteEmail: z.string().email().optional().or(z.literal("")),
    solicitanteLocalTexto: z.string().optional(),
    publicoAlvoConteudo: z.enum(PUBLICO_ALVO_CONTEUDO).optional(),
    descricao: z.string().optional(),
    conteudoProntoRef: z.boolean().optional(),
    conteudoProntoRefTexto: z.string().optional(),
    segundoAprovadorNome: z.string().optional(),
    segundoAprovadorEmail: z.string().email().optional().or(z.literal("")),
    cienciaSla: z.boolean(),
    eventoDetalhe: eventoDetalheSchema.optional()
  })
  .superRefine((data, ctx) => {
    if (data.cienciaSla !== true) {
      ctx.addIssue({ path: ["cienciaSla"], message: "É preciso confirmar ciência do SLA para enviar o chamado.", code: z.ZodIssueCode.custom });
    }
    if ((data.publico === "Holding" || data.publico === "Todos") && !data.areaId) {
      ctx.addIssue({ path: ["areaId"], message: "Área é obrigatória para público Holding/Todos.", code: z.ZodIssueCode.custom });
    }
  });

router.get("/tipos-solicitacao", async (req, res, next) => {
  try {
    res.json(await repos.tipoSolicitacao.listarAtivos());
  } catch (err) {
    next(err);
  }
});

router.get("/areas", async (req, res, next) => {
  try {
    res.json(await repos.area.listarAtivas());
  } catch (err) {
    next(err);
  }
});

async function criarNotificacoesDeAbertura({ chamado, tipo, analistaPrincipal, analistaSecundario }) {
  const notificacoesCriadas = [];
  if (analistaPrincipal) {
    const { assunto, corpo } = templates.novoChamado({ chamado, tipoNome: tipo.nome, coResponsavel: false });
    const n = await repos.notificacao.criar({
      chamadoId: chamado.id,
      analistaId: analistaPrincipal.id,
      destinatarioEmail: analistaPrincipal.email,
      tipoEvento: "novo_chamado",
      assunto,
      corpo
    });
    notificacoesCriadas.push({ ...n, analistaNome: analistaPrincipal.nome, cor: analistaPrincipal.cor });
  }
  if (analistaSecundario) {
    const { assunto, corpo } = templates.novoChamado({ chamado, tipoNome: tipo.nome, coResponsavel: true });
    const n = await repos.notificacao.criar({
      chamadoId: chamado.id,
      analistaId: analistaSecundario.id,
      destinatarioEmail: analistaSecundario.email,
      tipoEvento: "novo_chamado",
      assunto,
      corpo
    });
    notificacoesCriadas.push({ ...n, analistaNome: analistaSecundario.nome, cor: analistaSecundario.cor });
  }
  if (chamado.status === "aguardando_aprovacao" && chamado.segundoAprovadorEmail) {
    const { assunto, corpo } = templates.aprovacaoPendente({ chamado, tipoNome: tipo.nome });
    await repos.notificacao.criar({
      chamadoId: chamado.id,
      analistaId: null,
      destinatarioEmail: chamado.segundoAprovadorEmail,
      tipoEvento: "aprovacao_pendente",
      assunto,
      corpo
    });
  }
  return notificacoesCriadas;
}

router.post("/chamados", express.json({ limit: "1mb" }), validateBody(criarChamadoSchema), async (req, res, next) => {
  try {
    const data = req.body;

    const tipo = await repos.tipoSolicitacao.buscarPorId(data.tipoSolicitacaoId);
    if (!tipo || !tipo.ativo) {
      return res.status(400).json({ erro: "Tipo de solicitação inválido." });
    }
    if (tipo.requerBriefingEvento && !data.eventoDetalhe) {
      return res.status(400).json({ erro: `O tipo "${tipo.nome}" exige o briefing detalhado de evento.` });
    }
    if (!tipo.requerBriefingEvento && !data.descricao) {
      return res.status(400).json({ erro: "Descreva a demanda." });
    }

    // Público Lojas/CD não passa pelo filtro de área (regra de negócio) — ignora área se vier mesmo assim.
    const areaIdFinal = data.publico === "Holding" || data.publico === "Todos" ? data.areaId ?? null : null;

    const roteamento = await motor.resolverAnalista({
      publico: data.publico,
      areaId: areaIdFinal,
      tipoSolicitacaoId: tipo.id
    });

    const abertura = fluxoAprovacao.resolverAberturaChamado({
      tipo,
      segundoAprovadorEmail: data.segundoAprovadorEmail || null
    });

    const chamado = await repos.chamado.criar({
      publico: data.publico,
      areaId: areaIdFinal,
      tipoSolicitacaoId: tipo.id,
      solicitanteNome: data.solicitanteNome || null,
      solicitanteEmail: data.solicitanteEmail || null,
      solicitanteLocalTexto: data.solicitanteLocalTexto || null,
      publicoAlvoConteudo: data.publicoAlvoConteudo || null,
      descricao: data.descricao || null,
      conteudoProntoRef: !!data.conteudoProntoRef,
      conteudoProntoRefTexto: data.conteudoProntoRefTexto || null,
      analistaPrincipalId: roteamento.analistaPrincipalId,
      analistaSecundarioId: roteamento.analistaSecundarioId,
      status: abertura.status,
      dataInicioSla: abertura.dataInicioSla,
      dataPrazo: abertura.dataPrazo,
      slaDiasSnapshot: tipo.slaDias,
      slaContaUteisSnapshot: tipo.slaContaDiasUteis,
      segundoAprovadorNome: data.segundoAprovadorNome || null,
      segundoAprovadorEmail: data.segundoAprovadorEmail || null,
      aprovacaoStatus: abertura.aprovacaoStatus,
      cienciaSla: data.cienciaSla,
      eventoDetalhe: data.eventoDetalhe || null
    });

    const analistaPrincipal = roteamento.analistaPrincipalId ? await repos.analista.buscarPorId(roteamento.analistaPrincipalId) : null;
    const analistaSecundario = roteamento.analistaSecundarioId ? await repos.analista.buscarPorId(roteamento.analistaSecundarioId) : null;

    const notificacoes = await criarNotificacoesDeAbertura({ chamado, tipo, analistaPrincipal, analistaSecundario });

    res.status(201).json({
      id: chamado.id,
      protocolo: chamado.protocolo,
      status: chamado.status,
      analistaPrincipal: analistaPrincipal ? { nome: analistaPrincipal.nome, email: analistaPrincipal.email, cor: analistaPrincipal.cor } : null,
      analistaSecundario: analistaSecundario ? { nome: analistaSecundario.nome, email: analistaSecundario.email, cor: analistaSecundario.cor } : null,
      notificacoesEnviadas: notificacoes.length
    });
  } catch (err) {
    logger.error("Falha ao criar chamado público", err);
    next(err);
  }
});

module.exports = router;
