# Prompt 24.2.3 — correções dos bloqueadores da auditoria

Data: 12/10/2026. Branch autorizada: `feat/rpc-quotas-auth-readiness`. PR #23 permanece draft, base `feat/staging-foundation`. Ponto de partida auditado: `48beef82c1fa618b02f0e70f5bc22912d1e7b46e`. Base histórica: `573c7aa9f93814a5dcfc77dad59598b6732bc9a7`.

## Escopo e limites

Foram reproduzidos os quatro achados originais em PostgreSQL descartável e com marcadores fictícios de Auth. A 031 foi revisada, pois ainda não está instalada no projeto correto. As migrations 001–030 permanecem byte a byte idênticas à base. Não houve escrita no Supabase hospedado, execução de Auth hospedado, deploy, merge, alteração de DNS/Cloudflare, contas, SMTP, CAPTCHA ou MFA. Recrutamento, pagamentos e IA paga continuam desabilitados.

O catálogo remoto foi consultado apenas por leitura, no projeto `kyrven-staging2`, ref `hqhkaewpkkgpagcvgfmb`, organização `hdmpqaxbbfzxzitcjpub`: ledger 001–030, sem 031. Os quinze contratos de corpos SQL correspondem a `md5(prosrc)`, owner postgres, SECURITY DEFINER e search_path vazio. MD5 aqui identifica o contrato de fonte; SHA-256 identifica os bytes da migration. ACLs observadas foram reproduzidas localmente antes do upgrade. A execução local não é equivalente a validação de JWT, GoTrue, MFA ou infraestrutura hospedada.

SHA-256 da 031 revisada: `d57ff86403b2a42bbfff05bfebf13db4c16991540a69a89c1d079d09e6b30f9e`.

## A2422-01 — elegibilidade obsoleta no expurgo

A implementação histórica da 027 calculava um array de IDs elegíveis antes de obter locks. A 031 anteriormente auditada não corrigia esse ponto. O teste original mantém uma oferta de bolsa ainda não confirmada e inicia o expurgo em outra conexão. O expurgo espera no lock da candidatura, mas depois usa a decisão anterior e apaga a nova bolsa. Reproduzimos também grants trialist, roster, mudanças de retenção do ciclo, atividade recente e retenção no consentimento.

A correção acrescenta uma barreira transacional comum. Escritores eSports obtêm `pg_advisory_xact_lock_shared(2423,31)` antes dos locks de linhas. O expurgo obtém a forma exclusiva do mesmo par antes de bloquear candidaturas. O helper `esports_write_limit` cobre as ações administrativas, de avaliação e desenvolvimento; retirada, erasure, início/resposta de exame, submit e expiração recebem a barreira nas respectivas entradas. Os contratos anteriores dessas funções são verificados antes da alteração; owners, ACLs, OIDs e propriedades de segurança permanecem preservados.

Depois da espera, o expurgo confirma novamente a autorização administrativa/AAL2, bloqueia as candidaturas em ordem de ID e somente então recalcula a seleção destrutiva. Retenção lê os valores atuais do ciclo e consentimento, atividade da candidatura, bolsas e grants ativos. A barreira permanece até o término da transação, impedindo que escritores participantes alterem essas dependências entre decisão e DELETE. O ramo com `p_user` continua exigindo pedido explícito de erasure; não transforma retenção automática em autorização irrestrita para apagar direitos.

A função aceita somente READ COMMITTED. Também recusa a promoção de um lock compartilhado já mantido pelo próprio backend: a chamada precisa de transação nova, sem uma escrita eSports anterior. Essa restrição evita decisões baseadas no snapshot antigo de REPEATABLE READ/SERIALIZABLE e ciclos de promoção shared→exclusive. O uso de `now()` preserva a referência temporal conservadora da transação, podendo adiar elegibilidade que vença durante a espera.

Os testes usam duas conexões psql de mutação independentes e uma conexão observadora de `pg_stat_activity`, com barreiras verificadas de espera. Testam writer-first e purge-first, dois administradores, outro titular elegível no mesmo lote, dois expurgos concorrentes, retenção do ciclo, consentimento, atividade e revogação de autoridade durante a espera. O novo titular protegido permanece; o outro registro elegível é apagado. Purge-first termina e a oferta posterior é recusada. Confirmação NULL, AAL1, ausência de pedido, isolamentos incompatíveis e promoção de lock são negativos verificáveis.

Limite: advisory locks são cooperativos. SQL privilegiado, jobs externos ou futuras RPCs que escrevam sem adquirir a barreira não ficam automaticamente protegidos. Devem entrar no protocolo ou ser suspensos durante manutenção. A revisão independente deve inventariar todos os escritores. A barreira global pode aumentar a espera; não é uma prova de desempenho sob carga.

