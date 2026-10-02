-- Schema inicial (espelho SQLite de src/db/oracle/migrations/001_schema.sql)
-- Usado só em desenvolvimento/testes locais (DB_DRIVER=sqlite). Mesmos nomes de
-- tabela/coluna do Oracle; tipos e sintaxe de auto-incremento adaptados ao SQLite.

CREATE TABLE tipo_solicitacao (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                   TEXT NOT NULL UNIQUE,
  sla_dias               INTEGER NOT NULL,
  sla_conta_dias_uteis   TEXT NOT NULL DEFAULT 'S' CHECK (sla_conta_dias_uteis IN ('S','N')),
  requer_briefing_evento TEXT NOT NULL DEFAULT 'N' CHECK (requer_briefing_evento IN ('S','N')),
  ativo                  TEXT NOT NULL DEFAULT 'S' CHECK (ativo IN ('S','N')),
  ordem_exibicao         INTEGER NOT NULL DEFAULT 0,
  criado_em              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado_em          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE area_solicitante (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nome           TEXT NOT NULL UNIQUE,
  ativo          TEXT NOT NULL DEFAULT 'S' CHECK (ativo IN ('S','N')),
  ordem_exibicao INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE analista (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nome             TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  keycloak_subject TEXT,
  papel            TEXT NOT NULL DEFAULT 'analista' CHECK (papel IN ('analista','supervisor')),
  cor              TEXT NOT NULL DEFAULT '#3b6fd4',
  ativo            TEXT NOT NULL DEFAULT 'S' CHECK (ativo IN ('S','N')),
  criado_em        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE regra_roteamento (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  area_id                INTEGER REFERENCES area_solicitante(id),
  tipo_solicitacao_id    INTEGER REFERENCES tipo_solicitacao(id),
  analista_principal_id  INTEGER NOT NULL REFERENCES analista(id),
  analista_secundario_id INTEGER REFERENCES analista(id),
  responsavel_sla        TEXT NOT NULL DEFAULT 'PRINCIPAL' CHECK (responsavel_sla IN ('PRINCIPAL','SECUNDARIO')),
  prioridade             INTEGER NOT NULL DEFAULT 0,
  ativo                  TEXT NOT NULL DEFAULT 'S' CHECK (ativo IN ('S','N')),
  observacao             TEXT,
  atualizado_por         TEXT,
  atualizado_em          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE regra_roteamento_publico (
  regra_id INTEGER NOT NULL REFERENCES regra_roteamento(id) ON DELETE CASCADE,
  publico  TEXT NOT NULL CHECK (publico IN ('Holding','Operacao-Lojas','Operacao-CD','Todos')),
  PRIMARY KEY (regra_id, publico)
);

CREATE TABLE contador_protocolo (
  ano           INTEGER PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE chamado (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  protocolo                 TEXT NOT NULL UNIQUE,
  publico                   TEXT NOT NULL CHECK (publico IN ('Holding','Operacao-Lojas','Operacao-CD','Todos')),
  area_id                   INTEGER REFERENCES area_solicitante(id),
  tipo_solicitacao_id       INTEGER NOT NULL REFERENCES tipo_solicitacao(id),
  solicitante_nome          TEXT,
  solicitante_email         TEXT,
  solicitante_local_texto   TEXT,
  publico_alvo_conteudo     TEXT CHECK (publico_alvo_conteudo IN ('Escritorio_SP','Lojas','CD')),
  descricao                 TEXT,
  conteudo_pronto_ref       TEXT NOT NULL DEFAULT 'N' CHECK (conteudo_pronto_ref IN ('S','N')),
  conteudo_pronto_ref_texto TEXT,
  analista_principal_id     INTEGER REFERENCES analista(id),
  analista_secundario_id    INTEGER REFERENCES analista(id),
  status                    TEXT NOT NULL DEFAULT 'aguardando_aprovacao'
                             CHECK (status IN ('aguardando_aprovacao','novo','em_andamento','em_revisao',
                                                'aguardando_solicitante','resolvido','cancelado')),
  data_abertura             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  data_inicio_sla           TEXT,
  data_prazo                TEXT,
  data_resolucao            TEXT,
  sla_dias_snapshot         INTEGER,
  sla_conta_uteis_snapshot  TEXT,
  segundo_aprovador_nome    TEXT,
  segundo_aprovador_email   TEXT,
  aprovacao_status          TEXT NOT NULL DEFAULT 'nao_aplicavel'
                             CHECK (aprovacao_status IN ('nao_aplicavel','pendente','aprovado','rejeitado')),
  ciencia_sla               TEXT NOT NULL DEFAULT 'N' CHECK (ciencia_sla IN ('S','N')),
  contador_revisao_conteudo INTEGER NOT NULL DEFAULT 0,
  contador_revisao_design   INTEGER NOT NULL DEFAULT 0,
  chamado_origem_id         INTEGER REFERENCES chamado(id),
  criado_em                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado_em             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX ix_chamado_status ON chamado(status);
CREATE INDEX ix_chamado_analista_principal ON chamado(analista_principal_id);
CREATE INDEX ix_chamado_prazo ON chamado(data_prazo);

CREATE TABLE chamado_evento_detalhe (
  chamado_id                       INTEGER PRIMARY KEY REFERENCES chamado(id) ON DELETE CASCADE,
  nome_evento                      TEXT NOT NULL,
  responsavel_nome                 TEXT NOT NULL,
  responsavel_area                 TEXT,
  responsavel_email                TEXT NOT NULL,
  responsavel_telefone             TEXT,
  objetivo                         TEXT,
  publico_evento                   TEXT,
  qtd_participantes_estimada       INTEGER,
  data_desejada                    TEXT,
  horario_inicio                   TEXT,
  horario_fim                      TEXT,
  flexibilidade_data               TEXT NOT NULL DEFAULT 'N' CHECK (flexibilidade_data IN ('S','N')),
  local_definido                   TEXT NOT NULL DEFAULT 'N' CHECK (local_definido IN ('S','N')),
  local_texto                      TEXT,
  formato                          TEXT CHECK (formato IN ('presencial','online','hibrido')),
  dinamica_evento                  TEXT,
  identidade_visual_status         TEXT CHECK (identidade_visual_status IN ('definida','nao_definida','em_desenvolvimento')),
  budget_status                    TEXT CHECK (budget_status IN ('disponivel','nao_disponivel','em_aprovacao')),
  budget_valor_estimado            REAL,
  fornecedor_parceiro              TEXT,
  restricoes_observacoes           TEXT,
  checklist_estrutura              TEXT CHECK (checklist_estrutura IS NULL OR json_valid(checklist_estrutura)),
  checklist_materiais_comunicacao  TEXT CHECK (checklist_materiais_comunicacao IS NULL OR json_valid(checklist_materiais_comunicacao)),
  checklist_escopo_esperado        TEXT CHECK (checklist_escopo_esperado IS NULL OR json_valid(checklist_escopo_esperado))
);

CREATE TABLE anexo (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  chamado_id       INTEGER NOT NULL REFERENCES chamado(id) ON DELETE CASCADE,
  nome_original    TEXT NOT NULL,
  nome_armazenado  TEXT NOT NULL,
  caminho_relativo TEXT NOT NULL,
  mime_type        TEXT,
  tamanho_bytes    INTEGER NOT NULL,
  checksum_sha256  TEXT,
  enviado_por      TEXT,
  enviado_em       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_anexo_chamado ON anexo(chamado_id);

CREATE TABLE anexo_conteudo (
  anexo_id INTEGER PRIMARY KEY REFERENCES anexo(id) ON DELETE CASCADE,
  conteudo BLOB NOT NULL
);

CREATE TABLE revisao (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  chamado_id        INTEGER NOT NULL REFERENCES chamado(id) ON DELETE CASCADE,
  tipo_revisao      TEXT NOT NULL CHECK (tipo_revisao IN ('conteudo','design')),
  numero_sequencial INTEGER NOT NULL,
  solicitado_por    TEXT,
  descricao         TEXT,
  criado_em         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_revisao_chamado ON revisao(chamado_id);

CREATE TABLE notificacao (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  chamado_id         INTEGER REFERENCES chamado(id) ON DELETE CASCADE,
  analista_id        INTEGER REFERENCES analista(id),
  destinatario_email TEXT NOT NULL,
  tipo_evento        TEXT NOT NULL,
  assunto            TEXT NOT NULL,
  corpo              TEXT,
  status_envio       TEXT NOT NULL DEFAULT 'pendente' CHECK (status_envio IN ('pendente','enviado','falha')),
  tentativas         INTEGER NOT NULL DEFAULT 0,
  erro_mensagem      TEXT,
  criado_em          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  enviado_em         TEXT
);
CREATE INDEX ix_notificacao_status ON notificacao(status_envio);

CREATE TABLE historico_status (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  chamado_id      INTEGER NOT NULL REFERENCES chamado(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo     TEXT NOT NULL,
  alterado_por    TEXT,
  observacao      TEXT,
  alterado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ix_historico_chamado ON historico_status(chamado_id);

CREATE TABLE feriado (
  data      TEXT PRIMARY KEY,
  descricao TEXT
);
