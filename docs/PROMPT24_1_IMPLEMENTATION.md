> Registro histórico da missão 24.1. A revisão atual da 031 e os riscos estão em [24.2.1](PROMPT24_2_1_IMPLEMENTATION.md) e [matriz atual](PROMPT24_2_1_RISK_MATRIX.md). Evidências antigas não representam automaticamente o novo HEAD.

# KYRVEN — Missão 24.1: implementação e evidências

Data de início: 11/10/2026, Brasília. Base imutável: `573c7aa9f93814a5dcfc77dad59598b6732bc9a7`, branch `feat/staging-foundation`, PR #22 aberta/draft/sem merge. Branch de trabalho: `feat/rpc-quotas-auth-readiness`, derivada dessa base, sem uso de main.

## Escopo efetivamente executado

Leitura integral dos cinco documentos e manifesto da transferência, com todos os hashes e tamanhos conferidos. GitHub confirmou HEAD e estado da PR #22. A execução histórica [38171871057](https://github.com/sallumm/fortnite-competitive-platform/actions/runs/38171871057) foi aprovada no SHA de código `bd819a3e65a0b29e71309450b441f08f4b9d7262`; os logs confirmam 388 Vitest e 81 Playwright. Não atribuir essa execução ao HEAD documental posterior.

Foi criado apenas um container local descartável `kyrven-m24-1-pg`, com imagem Supabase PostgreSQL 17.11.0.004, digest fixado na CI, `--network none`, sem publicação de portas ou volumes de dados do titular. Cada execução cria banco novo com fixtures sintéticas. A montagem de auth.users/auth.uid é mínima: NÃO executa GoTrue, PostgREST, JWT real, SMTP, MFA ou Storage hospedado. Os dois processos psql mutadores são conexões PostgreSQL independentes; um terceiro observador lê pg_stat_activity para confirmar o ponto de interleaving.

Não houve consulta nem escrita no Supabase hospedado. O único alvo futuro admissível continua `kyrven-staging2`, ref `hqhkaewpkkgpagcvgfmb`, organização `hdmpqaxbbfzxzitcjpub`; o projeto antigo não foi utilizado. Instalação 001–030 foi feita SOMENTE em bancos novos do container de teste, nunca repetida no staging. Não houve deploy, configuração Auth/SMTP/CAPTCHA/Cloudflare/DNS, criação de conta hospedada, IA externa, pagamento, recrutamento ou merge.

## Correções SQL — migration 031

Arquivo único: `supabase/migrations/202610120031_rpc_quotas_auth_readiness.sql`. O nome mantém a convenção sequencial explicitada na transferência. A CLI Supabase não estava no PATH; não foi instalado/vinculado um projeto nem gerada uma migration com timestamp incompatível com essa convenção. Os 30 arquivos históricos permanecem byte a byte iguais aos blobs Git da base, conforme `scripts/migrations-001-030.sha256.json` e `scripts/mission24-integrity.mjs`.

| Achado / fronteira           | Antes na base 030                                         | Depois na 031                                                                                                    | Evidência                                                                                |
| ---------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| RPC-01 esports_withdraw      | Duas retiradas geravam dois eventos/auditorias            | Uma transição/evento/auditoria; repetições não aumentam versão/histórico; ainda revogam grants residuais         | PostgreSQL nativo; outro proprietário/anon negados                                       |
| RPC-02 Academy               | 121ª operação era negada, mas voltava a passar após clear | Contador privado mantém consumo após clear; 121ª negada                                                          | PostgreSQL nativo + regressão PGlite                                                     |
| RPC-03 Coach                 | DELETE próprio liberava a 61ª proposta                    | DELETE preservado; contador privado impede reset                                                                 | PostgreSQL nativo; quotas externas intocadas                                             |
| Academy via learning journey | Mesma fronteira academy_records, quota deletável          | Trigger comum também reserva para inserts de record_learning_journey                                             | Fronteira autoritativa compartilhada; regressões existentes de journeys                  |
| NULL em purge                | Admin+AAL2 podia passar confirmação NULL                  | IS DISTINCT FROM exige frase exata                                                                               | PostgreSQL nativo: NULL/AAL1 negados; confirmação correta+AAL2 aceita                    |
| NULL em versões              | <> permitia escapar de alguns IF                          | IS DISTINCT FROM em seis definições afetadas, incluindo internals privados                                       | Native admin/development; PGlite editorial/assessment/exam; stale e positivas existentes |
| Aceitação × retirada         | Aceitação reativava status/grants depois da retirada      | Profile→application→scholarship; retirada revoga scholarship/cargos/benefícios e conserva status final withdrawn | Mesmo interleaving nativo antes/depois                                                   |