Pré-condição de eventual instalação: suspender e drenar também todos os escritores eSports antigos antes de instalar a 031. Uma chamada já executando o corpo da 030 não adquire retroativamente a nova barreira. O lock de Academy/Coach para backfill não comprova essa drenagem de eSports. O upgrade local realizado parte de sessões controladas e não valida rollout com chamadas antigas ainda em execução. Essa janela e a verificação das sessões são requisitos de revisão/autorizações futuras, sem executar manutenção remota nesta missão.

## A2422-02 e A2422-03 — saída privada e ciclo de vida

Reproduzimos `--add-reporter=list`, `PW_TEST_REPORTER=list` e `PW_RUNNER_DEBUG=1` contra cópias da versão auditada, no runtime Playwright 1.64.0 fixado pelo lockfile. Também reproduzimos `error-context.md` com marcadores fictícios em beforeAll, teardown e afterAll. Os wrappers e flags anteriores não bastavam: Playwright Test pode criar artefatos fora do corpo protegido pelo teste. Os caminhos de reporter/debug são resolvidos pelo runner; erros tardios de hooks/fixtures chegam à criação do contexto de erro. O pacote anterior contém os snapshots do runtime examinados; as novas reproduções executam o runtime real instalado.

A solução usa uma arquitetura alternativa, permitida pela missão. `scripts/private-auth.mjs` aplica uma lista explícita de argumentos e controles de ambiente antes de qualquer fixture. Só aceita um cenário sintético conhecido. Rejeita reporter, debug, trace, modo hospedado, NODE_OPTIONS/NODE_DEBUG/DEBUG, variáveis PW*/PLAYWRIGHT* e fixtures KYRVEN_AUTH_TEST_*. PWD é a exceção de ambiente normal. O processo filho recebe somente paths do runtime/SO, diretório temporário próprio, localização do cache do navegador e valores sintéticos permitidos; não herda execArgv, operadores ou credenciais.

O filho usa apenas a API de automação Chromium, sem Playwright Test, TestInfo, reporters, mecanismo de hooks ou anexos automáticos. Contexto não persistente, downloads recusados e requisições de rede abortadas. A URL usada é data: e contém apenas marcador fictício. stdout/stderr do filho são descartados. O canal IPC aceita apenas objetos com chaves exatas `type`, `phase`, `ok`, na ordem esperada. O launcher reconstrói os objetos e exporta somente fases e booleanos permitidos; nunca serializa Error, mensagem, URL, título, token, attachment ou objeto arbitrário.

Falhas em collection, beforeAll, setup, body, teardown, afterAll e cleanup são não zero. Timeout, matcher, console, tentativa de attachment, IPC inválido e crash também são não zero. Sucesso exige sete resultados corretos, exit zero, protocolo válido e remoção do temporário. Há watchdog de quinze segundos; Windows encerra apenas a árvore do filho próprio, POSIX oferece limpeza com SIGTERM e limite adicional de cinco segundos antes de SIGKILL. Falha de limpeza permanece falha e não exporta o diretório. Os testes confirmam remoção nos cenários executados; não se afirma eliminação absoluta de qualquer dado temporário em crash do SO.

O antigo `acceptance/auth.config.ts` agora aborta antes da descoberta de specs e leitura de fixtures. Os cenários SDK hospedados continuam material de preparação, excluídos da CI e impedidos nesse runner. Não foram migrados para uso com credenciais reais nem declarados prontos. Aprovação futura exige adaptar e revisar separadamente os fluxos reais de convite, sessão, logout, propriedade e MFA.

CI executa somente marcadores fictícios. A reprodução antiga fica em temporário descartável fora dos caminhos de upload. Publica exclusivamente `auth-privacy.json` com nomes fixos, fases, booleanos e códigos de saída. Artefatos Playwright públicos foram limitados a `test-results/e2e-public/` e `playwright-report/`, com testDir público e sem specs Auth. Desativar screenshot/trace isoladamente não é a defesa usada.

Limites: launcher pressupõe código/runtime e operador confiáveis. Um preload Node malicioso pode agir antes do JavaScript de validação; alteração do código ou execução direta arbitrária não constitui um cenário autorizado. Nenhuma credencial real deve entrar nesse ambiente até aprovação independente. O navegador pode escrever internals em seu temporário antes da limpeza; isso é isolamento e descarte, não promessa de ausência universal de escrita em disco.

## R2422-04 — exclusão física contida

Reproduzimos 40P01 entre grant e DELETE privilegiado de profile. O grant bloqueia candidatura e depois verifica a FK do profile; o DELETE começa pelo profile e chega à candidatura por cascade. Não há alegação de que todo DELETE privilegiado concorrente ficou seguro.

