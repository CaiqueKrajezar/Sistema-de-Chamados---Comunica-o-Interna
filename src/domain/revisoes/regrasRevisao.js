"use strict";

const LIMITE_REVISAO_CONTEUDO = 2;
const LIMITE_REVISAO_DESIGN = 4;

function podeSolicitarRevisao(chamado, tipoRevisao) {
  if (tipoRevisao === "conteudo") return chamado.contadorRevisaoConteudo < LIMITE_REVISAO_CONTEUDO;
  if (tipoRevisao === "design") return chamado.contadorRevisaoDesign < LIMITE_REVISAO_DESIGN;
  throw new Error(`tipoRevisao inválido: ${tipoRevisao}`);
}

module.exports = { LIMITE_REVISAO_CONTEUDO, LIMITE_REVISAO_DESIGN, podeSolicitarRevisao };
