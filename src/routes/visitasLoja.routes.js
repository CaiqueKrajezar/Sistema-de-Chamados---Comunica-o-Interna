"use strict";

const express = require("express");
const multer = require("multer");
const path = require("node:path");
const repos = require("../repositories");
const { requireAuth, requireAcessoOperacoes } = require("../auth/middleware");
const { mapearLinhasParaVisitas } = require("../domain/visitasLoja/importador");
const { calcularMetricas } = require("../domain/visitasLoja/metricas");

const router = express.Router();
router.use(requireAuth, requireAcessoOperacoes);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".csv") {
      const err = new Error("Envie um arquivo .csv exportado do Checklist Fácil.");
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

function filtrosDaQuery(query) {
  return {
    desde: query.desde || undefined,
    ate: query.ate || undefined,
    cl: query.cl || undefined,
    loja: query.loja || undefined
  };
}

router.post("/importar", upload.single("arquivo"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ erro: "Nenhum arquivo enviado (campo esperado: arquivo)." });

    const texto = req.file.buffer.toString("utf8");
    const { visitas, colunasReconhecidas, colunasIndicador } = mapearLinhasParaVisitas(texto);
    if (!visitas.length) {
      return res.status(400).json({
        erro: "Nenhuma linha com loja identificada foi encontrada. Confira se o arquivo é o export 'Visita Estruturada' do Checklist Fácil."
      });
    }

    const importacao = await repos.visitaLoja.substituirDataset({
      analistaId: req.sessao.analistaId,
      nomeArquivo: req.file.originalname,
      importadoPor: req.sessao.nome,
      visitas
    });

    const avisos = [];
    if (!colunasReconhecidas.loja) avisos.push("Coluna de loja não identificada.");
    if (!colunasReconhecidas.resultadoGeral) avisos.push("Coluna de resultado geral não identificada — vai faltar no card de média geral.");
    if (!colunasReconhecidas.cl) avisos.push("Coluna de CL não identificada — filtro por CL não vai funcionar.");

    res.status(201).json({
      importacao,
      totalVisitasImportadas: visitas.length,
      colunasReconhecidas,
      colunasTratadasComoIndicador: colunasIndicador,
      avisos
    });
  } catch (err) {
    next(err);
  }
});

router.get("/importacao", async (req, res, next) => {
  try {
    res.json(await repos.visitaLoja.buscarUltimaImportacao(req.sessao.analistaId));
  } catch (err) {
    next(err);
  }
});

router.get("/filtros", async (req, res, next) => {
  try {
    res.json({ cls: await repos.visitaLoja.listarClsDistintos(req.sessao.analistaId) });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    res.json(await repos.visitaLoja.listarPorAnalista(req.sessao.analistaId, filtrosDaQuery(req.query)));
  } catch (err) {
    next(err);
  }
});

router.get("/metricas", async (req, res, next) => {
  try {
    const filtros = filtrosDaQuery(req.query);
    const [visitas, indicadores, ultimaImportacao] = await Promise.all([
      repos.visitaLoja.listarPorAnalista(req.sessao.analistaId, filtros),
      repos.visitaLoja.listarIndicadoresPorAnalista(req.sessao.analistaId, filtros),
      repos.visitaLoja.buscarUltimaImportacao(req.sessao.analistaId)
    ]);
    res.json({ ...calcularMetricas(visitas, indicadores), ultimaImportacao });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