A operação foi contida por manutenção exclusiva documentada em `PROMPT24_2_3_PHYSICAL_MAINTENANCE.md`, sem nova RPC ou privilégios. Em eventual janela autorizada: suspender todas as origens de escrita, drenar, iniciar transação nova READ COMMITTED, adquirir a barreira exclusiva antes de qualquer row lock, conferir ausência de compartilhados de outros backends e obter ACCESS EXCLUSIVE NOWAIT em todas as tabelas public/private, ordenadas por schema/nome. Conflito aborta antes do DELETE. SQL não cooperativo que já mantenha lock de relação também impede a manutenção. Escritores que chegam depois aguardam a liberação das relações.

Testes grant-first e delete-first passaram sob o protocolo, sem 40P01. Um leitor não cooperativo produz 55P03 e o perfil continua presente. O teste apaga apenas profile sintético; não valida auth.users, GoTrue, Storage ou todas as dependências de conta. Exclusão física hospedada continua proibida. Qualquer timeout, 40P01 ou 40001 exige rollback integral e uma nova avaliação de autorização, drenagem, consentimento, versões/CAS e escopo antes de eventual transação nova. Não há retry cego nem encerramento de sessões de terceiros.

## Regressões, upgrade e reprodução

Os scripts 24/24.2.1 continuam na CI, preservando backfill com writers anteriores, UPSERT versus prune, limites Academy/Coach, último slot, rollback, propriedade, versões NULL/stale, idempotência, retirada/aceitação/erasure e ações administrativas. A 031 não relaxa quotas, AAL2, consentimento ou RLS. A suíte nova compara as propriedades de todas as 145 funções preexistentes e owners/ACL/RLS/políticas das tabelas históricas, além dos quinze contratos hospedados. Falha induzida antes do COMMIT desfaz os objetos novos e a barreira. A instalação sob drift de fonte e writer anterior excedendo timeout já é negativa na regressão 24.2.1.

Contêiner nativo: imagem Supabase Postgres fixada por digest `sha256:06ddc7962e11ab0f4f0334fd05671e97c30ea202f6e6a7113800bd3d6e416108`, sem rede, portas publicadas ou volumes. PostgreSQL 17.11 local, pacote .004; hospedado .003. `KYRVEN_LOCAL_CONTAINER` seleciona somente o contêiner local do executor; não existe URL de conexão remota nesses scripts.

Comandos de reprodução em checkout autorizado, Node e Docker disponíveis:

```text
node scripts/mission24-integrity.mjs
node scripts/mission24-native.mjs --baseline
node scripts/mission24-native.mjs
node scripts/mission2421-native.mjs --baseline-031
node scripts/mission2421-native.mjs
node scripts/mission2423-native.mjs --baseline-2422
node scripts/mission2423-native.mjs
node scripts/mission2423-auth.mjs
npm test
npx tsc -p tsconfig.acceptance.json
npm run test:e2e
npm run build
npm run build:staging
npm run check:staging-artifact
npm run check:security
npm run check:brand
npm audit --audit-level=high
```

Antes, criar um contêiner descartável com o nome default `kyrven-m24-1-pg` ou usar KYRVEN_LOCAL_CONTAINER, conforme o workflow. Nunca executar contra produção/staging hospedados. Os artefatos de entrega registram o HEAD final e a CI correspondente depois do último commit; este documento não pretende referenciar a si mesmo por um hash de commit ainda não existente.

## Revisão independente final

1. Congelar HEAD e SHA da 031; confirmar base, draft, ledger remoto somente por leitura e hashes 001–030.
2. Novo revisor deve repetir as reproduções antes/depois em novo contêiner e examinar todas as entradas de escrita, inclusive cron/backend/SQL privilegiado.
3. Revisar a ordem barreira→actor/profile→candidaturas→dependências, snapshot após espera, pedidos explícitos, AAL2, source guards e ACLs.
4. Adicionar contraprovas próprias: bursts, três ou mais writers, ciclos/consentimento alterados, timeouts, aborts, writers não cooperativos e manutenção já iniciada. Medir duração/custo do bloqueio global.
5. Revisar launcher, mínimos de ambiente/argv, IPC, watchdog/limpeza, configurações inativas e cada upload Actions. Nenhuma credencial real na auditoria.
6. Só após parecer independente, solicitar autorização separada para qualquer instalação hospedada e procedimento real Auth. Esta entrega não concede essa autorização.

Referências técnicas consultadas em 12/10/2026: [isolamento PostgreSQL 17](https://www.postgresql.org/docs/17/transaction-iso.html), [locks PostgreSQL 17](https://www.postgresql.org/docs/17/explicit-locking.html), [API Browser Playwright](https://playwright.dev/docs/api/class-browser), [reporters Playwright](https://playwright.dev/docs/test-reporters). A evidência específica de vazamento vem da execução do runtime 1.64.0 fixado e das reproduções, não de uma garantia geral da documentação pública.
