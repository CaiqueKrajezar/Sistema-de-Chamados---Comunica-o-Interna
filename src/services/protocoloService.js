"use strict";

function formatarProtocolo(ano, numero) {
  return `CI-${ano}-${String(numero).padStart(4, "0")}`;
}

module.exports = { formatarProtocolo };
