"use strict";

function novoChamado({ chamado, tipoNome, coResponsavel }) {
  const assunto = `Novo chamado ${chamado.protocolo} — ${tipoNome}`;
  const corpo =
    `Um novo chamado foi aberto e roteado ${coResponsavel ? "para você como co-responsável" : "para você"}.\n\n` +
    `Protocolo: ${chamado.protocolo}\n` +
    `Tipo: ${tipoNome}\n` +
    `Solicitante: ${chamado.solicitanteNome || "Não identificado"}\n` +
    `Descrição: ${chamado.descricao || "(briefing de evento — ver detalhes no painel)"}\n\n` +
    "Acesse o painel para mais detalhes.";
  return { assunto, corpo };
}

function reatribuicao({ chamado, tipoNome }) {
  return {
    assunto: `Chamado ${chamado.protocolo} reatribuído para você`,
    corpo: `O chamado ${chamado.protocolo} (${tipoNome}) foi reatribuído para você pelo coordenador. Acesse o painel para mais detalhes.`
  };
}

function aprovacaoPendente({ chamado, tipoNome }) {
  return {
    assunto: `Aprovação pendente — chamado ${chamado.protocolo}`,
    corpo:
      `O chamado ${chamado.protocolo} (${tipoNome}) precisa da sua aprovação antes que o prazo de atendimento comece a contar.\n\n` +
      `Descrição: ${chamado.descricao || ""}`
  };
}

function aprovado({ chamado, tipoNome, analistaNome }) {
  return {
    assunto: `Chamado ${chamado.protocolo} aprovado — prazo iniciado`,
    corpo: `O briefing do chamado ${chamado.protocolo} (${tipoNome}) foi aprovado. O prazo de atendimento de ${analistaNome} começou a contar a partir de agora.`
  };
}

module.exports = { novoChamado, reatribuicao, aprovacaoPendente, aprovado };
