-- Espelho SQLite de 003_pergunta_derivada.sql (Oracle)
--
-- Perguntas "faseadas" do Checklist Fácil: quando uma pergunta Sim/Não é respondida de um
-- certo jeito (normalmente Sim), o app libera uma pergunta seguinte (texto livre/categórica)
-- só pra detalhar a resposta — ex. "A Loja possui a comunicação do Programa Vida Plena e
-- Canal de Ética?" (Sim/Não) libera "Informe se a Loja possui as duas comunicações, uma ou
-- nenhuma." (As duas comunicações / Somente Programa Vida Plena / Somente Canal de Ética).
-- `indicador_pai` guarda o texto da pergunta Sim/Não que "libera" essa pergunta derivada,
-- pra o dashboard conseguir mostrar a quebra de respostas dela junto da pergunta principal.

ALTER TABLE visita_loja_indicador ADD COLUMN indicador_pai TEXT;
CREATE INDEX ix_visita_indicador_pai ON visita_loja_indicador(indicador_pai);
