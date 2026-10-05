"use strict";

const { env } = require("../config/env");

// Zé, esse arquivo aqui é literalmente o "switch" entre os dois bancos. Fiz questão de
// isolar a escolha nesse ponto único — o resto da aplicação nunca importa
// `./sqlite/repositories` nem `./oracle/repositories` direto, só usa `require('../db')`
// (ou `require('../repositories')`, que é só um re-export disso). Na prática isso quer
// dizer: quando vocês trocarem DB_DRIVER=sqlite pra DB_DRIVER=oracle no .env, nenhuma
// linha de rota ou de regra de negócio muda — só troca o módulo que é carregado aqui.
// Pra isso funcionar os dois repositórios (sqlite e oracle) têm que implementar
// exatamente as mesmas funções com o mesmo formato de retorno; o contrato que os dois
// seguem tá descrito em src/repositories/index.js.
module.exports = env.DB_DRIVER === "oracle" ? require("./oracle/repositories") : require("./sqlite/repositories");
