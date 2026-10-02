-- Espelho SQLite de 002_dashboard_operacoes.sql (Oracle)

ALTER TABLE analista ADD COLUMN acesso_dashboard_operacoes TEXT NOT NULL DEFAULT 'N'
  CHECK (acesso_dashboard_operacoes IN ('S','N'));

CREATE TABLE visita_loja_importacao (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  analista_id   INTEGER NOT NULL REFERENCES analista(id),
  nome_arquivo  TEXT,
  total_linhas  INTEGER NOT NULL,
  importado_por TEXT,
  importado_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE visita_loja (
  id                              INTEGER PRIMARY KEY AUTOINCREMENT,
  analista_id                     INTEGER NOT NULL REFERENCES analista(id),
  importacao_id                   INTEGER NOT NULL REFERENCES visita_loja_importacao(id) ON DELETE CASCADE,
  loja_nome                       TEXT NOT NULL,
  cl_nome                         TEXT,
  data_visita                     TEXT,
  resultado_geral_pct             REAL,
  resultado_auditoria_fisica_pct  REAL,
  resultado_entrevista_lider_pct  REAL,
  resultado_validacao_equipe_pct  REAL,
  criado_em                       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_visita_loja_analista ON visita_loja(analista_id);
CREATE INDEX ix_visita_loja_data ON visita_loja(data_visita);
CREATE INDEX ix_visita_loja_cl ON visita_loja(cl_nome);

CREATE TABLE visita_loja_indicador (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  visita_loja_id     INTEGER NOT NULL REFERENCES visita_loja(id) ON DELETE CASCADE,
  pilar              TEXT NOT NULL DEFAULT 'outro'
                      CHECK (pilar IN ('auditoria_fisica','entrevista_lider','validacao_equipe','outro')),
  indicador          TEXT NOT NULL,
  resposta_texto     TEXT,
  resposta_positiva  TEXT CHECK (resposta_positiva IN ('S','N'))
);
CREATE INDEX ix_visita_indicador_visita ON visita_loja_indicador(visita_loja_id);
CREATE INDEX ix_visita_indicador_nome ON visita_loja_indicador(indicador);
