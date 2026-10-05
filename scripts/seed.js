"use strict";

/**
 * Popula tipos de solicitação, áreas, analistas e a matriz de roteamento com os dados
 * reais passados pela área de Comunicação Interna. Idempotente: pula o que já existe,
 * então pode rodar de novo sem duplicar (ex.: depois de adicionar um tipo novo aqui).
 */
const repos = require("../src/repositories");
const logger = require("../src/config/logger");

const TIPOS = [
  { nome: "Comunicado", slaDias: 5, slaContaDiasUteis: true },
  { nome: "Criação de Marca", slaDias: 7, slaContaDiasUteis: true },
  { nome: "Criação de Logo", slaDias: 7, slaContaDiasUteis: true },
  { nome: "Criação de Identidade Visual (KV)", slaDias: 7, slaContaDiasUteis: true },
  { nome: "Papelaria", slaDias: 7, slaContaDiasUteis: true },
  { nome: "Produção e edição de vídeos", slaDias: 10, slaContaDiasUteis: true },
  { nome: "Criação de apresentação em PowerPoint", slaDias: 7, slaContaDiasUteis: true },
  { nome: "Estrutura de projetos", slaDias: 7, slaContaDiasUteis: true },
  { nome: "Produção de camisetas e brindes", slaDias: 15, slaContaDiasUteis: true },
  { nome: "Eventos", slaDias: 60, slaContaDiasUteis: false, requerBriefingEvento: true },
  { nome: "Outras demandas", slaDias: 5, slaContaDiasUteis: true }
];

const AREAS = [
  "BU Operações",
  "BU Supply",
  "BU RH – Atração e Seleção Loja e CD",
  "BU SSMA",
  "BU RH – DHO e Diversidade",
  "BU RH – Atração e Seleção Holding",
  "BU Compliance",
  "BU Jurídico",
  "BU RH – Remuneração e Benefícios",
  "BU TI",
  "BU Expansão",
  "BU Comercial/MKT",
  "BU Finanças",
  "Planejamento Estratégico",
  "Outras"
];

const ANALISTAS = [
  { nome: "Rafael Campos", email: "rafael.campos@empresa.com", cor: "#3b6fd4", papel: "analista" },
  { nome: "Daniela Giuzio", email: "daniela.giuzio@empresa.com", cor: "#d94f8c", papel: "analista" },
  { nome: "Tiago Oliveira", email: "tiago.oliveira@empresa.com", cor: "#2f9e5c", papel: "analista" },
  { nome: "Coordenação CI", email: "coordenacao.ci@empresa.com", cor: "#8354c9", papel: "coordenador" }
];

// área → analista (dono), conforme a matriz passada pela área de Comunicação
const AREA_PARA_ANALISTA = {
  "BU Operações": "Rafael Campos",
  "BU Supply": "Rafael Campos",
  "BU RH – Atração e Seleção Loja e CD": "Rafael Campos",
  "BU SSMA": "Rafael Campos",
  "BU RH – DHO e Diversidade": "Daniela Giuzio",
  "BU RH – Atração e Seleção Holding": "Daniela Giuzio",
  "BU Compliance": "Daniela Giuzio",
  "BU Jurídico": "Daniela Giuzio",
  "BU RH – Remuneração e Benefícios": "Tiago Oliveira",
  "BU TI": "Tiago Oliveira",
  "BU Expansão": "Tiago Oliveira",
  "BU Comercial/MKT": "Tiago Oliveira",
  "BU Finanças": "Tiago Oliveira",
  "Planejamento Estratégico": "Tiago Oliveira"
  // "Outras" fica de propósito sem regra: cai na fila "a triar" do coordenador.
};

async function seedTipos() {
  const criados = {};
  for (const t of TIPOS) {
    let tipo = await repos.tipoSolicitacao.buscarPorNome(t.nome);
    if (!tipo) {
      tipo = await repos.tipoSolicitacao.criar(t);
      logger.info(`Tipo de solicitação criado: ${t.nome}`);
    }
    criados[t.nome] = tipo;
  }
  return criados;
}

async function seedAreas() {
  const criadas = {};
  let ordem = 0;
  for (const nome of AREAS) {
    let area = await repos.area.buscarPorNome(nome);
    if (!area) {
      area = await repos.area.criar({ nome, ordemExibicao: ordem });
      logger.info(`Área criada: ${nome}`);
    }
    criadas[nome] = area;
    ordem += 1;
  }
  return criadas;
}

async function seedAnalistas() {
  const criados = {};
  for (const a of ANALISTAS) {
    let analista = await repos.analista.buscarPorEmail(a.email);
    if (!analista) {
      analista = await repos.analista.criar(a);
      logger.info(`Analista criado: ${a.nome} (${a.papel})`);
    }
    criados[a.nome] = analista;
  }
  return criados;
}

