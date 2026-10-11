# Prompt 23.5 — roteiro da próxima verificação independente

PR draft: https://github.com/sallumm/fortnite-competitive-platform/pull/21
Branch: feat/post-audit-hardening
Base: 961783a5317e222938599e64c0632eb8835842a1
Destino da PR: feat/security-hardening-reconstruction

Este roteiro não inicia Prompt 24 nem autoriza infraestrutura, merge ou deploy. Obter autorização expressa antes da próxima missão.

## Identidade e rastreabilidade

Verificar HEAD atual da PR #21 e seus SHAs no manifest da entrega. Comparar com a base auditada, sem usar main antiga. Conferir logs de CI pelo SHA correspondente, testes negativos e repetições. Preservar migrations 001–029 e verificar hash normalizado de LF/Git; examinar 030 isoladamente.

## Regressões locais independentes

1. Executar npm ci --ignore-scripts em Node 24, npm audit --audit-level=high, npm run check:security, npm run check:brand, npm test, npm run build, npm run test:e2e.
2. Revisar sessionBoundary como dica de invalidação de UI, nunca como autorização. Confirmar que SQL exige JWT verificado/AAL2 e cargo atual.
3. Desafiar initial getSession atrasado, respostas de A depois da troca para B, checkpoint tardio, autosave de 500 ms e desmontagem. A renovação de token no mesmo usuário/AAL deve preservar edição.
4. Alternar ordem entre sinal de armazenamento e evento SDK. Sinal não pode deixar a interface anônima indefinidamente enquanto SDK mantém a nova conta. O provider reconcilia getSession e ignora respostas anteriores a outro evento.
5. Repetir INSERT/UPDATE/DELETE real de articles e save/publish_meta_draft: sem cargo, AAL1, AAL2, downgrade e cargo removido. UPDATE bloqueado por RLS pode retornar zero linhas; verificar conteúdo intacto.
6. Testar mais de 50 questões/revisões, empates na ordenação, pesquisa literal, remoção de designação e offset inválido. Confirmar preservação dos campos de avaliação não salvos ao paginar histórico.
7. Verificar que nenhuma leitura administrativa encerra provas. Expiração explícita exige cargo+AAL2, escopo por designação, quota, limite de lote, auditoria e idempotência.
8. Repetir axe nos três tamanhos e ambos os temas. O primeiro Playwright local detectou contraste transitório de badge durante opacidade de TrainingStepTransition; conferir correção e logs posteriores sem modificar limiar WCAG.
9. OBS23-002: manter expectativas e timeouts. Repetir sob carga controlada e Node 24; obter DOM, erro de produto e cronologia antes de atribuir causa. Três repetições positivas nesta missão não encerram a causa histórica.

## Ambiente controlado futuro — somente após autorização e identificação

Projeto Supabase e URLs de staging/produção ainda não existem. Não consultar projetos de terceiros nem inventar configuração concluída.

- Criar/configurar apenas projeto inequivocamente pertencente à kyrven, mediante autorização posterior. Aplicar a sequência 001–030 em ambiente isolado e verificar catálogo/grants/RLS/PostgREST real.
- Testar duas abas autenticadas reais, logout local/global/remoto, expiração, recuperação de sessão, troca A/B, remoção do último fator e refreshSession. Confirmar eventos BroadcastChannel/storage em ambas as ordens.
- Testar CAPTCHA nos endpoints e chamadas diretas de RPC; validar domínio/hostname, vínculo do ticket, expiração, consumo e quotas.
- Validar Edge Functions, JWT, CORS/origins, quotas e limites com fixtures sintéticas e provedor de teste identificado.
- Validar CSP/headers reais no host, secrets, backups, logs, observabilidade, e-mail/transacionais, consentimentos e direitos de dados. Cloudflare exige zona/domínio confirmado.
- Avaliar KYR-022 restante e executar a etapa de KYR-039/KYR-040 descrita em PROMPT23_5_SCALABILITY_PHASE.md, sem mudar requisitos FREE/PRO/ELITE/PROSPECT/ACADEMY PLAYER/ROSTER.
- Revisar os 13 achados externos sem transportar automaticamente aprovação de mocks/PGlite.

## Decisão de lançamento

Demonstração local: elegível para revisão técnica após todos os testes finais, usando apenas dados sintéticos.
Staging autenticado: NO-GO enquanto ambiente e validação de Auth/PostgREST real estiverem ausentes.
Produção pública/autenticada, pagamentos e recrutamento: NO-GO. Não há infraestrutura confirmada; existem achados abertos/parciais e dependências externas.
