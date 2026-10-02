"use strict";

const repos = require("../../repositories");

/**
 * Resolve o analista dono de um chamado a partir de público × área × tipo.
 * Sem regra correspondente (ex.: área "Outras"), retorna analistaPrincipalId=null —
 * o chamado nasce numa fila "a triar" que só o supervisor resolve, via reatribuição manual.
 */
async function resolverAnalista({ publico, areaId, tipoSolicitacaoId }) {
  const candidatas = await repos.regraRoteamento.buscarCandidatas({ publico, areaId, tipoSolicitacaoId });
  if (!candidatas.length) {
    return { analistaPrincipalId: null, analistaSecundarioId: null, responsavelSla: "PRINCIPAL", regraId: null };
  }

  const [melhor] = candidatas
    .map((regra) => ({
      regra,
      especificidade: (regra.areaId != null ? 1 : 0) + (regra.tipoSolicitacaoId != null ? 1 : 0)
    }))
    .sort((a, b) => b.regra.prioridade - a.regra.prioridade || b.especificidade - a.especificidade);

  return {
    analistaPrincipalId: melhor.regra.analistaPrincipalId,
    analistaSecundarioId: melhor.regra.analistaSecundarioId,
    responsavelSla: melhor.regra.responsavelSla,
    regraId: melhor.regra.id
  };
}

module.exports = { resolverAnalista };
