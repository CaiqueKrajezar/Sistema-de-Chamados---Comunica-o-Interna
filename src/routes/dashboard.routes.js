"use strict";

const express = require("express");
const repos = require("../repositories");
const { requireRole } = require("../auth/middleware");
const { metricas, estaAtrasado } = require("../domain/sla/slaStatus");

const router = express.Router();
router.use(requireRole("supervisor"));

router.get("/", async (req, res, next) => {
  try {
    const [chamados, analistas] = await Promise.all([repos.chamado.listar({}), repos.analista.listarAtivos()]);
    const agora = new Date();
    const m = metricas(chamados, analistas, agora);
    const atrasados = chamados.filter((c) => estaAtrasado(c, agora));
    res.json({ ...m, atrasados });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
