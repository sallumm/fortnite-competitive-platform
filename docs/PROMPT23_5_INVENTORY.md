# Prompt 23.5 — inventário antes da implementação

Base confirmada localmente e por GitHub PR20: 961783a5317e222938599e64c0632eb8835842a1. Branch nova feat/post-audit-hardening. PR de entrega deve ter base feat/security-hardening-reconstruction. Nenhum serviço hospedado existe/está autorizado.

## Blocos

1. KYR-038/OBS23-004: store.tsx Auth/getSession/refresh/checkpoint/run, local-data.ts geração entre abas, TrainingBuilder e Training rascunhos/timers, cópias locais da árvore pública/administrativa. Evidência: refresh depende só de user.id; callbacks não invalidam requests sincronicamente; geração privada não é compartilhada. Criar regressões integradas com Auth controlado, resposta atrasada, duas abas/StorageEvent, A→B, logout e AAL2→AAL1. Rotação comum mesmo usuário/AAL deve preservar editor legítimo. Backend permanece autorização principal.
2. KYR-034: regressões PGlite de INSERT/UPDATE/DELETE em tabela editorial real e RPC editorial; AAL1/sem cargo negados, cargo+AAL2 positivo, downgrade negativo e estado intacto. Teste histórico perdido permanece indisponível; não alegar recuperar causa passada.
3. OBS23-002: reproduzir ui.test.tsx:91 sem relaxar assert/timeouts; estudar treino/checkpoint/conclusão e relógio sob execução completa; Node24/CI quando disponível. Preservar falhas e resultados.
4. OBS23-001: verificar e documentar cinco funções private autorizadas nas linhas49–51 de029.
5. KYR-022/041: paginação server-side das listagens administrativas esports/provas/bolsas e review_history, filtros antes do limite, ordenação estável e checks de atribuição/papel em cada página; conectar controles de UI sem gabaritos públicos. Migration nova030; preservar001–029.
6. KYR-023: separar expiração explícita da leitura administrativa; manter proteção do prazo/resultado e oferecer ação consciente com autorização/quota existentes.
7. KYR-039/040: mapear consumidores do PlayerData antes de carregamento por demanda; alternativa paginada/filtros para teto10000 sem conjunto incompleto. Preservar relatórios/planner/coach e exportação; documentar refatoração própria se necessário, conforme autorização.

## Validação e preservação

Checks por bloco, commits pequenos e push. Matriz49 e observações atualizadas com evidência local e limites externos preservados. Vitest completo, Playwright3projetos, build/segurança/PGlite/manifesto históricos, CI de cada checkpoint relevante. Falhas registradas sem weakening. Relatórios e logs em outputs; documentos de engenharia em docs. PR draft sem merge; não avançar Prompt24.
