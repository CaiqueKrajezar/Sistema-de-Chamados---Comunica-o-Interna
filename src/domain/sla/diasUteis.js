"use strict";

/**
 * Cálculo de prazo em dias úteis/corridos. Trabalha em UTC por simplicidade — uma limitação
 * conhecida para v1 (ver README): perto da virada do dia, o resultado pode variar até um dia
 * em relação ao fuso configurado em SLA_TIMEZONE. Refinar com uma lib de fuso horário
 * (ex.: date-fns-tz) fica como próximo passo se isso importar na prática.
 *
 * "N dias úteis a partir de X" NÃO conta o próprio dia X — conta a partir do dia seguinte,
 * que é a leitura usual desse tipo de prazo em briefing de área de negócio.
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