// Dashboard de Visitas em Loja (checklist de operações) — pedido em reunião pra aparecer
// só no login do Rafael, que é quem faz essas visitas.
async function seedAcessoDashboardOperacoes(analistas) {
  const rafael = analistas["Rafael Campos"];
  if (rafael && !rafael.acessoDashboardOperacoes) {
    await repos.analista.definirAcessoDashboardOperacoes(rafael.id, true);
    logger.info("Acesso ao Dashboard de Operações liberado para Rafael Campos");
  }
}

async function regraJaExiste(publico, areaId, tipoSolicitacaoId) {
  const candidatas = await repos.regraRoteamento.buscarCandidatas({ publico, areaId, tipoSolicitacaoId });
  return candidatas.some((r) => (r.areaId ?? null) === (areaId ?? null) && (r.tipoSolicitacaoId ?? null) === (tipoSolicitacaoId ?? null));
}

async function seedRegras(tipos, areas, analistas) {
  const rafael = analistas["Rafael Campos"];
  const daniela = analistas["Daniela Giuzio"];
  const tiago = analistas["Tiago Oliveira"];
  const eventos = tipos["Eventos"];

  // Regra 1: Operação-Lojas / Operação-CD → Rafael, direto, qualquer tipo (exceto reforço explícito de Eventos abaixo)
  if (!(await regraJaExiste("Operacao-Lojas", null, null))) {
    await repos.regraRoteamento.criar({
      publicos: ["Operacao-Lojas", "Operacao-CD"],
      areaId: null,
      tipoSolicitacaoId: null,
      analistaPrincipalId: rafael.id,
      prioridade: 50,
      observacao: "Público de loja/CD vai direto pro Rafael, independente da área."
    });
    logger.info("Regra criada: Operação-Lojas/CD → Rafael Campos");
  }

  // Regra 2: reforço explícito — Eventos + Lojas/CD → Rafael (mesma prioridade mais alta, deixa a intenção explícita)
  if (!(await regraJaExiste("Operacao-Lojas", null, eventos.id))) {
    await repos.regraRoteamento.criar({
      publicos: ["Operacao-Lojas", "Operacao-CD"],
      areaId: null,
      tipoSolicitacaoId: eventos.id,
      analistaPrincipalId: rafael.id,
      prioridade: 100,
      observacao: "Eventos de loja/CD → Rafael (reforço explícito da regra de público)."
    });
    logger.info("Regra criada: Eventos + Lojas/CD → Rafael Campos");
  }

  // Regra 3: matriz área → analista, vale tanto para Holding quanto para Todos
  for (const [nomeArea, nomeAnalista] of Object.entries(AREA_PARA_ANALISTA)) {
    const area = areas[nomeArea];
    const analista = { "Rafael Campos": rafael, "Daniela Giuzio": daniela, "Tiago Oliveira": tiago }[nomeAnalista];
    if (!(await regraJaExiste("Holding", area.id, null))) {
      await repos.regraRoteamento.criar({
        publicos: ["Holding", "Todos"],
        areaId: area.id,
        tipoSolicitacaoId: null,
        analistaPrincipalId: analista.id,
        prioridade: 10,
        observacao: `${nomeArea} → ${nomeAnalista}`
      });
      logger.info(`Regra criada: ${nomeArea} (Holding/Todos) → ${nomeAnalista}`);
    }
  }

  // Regra 4: Eventos corporativos (Holding/Todos) → Tiago (principal) + Daniela (secundária, também notificada)
  if (!(await regraJaExiste("Holding", null, eventos.id))) {
    await repos.regraRoteamento.criar({
      publicos: ["Holding", "Todos"],
      areaId: null,
      tipoSolicitacaoId: eventos.id,
      analistaPrincipalId: tiago.id,
      analistaSecundarioId: daniela.id,
      responsavelSla: "PRINCIPAL",
      prioridade: 100,
      observacao: "Evento corporativo: Tiago é o dono do SLA, Daniela é notificada como co-responsável."
    });
    logger.info("Regra criada: Eventos (Holding/Todos) → Tiago Oliveira + Daniela Giuzio");
  }

  // "Outras" (área) de propósito não recebe regra: nasce sem dono, na fila do coordenador.
}

async function main() {
  const tipos = await seedTipos();
  const areas = await seedAreas();
  const analistas = await seedAnalistas();
  await seedRegras(tipos, areas, analistas);
  await seedAcessoDashboardOperacoes(analistas);
  logger.info("Seed concluído.");
}

if (require.main === module) {
  main().catch((err) => {
    logger.error("Falha ao rodar seed", err);
    process.exit(1);
  });
}

module.exports = { main };
