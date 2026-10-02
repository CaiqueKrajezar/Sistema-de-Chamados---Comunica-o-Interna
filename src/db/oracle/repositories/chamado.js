"use strict";

const { withConnection, getOracledb, lowerRow, lowerRows } = require("../pool");
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

async function buscarEventoDetalhe(conn, chamadoId) {
  const result = await conn.execute("SELECT * FROM chamado_evento_detalhe WHERE chamado_id = :chamadoId", { chamadoId });
  return eventoDetalheRow(lowerRow(result.rows[0]));
}

async function buscarPorId(id) {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM chamado WHERE id = :id", { id });
    const c = row(lowerRow(result.rows[0]));
    if (!c) return null;
    c.eventoDetalhe = await buscarEventoDetalhe(conn, id);
    return c;
  });
}

async function buscarPorProtocolo(protocolo) {
  return withConnection(async (conn) => {
    const result = await conn.execute("SELECT * FROM chamado WHERE protocolo = :protocolo", { protocolo });
    const c = row(lowerRow(result.rows[0]));
    if (!c) return null;
    c.eventoDetalhe = await buscarEventoDetalhe(conn, c.id);
    return c;
  });
}

async function listar({ status, analistaId, limit } = {}) {
  return withConnection(async (conn) => {
    const clauses = [];
    const binds = {};
    if (status && status.length) {
      const names = status.map((s, i) => `:status${i}`);
      status.forEach((s, i) => (binds[`status${i}`] = s));
      clauses.push(`status IN (${names.join(",")})`);
    }
    if (analistaId) {
      binds.analistaId = analistaId;
      clauses.push("(analista_principal_id = :analistaId OR analista_secundario_id = :analistaId)");
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limitClause = limit ? `FETCH FIRST ${Number(limit)} ROWS ONLY` : "";
    const result = await conn.execute(`SELECT * FROM chamado ${where} ORDER BY data_abertura DESC ${limitClause}`, binds);
    return lowerRows(result.rows).map(row);
  });
}

async function inserirHistorico(conn, { chamadoId, statusAnterior, statusNovo, alteradoPor, observacao }) {
  await conn.execute(
    `INSERT INTO historico_status (chamado_id, status_anterior, status_novo, alterado_por, observacao)
     VALUES (:chamadoId, :statusAnterior, :statusNovo, :alteradoPor, :observacao)`,
    {
      chamadoId,
      statusAnterior: statusAnterior ?? null,
      statusNovo,
      alteradoPor: alteradoPor ?? "sistema",
      observacao: observacao ?? null
    }
  );
}

async function proximoProtocolo(conn) {
  const ano = new Date().getFullYear();
  let sel = await conn.execute("SELECT ultimo_numero FROM contador_protocolo WHERE ano = :ano FOR UPDATE", { ano });
  let numero;
  if (sel.rows.length === 0) {
    await conn.execute("INSERT INTO contador_protocolo (ano, ultimo_numero) VALUES (:ano, 1)", { ano });
    numero = 1;
  } else {
    numero = lowerRow(sel.rows[0]).ultimo_numero + 1;
    await conn.execute("UPDATE contador_protocolo SET ultimo_numero = :numero WHERE ano = :ano", { numero, ano });
  }
  return formatarProtocolo(ano, numero);
}

/**
 * Cria o chamado (+ briefing de evento, se houver) e o protocolo, tudo em uma transação.
 * Espera que o chamador já tenha resolvido status/dataInicioSla/dataPrazo/snapshots de SLA
 * (isso é responsabilidade de domain/aprovacao e domain/sla, não do repositório).
 */
async function criar(dados) {
  const oracledb = getOracledb();
  return withConnection(async (conn) => {
    const protocolo = await proximoProtocolo(conn);

    const result = await conn.execute(
      `INSERT INTO chamado (
         protocolo, publico, area_id, tipo_solicitacao_id, solicitante_nome, solicitante_email,
         solicitante_local_texto, publico_alvo_conteudo, descricao, conteudo_pronto_ref,
         conteudo_pronto_ref_texto, analista_principal_id, analista_secundario_id, status,
         data_inicio_sla, data_prazo, sla_dias_snapshot, sla_conta_uteis_snapshot,
         segundo_aprovador_nome, segundo_aprovador_email, aprovacao_status, ciencia_sla
       ) VALUES (
         :protocolo, :publico, :areaId, :tipoSolicitacaoId, :solicitanteNome, :solicitanteEmail,
         :solicitanteLocalTexto, :publicoAlvoConteudo, :descricao, :conteudoProntoRef,
         :conteudoProntoRefTexto, :analistaPrincipalId, :analistaSecundarioId, :status,
         :dataInicioSla, :dataPrazo, :slaDiasSnapshot, :slaContaUteisSnapshot,
         :segundoAprovadorNome, :segundoAprovadorEmail, :aprovacaoStatus, :cienciaSla
       ) RETURNING id INTO :id`,
      {
        protocolo,
        publico: dados.publico,
        areaId: dados.areaId ?? null,
        tipoSolicitacaoId: dados.tipoSolicitacaoId,
        solicitanteNome: dados.solicitanteNome ?? null,
        solicitanteEmail: dados.solicitanteEmail ?? null,
        solicitanteLocalTexto: dados.solicitanteLocalTexto ?? null,
        publicoAlvoConteudo: dados.publicoAlvoConteudo ?? null,
        descricao: dados.descricao ?? null,
        conteudoProntoRef: dados.conteudoProntoRef ? "S" : "N",
        conteudoProntoRefTexto: dados.conteudoProntoRefTexto ?? null,
        analistaPrincipalId: dados.analistaPrincipalId ?? null,
        analistaSecundarioId: dados.analistaSecundarioId ?? null,
        status: dados.status,
        dataInicioSla: dados.dataInicioSla ?? null,
        dataPrazo: dados.dataPrazo ?? null,
        slaDiasSnapshot: dados.slaDiasSnapshot ?? null,
        slaContaUteisSnapshot: dados.slaContaUteisSnapshot === false ? "N" : "S",
        segundoAprovadorNome: dados.segundoAprovadorNome ?? null,
        segundoAprovadorEmail: dados.segundoAprovadorEmail ?? null,
        aprovacaoStatus: dados.aprovacaoStatus ?? "nao_aplicavel",
        cienciaSla: dados.cienciaSla ? "S" : "N",
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );
    const chamadoId = result.outBinds.id[0];

    if (dados.eventoDetalhe) {
      const ev = dados.eventoDetalhe;
      await conn.execute(
        `INSERT INTO chamado_evento_detalhe (
           chamado_id, nome_evento, responsavel_nome, responsavel_area, responsavel_email,
           responsavel_telefone, objetivo, publico_evento, qtd_participantes_estimada, data_desejada,
           horario_inicio, horario_fim, flexibilidade_data, local_definido, local_texto, formato,
           dinamica_evento, identidade_visual_status, budget_status, budget_valor_estimado,
           fornecedor_parceiro, restricoes_observacoes, checklist_estrutura,
           checklist_materiais_comunicacao, checklist_escopo_esperado
         ) VALUES (
           :chamadoId, :nomeEvento, :responsavelNome, :responsavelArea, :responsavelEmail,
           :responsavelTelefone, :objetivo, :publicoEvento, :qtdParticipantesEstimada, :dataDesejada,
           :horarioInicio, :horarioFim, :flexibilidadeData, :localDefinido, :localTexto, :formato,
           :dinamicaEvento, :identidadeVisualStatus, :budgetStatus, :budgetValorEstimado,
           :fornecedorParceiro, :restricoesObservacoes, :checklistEstrutura,
           :checklistMateriaisComunicacao, :checklistEscopoEsperado
         )`,
        {
          chamadoId,
          nomeEvento: ev.nomeEvento,
          responsavelNome: ev.responsavelNome,
          responsavelArea: ev.responsavelArea ?? null,
          responsavelEmail: ev.responsavelEmail,
          responsavelTelefone: ev.responsavelTelefone ?? null,
          objetivo: ev.objetivo ?? null,
          publicoEvento: ev.publicoEvento ?? null,
          qtdParticipantesEstimada: ev.qtdParticipantesEstimada ?? null,
          dataDesejada: ev.dataDesejada ?? null,
          horarioInicio: ev.horarioInicio ?? null,
          horarioFim: ev.horarioFim ?? null,
          flexibilidadeData: ev.flexibilidadeData ? "S" : "N",
          localDefinido: ev.localDefinido ? "S" : "N",
          localTexto: ev.localTexto ?? null,
          formato: ev.formato ?? null,
          dinamicaEvento: ev.dinamicaEvento ?? null,
          identidadeVisualStatus: ev.identidadeVisualStatus ?? null,
          budgetStatus: ev.budgetStatus ?? null,
          budgetValorEstimado: ev.budgetValorEstimado ?? null,
          fornecedorParceiro: ev.fornecedorParceiro ?? null,
          restricoesObservacoes: ev.restricoesObservacoes ?? null,
          checklistEstrutura: JSON.stringify(ev.checklistEstrutura ?? []),
          checklistMateriaisComunicacao: JSON.stringify(ev.checklistMateriaisComunicacao ?? []),
          checklistEscopoEsperado: JSON.stringify(ev.checklistEscopoEsperado ?? [])
        }
      );
    }

    await inserirHistorico(conn, { chamadoId, statusAnterior: null, statusNovo: dados.status, alteradoPor: "sistema", observacao: "Chamado aberto" });

    const check = await conn.execute("SELECT * FROM chamado WHERE id = :id", { id: chamadoId });
    const c = row(lowerRow(check.rows[0]));
    c.eventoDetalhe = await buscarEventoDetalhe(conn, chamadoId);
    return c;
  });
}

async function atualizarStatus(id, novoStatus, alteradoPor, observacao) {
  return withConnection(async (conn) => {
    const atualResult = await conn.execute("SELECT * FROM chamado WHERE id = :id", { id });
    const atual = row(lowerRow(atualResult.rows[0]));
    if (!atual) throw new Error(`Chamado ${id} não encontrado`);

    await conn.execute(
      `UPDATE chamado SET status = :status,
         data_resolucao = CASE WHEN :status2 = 'resolvido' THEN SYSTIMESTAMP ELSE data_resolucao END,
         atualizado_em = SYSTIMESTAMP
       WHERE id = :id`,
      { status: novoStatus, status2: novoStatus, id }
    );
    await inserirHistorico(conn, { chamadoId: id, statusAnterior: atual.status, statusNovo: novoStatus, alteradoPor, observacao });

    const check = await conn.execute("SELECT * FROM chamado WHERE id = :id", { id });
    const c = row(lowerRow(check.rows[0]));
    c.eventoDetalhe = await buscarEventoDetalhe(conn, id);
    return c;
  });
}

async function reatribuir(id, analistaPrincipalId) {
  return withConnection(async (conn) => {
    await conn.execute("UPDATE chamado SET analista_principal_id = :analistaPrincipalId, atualizado_em = SYSTIMESTAMP WHERE id = :id", {
      analistaPrincipalId,
      id
    });
    const check = await conn.execute("SELECT * FROM chamado WHERE id = :id", { id });
    const c = row(lowerRow(check.rows[0]));
    c.eventoDetalhe = await buscarEventoDetalhe(conn, id);
    return c;
  });
}

async function aprovar(id, { dataInicioSla, dataPrazo }) {
  return withConnection(async (conn) => {
    await conn.execute(
      `UPDATE chamado SET status = 'novo', aprovacao_status = 'aprovado', data_inicio_sla = :dataInicioSla,
         data_prazo = :dataPrazo, atualizado_em = SYSTIMESTAMP
       WHERE id = :id`,
      { dataInicioSla, dataPrazo, id }
    );
    const check = await conn.execute("SELECT * FROM chamado WHERE id = :id", { id });
    const c = row(lowerRow(check.rows[0]));
    c.eventoDetalhe = await buscarEventoDetalhe(conn, id);
    return c;
  });
}

async function incrementarContadorRevisao(id, tipoRevisao) {
  const coluna = tipoRevisao === "design" ? "contador_revisao_design" : "contador_revisao_conteudo";
  return withConnection(async (conn) => {
    await conn.execute(`UPDATE chamado SET ${coluna} = ${coluna} + 1, atualizado_em = SYSTIMESTAMP WHERE id = :id`, { id });
    const check = await conn.execute("SELECT * FROM chamado WHERE id = :id", { id });
    const c = row(lowerRow(check.rows[0]));
    c.eventoDetalhe = await buscarEventoDetalhe(conn, id);
    return c;
  });
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
