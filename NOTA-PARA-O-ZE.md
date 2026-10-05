# Pro Zé

Fala Zé, beleza? Segue o sistema de chamados da Comunicação Interna que te falei. Já
apresentei pro pessoal e foi bem aceito, então agora é hora de ver com a arquitetura o
que falta pra isso rodar de verdade na infra da empresa. Deixei esse arquivo aqui na raiz
só pra te situar rápido antes de você entrar no código — o README tem o detalhe técnico
completo (variáveis de ambiente, como rodar local, etc.), isso aqui é mais pra contexto e
pra você não perder tempo procurando o que eu já sei que você vai perguntar.

## O problema que isso resolve

A galera da Comunicação Interna recebia pedido de tudo quanto é jeito (Teams, e-mail,
WhatsApp) e não tinha como saber quem ficava responsável por cada um nem quanto tempo
tava demorando. Esse sistema é basicamente: o colaborador abre o chamado numa tela
simples sem precisar logar em nada, o sistema já sabe pra qual analista aquilo vai (por
público + área + tipo de solicitação) e calcula o prazo automaticamente. Os analistas têm
um painel pra trabalhar os chamados deles, e a supervisão tem um dashboard de SLA e pode
reatribuir chamado manualmente quando precisa.

Tem também um dashboard separado de visitas em loja (pro Rafael, que cuida de
Operações/Lojas/CD) — isso é outra funcionalidade, meio independente do resto, que
importa um CSV do Checklist Fácil e mostra os resultados. Não devia impactar o resto do
sistema, mas te aviso porque se você for revisar módulo por módulo, essa parte é
auto-contida (`src/domain/visitasLoja`, `src/db/*/repositories/visitaLoja.js`).

## Por que tá do jeito que tá

Eu não tenho acesso nem ao Oracle nem ao Keycloak da empresa — então não dava pra
desenvolver direto contra eles. O que eu fiz foi deixar os dois pontos (banco e login)
**trocáveis por variável de ambiente**, sem precisar mexer em nenhuma linha de código pra
trocar de um pro outro:

- **Banco**: `DB_DRIVER=sqlite` (o que eu uso aqui pra desenvolver e testar) ou
  `DB_DRIVER=oracle`. As duas implementações ficam em `src/db/sqlite/` e `src/db/oracle/`
  e seguem exatamente o mesmo contrato (mesmas funções, mesmo formato de retorno) —
  então a lógica de negócio (`src/domain/`, `src/routes/`) nunca sabe nem precisa saber
  qual banco tá por trás. Esse contrato tá documentado em `src/repositories/index.js`.
- **Login**: `AUTH_MODE=dev` (uma telinha que lista os analistas e deixa logar em
  qualquer um, só pra eu testar) ou `AUTH_MODE=keycloak` (fluxo OIDC de verdade, com
  PKCE, usando a lib `openid-client`). Isso tá todo em `src/auth/`.

Ou seja: **o código Oracle e o código Keycloak já existem e já estão escritos**, só não
foram testados contra o servidor real porque eu não tinha como. O que falta é só
preencher as variáveis de ambiente (segue o `.env.example`, tá tudo comentado lá) e
validar contra o ambiente de verdade — connection string do Oracle, realm/client do
Keycloak, etc. Se aparecer algum erro específico de integração nessa hora, me chama que a
gente resolve junto, porque sem acesso real eu não tinha como simular 100%.

### Schema do banco

As migrations (`src/db/oracle/migrations/*.sql`) são o DDL completo, já versionado e
numerado. Antes de rodar em produção, faz sentido alguém da DBA dar uma olhada nelas —
são só `CREATE TABLE`/`ALTER TABLE`/`CREATE INDEX` simples, nada exótico, mas é sempre
bom alguém de dentro validar convenção de nome, tablespace, essas coisas que eu não sei
como vocês fazem aqui.

### Coisa que eu mudei até a apresentação

Até a apresentação, a tela pública de abertura de chamado tinha um link pra área do
analista. Tirei isso — não faz sentido o colaborador comum ver essa opção. A tela de
login do analista continua existindo normalmente em `/analista/login.html`, só não tem
mais link visível pra ela na tela pública. Quando integrar com o Keycloak de verdade, essa
URL provavelmente vai ser divulgada só internamente (intranet, e-mail pros analistas, etc.)
— não precisa aparecer pro público geral.

## O que eu acho que falta pra ir pra produção

1. Time de infra sobe o Oracle e passa pra gente `ORACLE_USER`, `ORACLE_PASSWORD`,
   `ORACLE_CONNECT_STRING` (ver `.env.example`) — roda `npm run migrate` apontando pra
   lá, depois `npm run seed` (ou adapta o seed com os analistas/áreas reais, hoje tá com
   dado de exemplo).
2. Time responsável pelo Keycloak cria um client pra essa aplicação, me passa
   `KEYCLOAK_BASE_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`,
   e confirma o nome das roles que vão mapear pra "analista" e "supervisor" (isso é
   configurável, não precisa ser exatamente esse nome).
3. Decidir SMTP de verdade (hoje tá em `MAIL_MODE=console`, só loga no console em vez de
   mandar e-mail — é assim que eu testei).
4. Decidir onde isso vai rodar de fato (servidor interno, container, o que for padrão de
   vocês) — o app é só um processo Node/Express, não tem nada amarrado a nenhuma nuvem
   específica.

Qualquer dúvida de "por que fez assim" eu deixei comentário no código, direto nos
arquivos principais, tentando explicar a decisão e não só o óbvio. Mas se faltar
contexto, me chama que eu explico melhor — valeu Zé!
