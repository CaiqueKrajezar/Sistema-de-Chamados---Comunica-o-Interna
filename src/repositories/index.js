"use strict";

/**
 * Contrato de repositórios. `src/db/sqlite/repositories/*` e `src/db/oracle/repositories/*`
 * implementam exatamente essas mesmas funções — o resto da aplicação (rotas, domain/) só
 * conhece este contrato, nunca SQL ou o driver escolhido.
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
