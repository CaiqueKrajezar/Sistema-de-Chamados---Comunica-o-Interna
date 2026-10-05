"use strict";

const repos = require("../../repositories");

/**
 * Zé, esse é o motor que decide pra quem vai o chamado. Importante: a matriz de
 * roteamento (público × área × tipo → analista) NÃO tá fixa no código, fica na tabela
 * REGRA_ROTEAMENTO e dá pra editar pela tela do coordenador (regras.html) sem precisar de
 * deploy — foi assim que a área de Comunicação pediu, porque a matriz muda de vez em
 * quando (troca de analista responsável, área nova etc.).
 *
 * Quando mais de uma regra bate (ex.: uma regra genérica de área + uma específica de
 * área+tipo), eu desempato por prioridade primeiro, depois por especificidade (regra com
 * área E tipo definidos ganha de regra só com área). Sem nenhuma regra batendo — caso da
 * área "Outras", por exemplo — o chamado nasce sem dono, numa fila "a triar" que só a
 * coordenação resolve via reatribuição manual. Isso é proposital: prefiro um chamado sem
 * dono E visível, do que ele cair silenciosamente em algum lugar errado.
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
