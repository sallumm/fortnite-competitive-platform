# KYRVEN — Prompt 23.5: implementação e regressões

Data: 11/10/2026. Repositório: sallumm/fortnite-competitive-platform.
Branch: feat/post-audit-hardening. PR #21: draft, sem merge, destino feat/security-hardening-reconstruction.
Base exata: 961783a5317e222938599e64c0632eb8835842a1.
Último código: 3f27145e23f5815c78c871c68cb06092a5301afe.
A revisão final documental está identificada no manifest da entrega. Nenhuma main antiga foi usada.

## Resultado e limites

Os blocos de privacidade, regressões editoriais de MFA, paginação de avaliações e expiração explícita foram implementados e preservados. A matriz conserva 49 achados: 18 corrigidos/verificados localmente, 12 parciais, 6 abertos e 13 externos. Os itens fora das alterações conservam a classificação da auditoria 23; esta missão não substitui uma nova auditoria integral.

KYR-022 permanece parcial. KYR-039/KYR-040 continuam abertos e têm proposta própria fundamentada nos consumidores de dados, conforme a exceção autorizada para refatoração desproporcional. KYR-038 conserva uma lacuna de prova em duas abas reais com Auth/Supabase. KYR-034 agora tem regressões reais, mas não atribuímos uma causa histórica ao teste perdido.

## Implementação por controle

**Privacidade e sessão — KYR-038 / OBS23-004.** A identidade mais AAL do token serve somente como chave de invalidação da UI. O backend continua autorizando via JWT verificado, cargo e AAL2. Transições invalidam imediatamente leituras antigas, estado privado, catálogo não publicado e cópias de componentes. Um epoch remonta consumidores, incluindo editor público de rotina. A geração compartilhada em localStorage impede autosave antigo antes da entrega do evento storage; quota de armazenamento cheia não impede a remoção dos dados existentes.

O provider rejeita getSession inicial atrasado depois de eventos Auth. Respostas de A não reaplicam perfil após B. Checkpoints tardios, mensagens de operações antigas e persistência demo antiga não restauram dados privados. Renovações de token no mesmo usuário/AAL preservam rascunhos e evitam recarga desnecessária.

A revisão independente identificou uma regressão na primeira proposta: storage posterior ao evento Auth deixava a nova conta anônima indefinidamente. O código agora limpa imediatamente e reconcilia getSession pelo SDK; eventos posteriores invalidam essa resposta. A prova da aba receptora usa o provider/editor reais com adaptador Auth controlado. Ela não é prova de duas abas de um Supabase hospedado.

**MFA/editorial — KYR-034.** Testes PGlite executam INSERT, UPDATE e DELETE de public.articles; UPDATE bloqueado retorna zero linhas e preserva conteúdo. AAL2 com cargo permite a operação; perda de AAL2 e remoção de cargo negam alterações. save_meta_draft e publish_meta_draft são exercidos com usuário comum, cargo+AAL1, cargo+AAL2 e downgrade, incluindo integridade de versão/status após negativas. Não alteramos RLS/grants para aprovar testes.

**Administração — KYR-022 / KYR-041.** A migration 030 cria esports_assessment_page, com lotes de 50, ordenação estável com UUID, busca literal antes da paginação e histórico limitado à tentativa selecionada. A autorização por designação/AAL continua no servidor. Controles paginam questões, provas/atribuições, tentativas e revisões; cargos e auditoria passam a ter navegação para seus offsets existentes. A tela conserva campos de revisão não salvos ao carregar outra página de histórico. Bolsas, ciclos e comentários de recrutamento ainda exigem paginação própria.

**Leitura pura — KYR-023.** esports_assessment_admin torna-se STABLE e delega à página inicial. A expiração sai da leitura e passa à ação explícita esports_expire_assessments: cargo+AAL2, perfil bloqueado atomicamente, quota existente, lote até 25 respeitando saldo da janela, designação, row locks/SKIP LOCKED, auditoria e idempotência. Um ator sem a linha que serializa a quota é recusado. Nenhuma tarefa remota/scheduler foi criada.

**Documentação — OBS23-001.** A migration 029 reabre exatamente cinco auxiliares privados para authenticated: team_member, valid_weekdays, valid_competitive_phases, valid_competitive_checklist e valid_skills. A matriz do Prompt 20 foi corrigida; SQL histórico não mudou.

**Regressão de acessibilidade adicional.** O primeiro Playwright local terminou com 80 aprovados/1 falha: contraste transitório 4,49:1 em .badge, tema claro /app/skills. TrainingStepTransition iniciava com opacity 0.8 e clareava texto durante fade. A correção conserva opacity 1, preserva deslocamento no modo completo e evita transição no modo reduzido/essencial. O teste axe original passou no desktop, tablet e mobile após a correção; nenhum limiar foi alterado. Trace, screenshot e contexto da falha foram preservados.

## Validação e evidências

