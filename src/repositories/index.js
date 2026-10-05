"use strict";

/**
 * Zé, deixei essa lista aqui de propósito como referência rápida — é o contrato que
 * `src/db/sqlite/repositories/*` e `src/db/oracle/repositories/*` têm que implementar
 * igualzinho, função por função, mesmo formato de retorno. O resto da aplicação (rotas,
 * domain/) só conhece isso aqui, nunca SQL nem qual driver tá ativo. Se um dia for
 * mexer em algum repositório Oracle, usa isso como checklist do que precisa existir.
 *
 * tipoSolicitacao: { listarAtivos(), buscarPorId(id), buscarPorNome(nome), criar(dados) }
 * area:            { listarAtivas(), buscarPorId(id), buscarPorNome(nome), criar(dados) }
 * analista:        { listarAtivos(), buscarPorId(id), buscarPorEmail(email),
 *                    buscarPorKeycloakSubject(sub), criar(dados), atualizarKeycloakSubject(id, sub) }
 * regraRoteamento: { listarComPublicos({ apenasAtivas }), buscarPorId(id),
 *                    buscarCandidatas({ publico, areaId, tipoSolicitacaoId }),
 *                    criar(dados), atualizar(id, dados), desativar(id, atualizadoPor) }
 * chamado:         { buscarPorId(id), buscarPorProtocolo(protocolo), listar({ status, analistaId, limit }),
 *                    criar(dados), atualizarStatus(id, novoStatus, alteradoPor, observacao),
 *                    reatribuir(id, analistaPrincipalId), aprovar(id, { dataInicioSla, dataPrazo }),
 *                    incrementarContadorRevisao(id, tipoRevisao) }
 * anexo:           { criar(dados), listarPorChamado(chamadoId), buscarPorId(id), contarPorChamado(chamadoId) }
 * revisao:         { listarPorChamado(chamadoId), contarPorTipo(chamadoId, tipoRevisao), criar(dados) }
 * notificacao:     { criar(dados), listarPendentes(limit), listarRecentes(limit), marcarEnviada(id), marcarFalha(id, erro) }
 * historico:       { listarPorChamado(chamadoId) }
 *
 * Todos os campos são camelCase em JS; a conversão para snake_case/Oracle fica dentro de cada
 * implementação de driver.
 */
module.exports = require("../db");
