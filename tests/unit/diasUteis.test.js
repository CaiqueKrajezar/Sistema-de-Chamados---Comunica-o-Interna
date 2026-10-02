"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { somarDiasUteis, somarDiasCorridos, calcularPrazo } = require("../../src/domain/sla/diasUteis");

test("somarDiasUteis pula fim de semana", () => {
  const base = new Date("2024-01-01T00:00:00Z"); // segunda-feira
  const resultado = somarDiasUteis(base, 5);
  assert.equal(resultado.toISOString().slice(0, 10), "2024-01-08"); // pula sáb 6 e dom 7
});

test("somarDiasUteis pula feriado além do fim de semana", () => {
  const base = new Date("2024-01-01T00:00:00Z");
  const resultado = somarDiasUteis(base, 5, ["2024-01-03"]);
  assert.equal(resultado.toISOString().slice(0, 10), "2024-01-09");
});

test("somarDiasCorridos soma direto, sem pular nada (usado só para Eventos)", () => {
  const base = new Date("2024-01-01T00:00:00Z");
  const resultado = somarDiasCorridos(base, 60);
  assert.equal(resultado.toISOString().slice(0, 10), "2024-03-01"); // 2024 é bissexto
});

test("calcularPrazo despacha por dias úteis quando o tipo pede", () => {
  const base = new Date("2024-01-01T00:00:00Z");
  const prazo = calcularPrazo({ slaDias: 5, slaContaDiasUteis: true }, base);
  assert.equal(prazo.toISOString().slice(0, 10), "2024-01-08");
});

test("calcularPrazo despacha por dias corridos quando o tipo não conta em dias úteis (Eventos)", () => {
  const base = new Date("2024-01-01T00:00:00Z");
  const prazo = calcularPrazo({ slaDias: 60, slaContaDiasUteis: false }, base);
  assert.equal(prazo.toISOString().slice(0, 10), "2024-03-01");
});