- Vitest final: 385/385 aprovados, 65 arquivos, no código 3f27145. Inclui 9 testes integrados de sessão, 3 de paginação de UI e regressões reais de SQL/RPC.
- Playwright local: primeira tentativa no sandbox não iniciou servidor e foi interrompida; execução local fora do sandbox terminou 80/81. Após correção, 81/81 passaram nos projetos desktop/tablet/mobile (6,1 min).
- Build TypeScript/Vite: aprovado, inclusive após correção visual. Avisos de anotações de dependências não impedem build. Sitemap/prerender opcionais ficaram desativados porque URL pública não existe.
- Static security e brand: aprovados. Catálogo PGlite: 94 tabelas, 131 policies, 145 funções; nenhuma tabela sem RLS ou SECURITY DEFINER sem search_path vazio. Novas RPCs têm EXECUTE somente postgres/authenticated.
- Integridade: 29 migrations históricas comparadas à base; nenhuma diferença Git. Hashes de conteúdo normalizado LF constam em PROMPT23_5_MIGRATION_INTEGRITY.json. Manifesto anterior 001–028 também passou.
- OBS23-002: UI passou isolada, nas suítes completas e em três repetições, com build concorrente na primeira. Nenhum timeout/expectativa alterado. A falha histórica não reproduzida permanece sem causa encerrada.
- GitHub Actions do código final: execução [38169490584](https://github.com/sallumm/fortnite-competitive-platform/actions/runs/38169490584), SHA 3f27145e23f5815c78c871c68cb06092a5301afe; test-build e browser concluídos com sucesso (385 Vitest, 81 Playwright). Os logs identificam Node 24.21.0; runtime local Node 22.23.3. Não confundir aprovação de checkpoint anterior com aprovação deste SHA.
- Falhas durante elaboração: shim dialog ausente no novo harness; expectativa de staff detectou bypass AAL1 na primeira migration, corrigido com esports_staff_access; testes transacionais negativos precisaram rollback de savepoint; coluna de fixture corrigida de staff_id para user_id. As verificações respectivas foram repetidas com aprovação.

Logs JSON completos de Vitest, repetições, CI e catálogo, além de evidência da falha browser, acompanham a entrega. O shim Windows usado por alguns comandos está fora do produto e não altera permissões/testes. PGlite e mocks não equivalem a PostgREST/Auth/Supabase real.

## Migration 030

202610110030_post_audit_reads.sql adiciona duas RPCs, substitui incrementalmente a antiga leitura, restringe grants e cria índices de ordenação para questões/tentativas/revisões. Migrations 001–029 preservadas. Supabase CLI não estava disponível no PATH; a tentativa de migration new --help falhou. O arquivo foi criado manualmente na convenção cumulativa autorizada e validado em PGlite. Não aplicado remotamente. Planos de consulta, concorrência e políticas efetivas de PostgREST ainda exigem ambiente identificado. Não remover a migration em banco aplicado sem plano de rollback; reversão futura deve ser incremental.

## Riscos residuais e decisão

| Severidade | Risco / pendência |
|---|---|
| Alta para lançamento | Infraestrutura, Auth real, PostgREST, CAPTCHA/hostname, Edge Functions, CSP/headers, secrets, backup/observabilidade e demais 13 itens externos não verificados. |
| Média | Duas abas autenticadas reais e revogação/remoção de fator ainda sem prova externa; não fechar KYR-038 por adaptador. |
| Média | KYR-039/KYR-040: carregamento integral e teto de 10.000 permanecem. Proposta própria preserva XP, relatórios, calendário e exportação. |
| Média | KYR-022: paginação administrativa ainda incompleta; offsets de avaliações limitados a 100.000, com migração futura para cursor em volumes grandes. |
| Baixa | OBS23-002 sem reprodução/causa histórica; manter monitoramento de CI e prova diagnóstica antes de atribuir correção. |

Demonstração local com fixtures: GO para revisão técnica do código. Staging autenticado, produção pública/autenticada, LivePix e recrutamento: NO-GO. Não há hospedagem, staging, projeto Supabase ou zona Cloudflare confirmados. Nenhum terceiro foi acessado. Sem merge, deploy, DNS, pagamento, recrutamento público, dado pessoal real ou alteração de direitos comerciais.

## Preservação e próxima missão

Commits pequenos foram enviados ao longo do trabalho; a lista completa e os hashes estão no manifest/COMMITS.txt. PR draft: https://github.com/sallumm/fortnite-competitive-platform/pull/21. Fontes e pacote de evidências são rastreáveis à branch; a base continua intacta.

PROMPT23_5_FINDINGS_MATRIX.md detalha todos os 49; PROMPT23_5_SCALABILITY_PHASE.md define a etapa de escala; PROMPT23_5_NEXT_AUDIT.md define verificação independente e dependências de staging. Codex Security foi usado para investigação/revisão delimitadas e preservação dos artefatos, não como novo certificado exaustivo. A missão seguinte/Prompt 24 exige autorização expressa e não foi iniciada.
