"use strict";

/**
 * Zé, assumo aqui um limite que quero deixar bem claro: trabalho em UTC, não converto
 * de verdade pro fuso de SLA_TIMEZONE. Na prática isso só pega perto da virada do dia —
 * o prazo pode calcular com um dia de diferença do que seria no horário de Brasília.
 * Deixei assim pra v1 porque resolver fuso horário direito ia puxar uma lib (tipo
 * date-fns-tz) e não achei que valia a complexidade antes de validar o resto. Se isso
 * incomodar na prática, é o primeiro ponto que eu mexeria.
 *
 * Outro detalhe que não é óbvio: "N dias úteis a partir de X" NÃO conta o dia X — conta a
 * partir do dia seguinte. É assim que a área de Comunicação Interna definiu o prazo no
 * briefing que me passaram, então segui a leitura deles.
 */

function isFimDeSemana(date) {
  const dia = date.getUTCDay();
  return dia === 0 || dia === 6;
}

function isFeriado(date, feriadosSet) {
  return feriadosSet.has(date.toISOString().slice(0, 10));
}

/** @param {Date|string} dataBase @param {number} dias @param {string[]} feriados datas 'YYYY-MM-DD' */
function somarDiasUteis(dataBase, dias, feriados = []) {
  const feriadosSet = new Set(feriados);
  const resultado = new Date(dataBase);
  let restantes = dias;
  while (restantes > 0) {
    resultado.setUTCDate(resultado.getUTCDate() + 1);
    if (!isFimDeSemana(resultado) && !isFeriado(resultado, feriadosSet)) {
      restantes -= 1;
    }
  }
  return resultado;
}

function somarDiasCorridos(dataBase, dias) {
  const resultado = new Date(dataBase);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

/** @param {{slaDias:number, slaContaDiasUteis:boolean}} tipo */
function calcularPrazo(tipo, dataInicioSla, feriados = []) {
  const base = new Date(dataInicioSla);
  return tipo.slaContaDiasUteis ? somarDiasUteis(base, tipo.slaDias, feriados) : somarDiasCorridos(base, tipo.slaDias);
}

module.exports = { somarDiasUteis, somarDiasCorridos, calcularPrazo, isFimDeSemana };
