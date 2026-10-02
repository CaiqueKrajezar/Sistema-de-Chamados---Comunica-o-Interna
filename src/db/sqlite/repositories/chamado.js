"use strict";

const { getDb } = require("../client");
const { formatarProtocolo } = require("../../../services/protocoloService");

function row(r) {
  if (!r) return null;
  return {
    id: r.id,
    protocolo: r.protocolo,
    publico: r.publico,
    areaId: r.area_id,
    tipoSolicitacaoId: r.tipo_solicitacao_id,
    solicitanteNome: r.solicitante_nome,
    solicitanteEmail: r.solicitante_email,
    solicitanteLocalTexto: r.solicitante_local_texto,
    publicoAlvoConteudo: r.publico_alvo_conteudo,
    descricao: r.descricao,
    conteudoProntoRef: r.conteudo_pronto_ref === "S",
    conteudoProntoRefTexto: r.conteudo_pronto_ref_texto,
    analistaPrincipalId: r.analista_principal_id,
    analistaSecundarioId: r.analista_secundario_id,
    status: r.status,
    dataAbertura: r.data_abertura,
    dataInicioSla: r.data_inicio_sla,
    dataPrazo: r.data_prazo,
    dataResolucao: r.data_resolucao,
    slaDiasSnapshot: r.sla_dias_snapshot,
    slaContaUteisSnapshot: r.sla_conta_uteis_snapshot === "S",
    segundoAprovadorNome: r.segundo_aprovador_nome,
    segundoAprovadorEmail: r.segundo_aprovador_email,
    aprovacaoStatus: r.aprovacao_status,
    cienciaSla: r.ciencia_sla === "S",
    contadorRevisaoConteudo: r.contador_revisao_conteudo,
    contadorRevisaoDesign: r.contador_revisao_design,
    chamadoOrigemId: r.chamado_origem_id,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em
  };
}

function eventoDetalheRow(r) {
  if (!r) return null;
  return {
    chamadoId: r.chamado_id,
    nomeEvento: r.nome_evento,
    responsavelNome: r.responsavel_nome,
    responsavelArea: r.responsavel_area,
    responsavelEmail: r.responsavel_email,
    responsavelTelefone: r.responsavel_telefone,
    objetivo: r.objetivo,
    publicoEvento: r.publico_evento,
    qtdParticipantesEstimada: r.qtd_participantes_estimada,
    dataDesejada: r.data_desejada,
    horarioInicio: r.horario_inicio,
    horarioFim: r.horario_fim,
    flexibilidadeData: r.flexibilidade_data === "S",
    localDefinido: r.local_definido === "S",
    localTexto: r.local_texto,
    formato: r.formato,
    dinamicaEvento: r.dinamica_evento,
    identidadeVisualStatus: r.identidade_visual_status,
    budgetStatus: r.budget_status,
    budgetValorEstimado: r.budget_valor_estimado,
    fornecedorParceiro: r.fornecedor_parceiro,
    restricoesObservacoes: r.restricoes_observacoes,
    checklistEstrutura: r.checklist_estrutura ? JSON.parse(r.checklist_estrutura) : [],
    checklistMateriaisComunicacao: r.checklist_materiais_comunicacao ? JSON.parse(r.checklist_materiais_comunicacao) : [],
    checklistEscopoEsperado: r.checklist_escopo_esperado ? JSON.parse(r.checklist_escopo_esperado) : []
  };
}

function buscarEventoDetalhe(db, chamadoId) {
  return eventoDetalheRow(db.prepare("SELECT * FROM chamado_evento_detalhe WHERE chamado_id = ?").get(chamadoId));
}

function buscarPorId(id) {
  const db = getDb();
  const c = row(db.prepare("SELECT * FROM chamado WHERE id = ?").get(id));
  if (!c) return null;
  c.eventoDetalhe = buscarEventoDetalhe(db, id);
  return c;
}

