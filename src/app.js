"use strict";

const express = require("express");
const path = require("node:path");
const cookieParser = require("cookie-parser");
const { carregarSessao, requirePagina } = require("./auth/middleware");
const { errorHandler } = require("./middlewares/errorHandler");

const authRoutes = require("./routes/auth.routes");
const publicoRoutes = require("./routes/publico.routes");
const chamadosRoutes = require("./routes/chamados.routes");
const anexosRoutes = require("./routes/anexos.routes");
const reatribuicaoRoutes = require("./routes/reatribuicao.routes");
const regrasRoteamentoRoutes = require("./routes/regrasRoteamento.routes");
const analistasRoutes = require("./routes/analistas.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const visitasLojaRoutes = require("./routes/visitasLoja.routes");

const app = express();
app.disable("x-powered-by");
app.use(cookieParser());
app.use(carregarSessao);

app.use("/auth", authRoutes);
app.use("/api", publicoRoutes); // GET /api/tipos-solicitacao, GET /api/areas, POST /api/chamados (público)
// anexosRoutes vem ANTES de chamadosRoutes de propósito: chamadosRoutes aplica requireAuth pra
// todo o prefixo /api/chamados/* (router.use), então se viesse primeiro barraria o upload público
// de anexo antes mesmo de checar se a rota é essa.
app.use("/api/chamados", anexosRoutes); // POST/GET /:id/anexos (upload é público — parte do fluxo de abertura)
app.use("/api/chamados", chamadosRoutes); // GET/listar, GET/:id, status, aprovar, revisões (autenticado)
app.use("/api/chamados", reatribuicaoRoutes); // PATCH /:id/reatribuir (supervisor)
app.use("/api/regras-roteamento", regrasRoteamentoRoutes);
app.use("/api/analistas", analistasRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/visitas-loja", visitasLojaRoutes);

// Páginas do analista exigem sessão, exceto a própria tela de login. Depois desse gate,
// express.static entrega o HTML normalmente.
app.get(/^\/analista\/(?!login\.html).*\.html$/, requirePagina, (req, res, next) => next());
app.use(express.static(path.join(__dirname, "..", "public")));

app.use((req, res) => res.status(404).json({ erro: "Não encontrado." }));
app.use(errorHandler);

module.exports = app;