### Quotas e privacidade

`private.resource_quota` contém no máximo duas linhas por usuário. Cada linha armazena apenas a chave de finalidade e um array limitado de timestamps de consumo: 120 para Academy e 60 para propostas Coach. Não há conteúdo, resposta, pergunta, nota, e-mail, IP ou segredo. As janelas são móveis de uma hora/24 horas, preservando a semântica anterior, sem rajada na virada de uma janela UTC fixa.

INSERT ON CONFLICT + SELECT FOR UPDATE serializam a mesma chave. O horário é medido depois da espera com clock_timestamp; a limpeza do histórico não toca esse estado. Triggers AFTER INSERT em academy_records e coach_actions tornam a reserva transacional: erros de validação/inserção ou rollback posterior não consomem ação. Permanecem as checagens históricas de contagem como proteção adicional; não foram reescritas as RPCs de Coach/Academy nem coach_usage/coach_global_usage.

O backfill usa somente linhas recentes ainda existentes, limitado ao teto de cada finalidade. Consumo já apagado antes da 031 não é recuperável; não existe reconstrução inventada desse histórico. O ensaio incremental 030→031 confirma backfill com consumo anterior visível e igualdade das ACLs de todas as funções existentes.

RLS ativada; sem policies nem CRUD para clientes. Os dois helpers novos têm search_path vazio e EXECUTE revogado de PUBLIC/anon/authenticated. CREATE OR REPLACE conserva as ACLs anteriores, verificadas por comparação nativa. Catálogo de aplicação esperado após 031: **95 tabelas, 147 funções, 131 policies**. As cinco policies Storage do ambiente hospedado não são certificadas pelo catálogo PGlite/minimal auth local.

Timestamps expirados são descartados na próxima operação. `private.prune_resource_quota()` permite manutenção somente pelo operador privilegiado; nenhuma agenda remota foi criada. Sem esse job, uma conta inativa pode manter timestamps expirados fisicamente armazenados, embora não contem para a quota e o tamanho seja limitado. Configurar/autorizar retenção física em etapa posterior. Exclusão de auth.users faz cascade de todos os contadores; limpar dados de produto continua permitido.

### Retirada e quotas de esports

Não se impôs um limite que possa impedir retirada de consentimento. Cada candidatura pode emitir somente uma transição de retirada; repetições preservam possibilidade de reconciliar revogação de grants, sem novo evento/auditoria. Não alterar indiscriminadamente a quota administrativa anterior ou paginar/exportar silenciosamente apenas parte dos dados. A paginação residual de histórico/ciclos/bolsas/objetivos/revisões continua identificada em KYR-022.

## Investigação nativa de concorrência

Fixture: candidatura adulta development_offered, bolsa offered com materials, usuário sintético próprio. Instrumentação exclusiva do ensaio: BEFORE UPDATE de scholarship com pg_sleep(2), somente quando offered→accepted. O observador confirmou a aceitação em PgSleep após os guardas originais. Em seguida, uma segunda conexão executou retirada ou solicitação de exclusão. O trigger de instrumentação é removido depois de cada cenário e não integra a migration.

| Caso                                         | Base 030                                                                            | Após 031                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------- |
| accept × withdraw                            | development_active; 1 cargo e 1 benefício não revogados: corrida reproduzida        | withdrawn; zero cargos/benefícios não revogados |
| accept × request_erasure                     | withdrawn; zero cargos/benefícios não revogados: não reproduzida nesse interleaving | Mesma invariante preservada                     |
| retirar antes de aceitar                     | Participação retirada torna oferta indisponível                                     | Aceitação negada; scholarship revogada          |
| Duas conexões disputam última vaga Academy   | Controle anterior depende de linhas apagáveis                                       | 1 sucesso, 1 recusa; consumo final 120          |
| Duas conexões disputam última proposta Coach | Controle anterior depende de linhas apagáveis                                       | 1 sucesso, 1 recusa; consumo final 60           |

