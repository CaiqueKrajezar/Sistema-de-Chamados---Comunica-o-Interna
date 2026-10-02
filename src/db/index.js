"use strict";

const { env } = require("../config/env");

/**
 * Ponto único de escolha de driver. O resto da aplicação nunca importa
 * `./sqlite/repositories` ou `./oracle/repositories` diretamente — sempre
 * `require('../db')` (ou `require('../repositories')`, que só reexporta isto).
 */
module.exports = env.DB_DRIVER === "oracle" ? require("./oracle/repositories") : require("./sqlite/repositories");
