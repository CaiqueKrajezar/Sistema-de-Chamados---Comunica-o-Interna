"use strict";

// Zé, 2 e 4 não são números que eu inventei — veio assim do briefing da Comunicação
// Interna (2 revisões de conteúdo, 4 de design, por chamado). Passado disso o chamado
// não aceita mais revisão; a regra de negócio deles é abrir um chamado novo linkado ao
// de origem (isso é tratado lá na rota, não aqui — esse arquivo só decide se PODE).
const LIMITE_REVISAO_CONTEUDO = 2;
const LIMITE_REVISAO_DESIGN = 4;

function podeSolicitarRevisao(chamado, tipoRevisao) {
  if (tipoRevisao === "conteudo") return chamado.contadorRevisaoConteudo < LIMITE_REVISAO_CONTEUDO;
  if (tipoRevisao === "design") return chamado.contadorRevisaoDesign < LIMITE_REVISAO_DESIGN;
  throw new Error(`tipoRevisao inválido: ${tipoRevisao}`);
}

module.exports = { LIMITE_REVISAO_CONTEUDO, LIMITE_REVISAO_DESIGN, podeSolicitarRevisao };
