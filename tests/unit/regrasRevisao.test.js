"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { podeSolicitarRevisao } = require("../../src/domain/revisoes/regrasRevisao");

test("permite revisão de conteúdo até o limite de 2", () => {
  assert.equal(podeSolicitarRevisao({ contadorRevisaoConteudo: 0, contadorRevisaoDesign: 0 }, "conteudo"), true);
  assert.equal(podeSolicitarRevisao({ contadorRevisaoConteudo: 1, contadorRevisaoDesign: 0 }, "conteudo"), true);
  assert.equal(podeSolicitarRevisao({ contadorRevisaoConteudo: 2, contadorRevisaoDesign: 0 }, "conteudo"), false);
});

test("permite revisão de design até o limite de 4", () => {
  assert.equal(podeSolicitarRevisao({ contadorRevisaoConteudo: 0, contadorRevisaoDesign: 3 }, "design"), true);
  assert.equal(podeSolicitarRevisao({ contadorRevisaoConteudo: 0, contadorRevisaoDesign: 4 }, "design"), false);
});

test("rejeita tipo de revisão desconhecido", () => {
  assert.throws(() => podeSolicitarRevisao({ contadorRevisaoConteudo: 0, contadorRevisaoDesign: 0 }, "outro"));
});
