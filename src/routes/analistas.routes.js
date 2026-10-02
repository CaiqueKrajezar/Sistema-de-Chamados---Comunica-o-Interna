"use strict";

const express = require("express");
const repos = require("../repositories");
const { requireAuth } = require("../auth/middleware");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    res.json(await repos.analista.listarAtivos());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