function buscarPorProtocolo(protocolo) {
  const db = getDb();
  const c = row(db.prepare("SELECT * FROM chamado WHERE protocolo = ?").get(protocolo));
  if (!c) return null;
  c.eventoDetalhe = buscarEventoDetalhe(db, c.id);
  return c;
}

function listar({ status, analistaId, limit } = {}) {
  const db = getDb();
  const clauses = [];
  const params = [];
  if (status && status.length) {
    clauses.push(`status IN (${status.map(() => "?").join(",")})`);
    params.push(...status);
  }
  if (analistaId) {
    clauses.push("(analista_principal_id = ? OR analista_secundario_id = ?)");
    params.push(analistaId, analistaId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limitClause = limit ? `LIMIT ${Number(limit)}` : "";
  const rows = db.prepare(`SELECT * FROM chamado ${where} ORDER BY data_abertura DESC ${limitClause}`).all(...params);
  return rows.map(row);
}

function inserirHistorico(db, { chamadoId, statusAnterior, statusNovo, alteradoPor, observacao }) {
  db.prepare(
    `INSERT INTO historico_status (chamado_id, status_anterior, status_novo, alterado_por, observacao)
     VALUES (?, ?, ?, ?, ?)`
  ).run(chamadoId, statusAnterior ?? null, statusNovo, alteradoPor ?? "sistema", observacao ?? null);
}

/**
 * Cria o chamado (+ briefing de evento, se houver) e o protocolo, tudo em uma transação.
 * Espera que o chamador já tenha resolvido `status`/`dataInicioSla`/`dataPrazo`/snapshots de SLA
 * (essa é responsabilidade do domínio — domain/aprovacao e domain/sla —, não do repositório).
 */
function criar(dados) {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const ano = new Date().getFullYear();
    const contador = db.prepare("SELECT ultimo_numero FROM contador_protocolo WHERE ano = ?").get(ano);
    let numero;
    if (!contador) {
      numero = 1;
      db.prepare("INSERT INTO contador_protocolo (ano, ultimo_numero) VALUES (?, ?)").run(ano, numero);
    } else {
      numero = contador.ultimo_numero + 1;
      db.prepare("UPDATE contador_protocolo SET ultimo_numero = ? WHERE ano = ?").run(numero, ano);
    }
    const protocolo = formatarProtocolo(ano, numero);

    const info = db
      .prepare(
        `INSERT INTO chamado (
           protocolo, publico, area_id, tipo_solicitacao_id, solicitante_nome, solicitante_email,
           solicitante_local_texto, publico_alvo_conteudo, descricao, conteudo_pronto_ref,
           conteudo_pronto_ref_texto, analista_principal_id, analista_secundario_id, status,
           data_inicio_sla, data_prazo, sla_dias_snapshot, sla_conta_uteis_snapshot,
           segundo_aprovador_nome, segundo_aprovador_email, aprovacao_status, ciencia_sla
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        protocolo,
        dados.publico,
        dados.areaId ?? null,
        dados.tipoSolicitacaoId,
        dados.solicitanteNome ?? null,
        dados.solicitanteEmail ?? null,
        dados.solicitanteLocalTexto ?? null,
        dados.publicoAlvoConteudo ?? null,
        dados.descricao ?? null,
        dados.conteudoProntoRef ? "S" : "N",
        dados.conteudoProntoRefTexto ?? null,
        dados.analistaPrincipalId ?? null,
        dados.analistaSecundarioId ?? null,
        dados.status,
        dados.dataInicioSla ?? null,
        dados.dataPrazo ?? null,
        dados.slaDiasSnapshot ?? null,
        dados.slaContaUteisSnapshot === false ? "N" : "S",
        dados.segundoAprovadorNome ?? null,
        dados.segundoAprovadorEmail ?? null,
        dados.aprovacaoStatus ?? "nao_aplicavel",
        dados.cienciaSla ? "S" : "N"
      );
    const chamadoId = Number(info.lastInsertRowid);

    if (dados.eventoDetalhe) {
      const ev = dados.eventoDetalhe;
      db.prepare(
        `INSERT INTO chamado_evento_detalhe (
           chamado_id, nome_evento, responsavel_nome, responsavel_area, responsavel_email,
           responsavel_telefone, objetivo, publico_evento, qtd_participantes_estimada, data_desejada,
           horario_inicio, horario_fim, flexibilidade_data, local_definido, local_texto, formato,
           dinamica_evento, identidade_visual_status, budget_status, budget_valor_estimado,
           fornecedor_parceiro, restricoes_observacoes, checklist_estrutura,
           checklist_materiais_comunicacao, checklist_escopo_esperado
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        chamadoId,
        ev.nomeEvento,
        ev.responsavelNome,
        ev.responsavelArea ?? null,
        ev.responsavelEmail,
        ev.responsavelTelefone ?? null,
        ev.objetivo ?? null,
        ev.publicoEvento ?? null,
        ev.qtdParticipantesEstimada ?? null,
        ev.dataDesejada ?? null,
        ev.horarioInicio ?? null,
        ev.horarioFim ?? null,
        ev.flexibilidadeData ? "S" : "N",
        ev.localDefinido ? "S" : "N",
        ev.localTexto ?? null,
        ev.formato ?? null,
        ev.dinamicaEvento ?? null,
        ev.identidadeVisualStatus ?? null,
        ev.budgetStatus ?? null,
        ev.budgetValorEstimado ?? null,
        ev.fornecedorParceiro ?? null,
        ev.restricoesObservacoes ?? null,
        JSON.stringify(ev.checklistEstrutura ?? []),
        JSON.stringify(ev.checklistMateriaisComunicacao ?? []),
        JSON.stringify(ev.checklistEscopoEsperado ?? [])
      );
    }

    inserirHistorico(db, { chamadoId, statusAnterior: null, statusNovo: dados.status, alteradoPor: "sistema", observacao: "Chamado aberto" });

    db.exec("COMMIT");
    return buscarPorId(chamadoId);
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function atualizarStatus(id, novoStatus, alteradoPor, observacao) {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const atual = row(db.prepare("SELECT * FROM chamado WHERE id = ?").get(id));
    if (!atual) throw new Error(`Chamado ${id} não encontrado`);
    const resolvidoEm = novoStatus === "resolvido" ? "strftime('%Y-%m-%dT%H:%M:%fZ','now')" : "data_resolucao";
    db.prepare(
      `UPDATE chamado SET status = ?, data_resolucao = ${resolvidoEm}, atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`
    ).run(novoStatus, id);
    inserirHistorico(db, { chamadoId: id, statusAnterior: atual.status, statusNovo: novoStatus, alteradoPor, observacao });
    db.exec("COMMIT");
    return buscarPorId(id);
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function reatribuir(id, analistaPrincipalId) {
  getDb()
    .prepare("UPDATE chamado SET analista_principal_id = ?, atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
    .run(analistaPrincipalId, id);
  return buscarPorId(id);
}

function aprovar(id, { dataInicioSla, dataPrazo }) {
  getDb()
    .prepare(
      `UPDATE chamado SET status = 'novo', aprovacao_status = 'aprovado', data_inicio_sla = ?, data_prazo = ?,
         atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`
    )
    .run(dataInicioSla, dataPrazo, id);
  return buscarPorId(id);
}

function incrementarContadorRevisao(id, tipoRevisao) {
  const coluna = tipoRevisao === "design" ? "contador_revisao_design" : "contador_revisao_conteudo";
  getDb()
    .prepare(`UPDATE chamado SET ${coluna} = ${coluna} + 1, atualizado_em = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(id);
  return buscarPorId(id);
}

module.exports = {
  buscarPorId,
  buscarPorProtocolo,
  listar,
  criar,
  atualizarStatus,
  reatribuir,
  aprovar,
  incrementarContadorRevisao
};
