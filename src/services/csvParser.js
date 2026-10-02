"use strict";

/** Detecta ; vs , como delimitador — exportações de Excel em pt-BR costumam usar ; (porque a
    vírgula já é o separador decimal). Olha a primeira linha (cabeçalho) pra decidir. */
function detectarDelimitador(primeiraLinha) {
  const qtdVirgula = (primeiraLinha.match(/,/g) || []).length;
  const qtdPontoVirgula = (primeiraLinha.match(/;/g) || []).length;
  return qtdPontoVirgula > qtdVirgula ? ";" : ",";
}

/** Tokeniza um CSV (com suporte a campos entre aspas, inclusive com delimitador/quebra de
    linha dentro do campo) em linhas cruas — array de array de strings, linhas totalmente
    vazias já removidas. Serve de base tanto pra `parseCsv` (um cabeçalho) quanto pra
    formatos com mais de uma linha de cabeçalho (ver src/domain/visitasLoja/importador.js). */
function tokenizarLinhas(texto) {
  const conteudo = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^﻿/, "");
  const primeiraLinha = conteudo.split("\n", 1)[0] || "";
  const delimitador = detectarDelimitador(primeiraLinha);

  const linhas = [];
  let linhaAtual = [];
  let campoAtual = "";
  let dentroDeAspas = false;

  for (let i = 0; i < conteudo.length; i++) {
    const c = conteudo[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (conteudo[i + 1] === '"') {
          campoAtual += '"';
          i++;
        } else {
          dentroDeAspas = false;
        }
      } else {
        campoAtual += c;
      }
    } else if (c === '"') {
      dentroDeAspas = true;
    } else if (c === delimitador) {
      linhaAtual.push(campoAtual);
      campoAtual = "";
    } else if (c === "\n") {
      linhaAtual.push(campoAtual);
      linhas.push(linhaAtual);
      linhaAtual = [];
      campoAtual = "";
    } else {
      campoAtual += c;
    }
  }
  if (campoAtual.length || linhaAtual.length) {
    linhaAtual.push(campoAtual);
    linhas.push(linhaAtual);
  }

  const linhasNaoVazias = linhas
    .filter((l) => l.some((c) => c.trim() !== ""))
    .map((l) => l.map((c) => c.trim()));
  return { linhas: linhasNaoVazias, delimitador };
}

/** Parser CSV simples de um cabeçalho só. Retorna { headers, rows } — rows já vem como
    array de objetos (não serve pra CSV com colunas de nome repetido — ver `tokenizarLinhas`). */
function parseCsv(texto) {
  const { linhas, delimitador } = tokenizarLinhas(texto);
  if (!linhas.length) return { headers: [], rows: [] };

  const headers = linhas[0];
  const rows = linhas.slice(1).map((linha) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = linha[idx] ?? "";
    });
    return obj;
  });
  return { headers, rows, delimitador };
}

module.exports = { parseCsv, tokenizarLinhas, detectarDelimitador };
