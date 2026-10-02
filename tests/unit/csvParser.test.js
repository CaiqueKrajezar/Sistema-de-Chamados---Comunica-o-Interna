"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCsv, detectarDelimitador } = require("../../src/services/csvParser");

test("detecta delimitador ; quando é mais frequente que , (padrão BR)", () => {
  assert.equal(detectarDelimitador("Loja;CL;Data"), ";");
  assert.equal(detectarDelimitador("Loja,CL,Data"), ",");
});

test("parseCsv com vírgula", () => {
  const { headers, rows } = parseCsv("Loja,CL,Resultado\nCentro,Luiz,76.92\nSul,Ana,80");
  assert.deepEqual(headers, ["Loja", "CL", "Resultado"]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].Loja, "Centro");
  assert.equal(rows[1].Resultado, "80");
});

test("parseCsv com ponto e vírgula (export BR)", () => {
  const { headers, rows } = parseCsv("Loja;CL;Resultado\nCentro;Luiz;76,92");
  assert.deepEqual(headers, ["Loja", "CL", "Resultado"]);
  assert.equal(rows[0].Resultado, "76,92");
});

test("parseCsv respeita campo entre aspas com delimitador dentro", () => {
  const { rows } = parseCsv('Loja,Obs\n"Loja, Centro","Texto com; ponto e vírgula"');
  assert.equal(rows[0].Loja, "Loja, Centro");
  assert.equal(rows[0].Obs, "Texto com; ponto e vírgula");
});

test("parseCsv ignora linhas totalmente vazias", () => {
  const { rows } = parseCsv("Loja,CL\nCentro,Luiz\n\n\nSul,Ana");
  assert.equal(rows.length, 2);
});