A solicitação de exclusão anterior insere linha com FK para profile enquanto a aceitação mantém FOR UPDATE desse profile; isso serializou o caso observado. Não afirmar prova de ausência de todas as corridas. A investigação não encerra concorrência administrativa not_selected/revoke/extend, que pode exigir revisão adicional da ordem de locks e tratamento de deadlock. PostgreSQL aborta uma transação em deadlock; não se demonstrou bypass durável nessa variante.

## Auth / convite e MFA

Defeito de UI reproduzido por inspeção e testes locais: sessão com `type=invite` não entrava no modo update e era encaminhada a /security. A nova identificação usa parâmetros exatos de recovery/invite; callbacks de erro não selecionam o fluxo. O marcador é capturado ANTES da criação do client, pois detectSessionInUrl pode consumir o fragmento. É apenas estado de UI, nunca prova de autorização.

Sem sessão, updateUser não é chamado; falha mantém formulário, sucesso limpa o marcador e passa por /security preservando o destino validado. Não há auto-confirmação de e-mail, alteração server-side de signup, criação de usuário ou dispensa de MFA. O SDK e o servidor continuam responsáveis por token/sessão válidos. Mocks cobrem convite/recovery, fragmento já removido, ausência de sessão, erros e marcador exato.

`acceptance/auth.config.ts` e `auth.spec.ts` preparam futura aceitação real, excluída da CI/offline E2E e NÃO executada nesta missão. O config exige aprovação separada explícita vinculada ao ref correto e origem HTTPS privada exata. Só aceita chave pública/legacy anon; não cria contas/fatores nem envia recovery e-mail. Cenários: A/B sintéticos já preparados, CAPTCHA, leitura cruzada negativa, AAL1 negado, challenge/verify de fator existente, AAL2/security_status, logout, duas abas reais via storageState privado e callback de convite/recovery fornecido pelo operador. Traces/screenshots/vídeos desativados para evitar exposição de sessão/TOTP/links.

Preparação operacional e casos ainda manuais estão em `PROMPT24_1_AUTH_RUNBOOK.md`. Fonte técnica: [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser), [sessões](https://supabase.com/docs/guides/auth/sessions), [TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp). O changelog oficial foi consultado; o endpoint markdown falhou no navegador, e foi utilizado [o índice HTML](https://supabase.com/changelog). Não atribuir validação hospedada a essas consultas documentais.

## Evidências, limitações e recuperação

`artifacts/mission24/native-baseline.json` e `native-patched.json` registram os resultados nativos locais sanitizados. `catalog-pglite.json` é catálogo complementar de SQL embarcado, explicitamente separado do PostgreSQL nativo. `integrity.json` e o manifesto 001–030 registram hashes. A CI gera evidência nova em diretório temporário separado, evitando upload de snapshots versionados como se fossem resultados daquela execução.

Execuções iniciais encontraram: permissões de subprocesso no sandbox; Chromium ausente (instalado depois); conexão ao servidor temporário Docker na CI (corrigida esperando TCP definitivo); expiração do fixture competitivo em 11/10 23:59:59 UTC (teste passa a fixar apenas Date dentro da validade original); e HMR durante uma execução local de Playwright enquanto havia edição de módulos. Essas execuções falhas não equivalem a aprovação. Não foram removidas assertivas, relaxados limites/policies ou aumentados timeouts.

Antes de aplicar 031 remotamente: auditoria independente do diff/semântica/locks, confirmar ref/organização/ledger/backup pós-030, recuperar em ambiente isolado autorizado, conferir hash final e impacto/retensão. 031 é transacional; assertivas interrompem se definições esperadas divergirem. Não reexecutar 001–030, usar db reset ou migration repair. Regressão após commit requer correção incremental revisada (032 ou posterior) ou restauração autorizada de backup adequado; rollback frontend não desfaz SQL. Este documento não fornece autorização de aplicação.

Não há contratação ou custo externo novo: não foram usados projetos adicionais, planos pagos, IA ou SMTP. Execuções CI/armazenamento usam a franquia/configuração existente da conta; não afirmar consumo monetário total zero.
