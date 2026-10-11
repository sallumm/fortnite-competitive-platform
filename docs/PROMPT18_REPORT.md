# Prompt 18 — recuperação e encerramento da Etapa E

## Procedência e escopo

Base: `docs/kyrven-handoff`, `4f6fa656324ffc4c425a9b83494f332a881795e6`, descendente da ponta funcional `3e47eb1`. Branch de trabalho: `feat/ultimate-brand-transformation`.

O ambiente da execução interrompida não estava acessível na recuperação. Seis commits remotos foram encontrados e preservados com uma branch no checkpoint `6414472ed22409029d64a0f81b69ed00a39606cc`. Depois da autorização do usuário, uma nova cópia limpa foi clonada dessa branch. O commit local `2a87751` não existe na cópia recuperada e a consulta ao GitHub retornou “No commit found”; seus arquivos e resultados não foram presumidos recuperados. A Etapa E foi recomposta a partir do código preservado e de novas execuções.

### Checkpoints preservados

| Commit remoto | Conteúdo |
| --- | --- |
| `e3ad92b` | Identidade kyrven e adaptação editorial compatível |
| `c050aa8` | Ícones raster referenciados pelo manifest |
| `4131c09` | Superfícies compartilhadas e continuidade da aprendizagem |
| `6e36eb1` | Recrutamento fechado e administração protegida |
| `1b5775e` | Avaliações privadas, bolsas e desenvolvimento |
| `6414472` | Seeds históricos canônicos e contraste das transições |

Comparação inicial com a base: 70 arquivos, 6.536 inserções e 48 remoções. Nenhuma das migrations 001–024 ou dos três JSONs canônicos de seed foi alterada no estado cumulativo recuperado. Foram acrescentadas somente as migrations 025–028.

## Inventário funcional comprovado no código

| Área | Implementação preservada | Limite |
| --- | --- | --- |
| Marca | Símbolo SVG próprio, assinaturas kyrven/academy/esports/development, campanha be kyrven., favicon/manifest/ícones/social, tokens claro/escuro | Domínio/SEO hospedado não configurado |
| Experiência | Redesign compartilhado, landing, JourneyNav, transições Motion, microinterações e movimento reduzido | Não existe medição de performance em aparelhos reais |
| Módulos anteriores | Academy, Training Center, Skill Maxing, Road, calendário, relatórios, Meta, equipes e Coach/Knowledge preservados | Serviços hospedados ainda precisam de staging |
| Esports | Páginas públicas, candidatura autenticada via RPC, workspace, consentimento versionado, cargos temporários, staff designado, administração/auditoria | Gates privados falsos; recrutamento público fechado |
| Avaliações | Banco privado, provas equilibradas, atribuição, seleção no servidor, snapshots, salvamento CAS, prazo no servidor, revisão humana, resultados compartilhados | Banco editorial inicialmente vazio; sem antifraude completo |
| Bolsas | Oferta com termos/benefícios versionados, aceite, recusa, validade, extensão/revogação e benefícios separados de comércio | Recursos Pro pagos indisponíveis; feedback depende de equipe real |
| Desenvolvimento | Metas, materiais, prazos, progresso declarado, revisões e notas internas separadas | Calendário de prazos com links; não agenda automaticamente |
| Talentos | Decisão humana de Academy Roster com gate próprio | Formalização do elenco profissional e anúncio de jogadores não implementados |
| Privacidade | Exportação própria, solicitação de exclusão/revogação, execução administrativa, retenção e cascatas | Sem cron hospedado; backups/Auth/storage exigem validação |

Os dados de administração e as questões não são mocks de produto. Testes usam fixtures sintéticas e mocks restritos ao runner; a demonstração continua identificada e não concede acesso aos fluxos reais de esports. A faixa etária é autodeclarada: não há verificação automática de idade/representação.

## Inventário de testes

O checkpoint contém 54 arquivos Vitest com 329 testes. Entre eles: 7 testes SQL de recrutamento, 14 SQL de avaliações/desenvolvimento/lifecycle e 6 DOM de provas/bolsas. Os dois arquivos de esports SQL aplicam todas as 28 migrations em PGlite e exercitam anônimo, candidatos distintos, administrador e avaliador designado/não designado.

Há 78 cenários Playwright anteriores ao fechamento E, distribuídos em 15 arquivos e três projetos. A nova auditoria visual acrescenta um cenário por projeto: 47 rotas × 2 temas × 3 viewports = 282 combinações. Usa axe WCAG A/AA, verifica overflow horizontal, marca pública, headings e erros de página e grava 282 capturas na rodada final. Inclui atividade cancelada sintética para conferir legibilidade desse estado. Administração/esports em demo mostram bloqueios; essas capturas não comprovam uma sessão administrativa autorizada no Supabase hospedado. Sessão de treino interativa e recuperação continuam cobertas pelas suítes funcionais existentes.

## Novas execuções da recuperação

| Verificação | Resultado |
| --- | --- |
| `npm ci` com lockfile preservado | Aprovado, Node 24.19.0 |
| `npm test` | 329/329, 54/54 arquivos, 31,28 s na execução final (24,44 s na inicial) |
| TypeScript SPA e funções (`npm run build`) | Aprovado |
| Build Vite | Aprovado; entrada 423,37 kB / 132,10 kB gzip na execução final |
| `npm run check:brand` | Aprovado |
| `npm audit --json` | Zero vulnerabilidades conhecidas na consulta |
| Comparação binária das 24 migrations com a base | 24/24 idênticas; 28 migrations totais |
| Geradores `mastery-seed --check`, `research-seed --check` e `meta-seed --check` | Aprovados; também presentes na suíte cumulativa |
| `report:bundle` | 563.959 bytes / 175.766 gzip (entrada e imports estáticos; exclui rotas lazy, CSS e transporte) |
| `prettier --check src/brand.css e2e/brand-audit.spec.ts` e `git diff --check` | Aprovados |
| Lint | Não há ESLint nem script `lint` configurado; check de marca e TypeScript executados. Não declarar lint geral aprovado |
| Playwright cumulativo | **81/81 aprovados**, 8,4 min, dois workers, sem retries locais |
| Auditoria visual ampliada | **282/282 combinações** (47 rotas × 2 temas × 3 viewports), zero violações axe/overflow/erros de página nos estados exercitados |
| CI funcional (`8fd115d`) | [Qualidade #71](https://github.com/sallumm/fortnite-competitive-platform/actions/runs/38114067687): **success**, 329 testes/54 arquivos, audit/marca/TypeScript/build e 81 Playwright (7,5 min, sem retries utilizados) |
| `check:production` | Bloqueio esperado: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e VITE_SITE_URL ausentes |

O download padrão de Chromium pelo Playwright falhou com ZIP truncado/inválido. A execução local usa Chromium 143.0.7499.0 (`@sparticuz/chromium@143.0.4`) instalado em `/tmp`, fora do repositório, através do suporte já existente a `PLAYWRIGHT_EXECUTABLE_PATH`. O lockfile não foi alterado. O CI executou com sucesso a instalação oficial Chrome Headless Shell 156.0.8078.4 / Playwright Chromium v1248, separadamente do fallback local. Nenhum resultado do run interrompido foi reutilizado como nova evidência.

## Alterações de fechamento e falhas

A auditoria ampliada, check de marca no CI, relatório e roteiro manual estavam ausentes no checkpoint recuperado e foram acrescentados. O CI guarda relatório/capturas também em sucesso, com retenção de sete dias. O runner registrou aviso de depreciação de Node 20 nas actions v4, executadas automaticamente em Node 24; todos os jobs passaram. Atualização de major das actions fica para revisão de manutenção/hardening, sem alterar ferramentas apenas para remover o aviso.

A primeira rodada teve 78 cenários funcionais aprovados e três falhas na auditoria nova: contraste de datas fora do mês (3,19:1), overflow no cabeçalho tablet (864 px em viewport de 768 px), e uma suposição incorreta do teste que exigia h1 num bloqueio administrativo existente com título h3. A espera foi corrigida para um heading acessível, sem alterar a autorização.

Uma rodada visual completa com asserções acumuladas revelou no tema claro: números ativos do JourneyNav (3,51:1), texto da habilidade selecionada (2,55:1) e conquistas bloqueadas (3,31–3,75:1). Um diagnóstico específico com atividade cancelada sintética confirmou 2,38:1 no calendário. Correções: texto opaco e distinção de estado por superfície/borda/rótulo, uso de `--accent-ink` na seleção e quebra da navegação pública em tablet. Atividade cancelada agora integra a fixture permanente da auditoria. Nenhuma regra axe foi desativada; asserções soft continuam fazendo o teste falhar quando há violação.

Commit de correções preservado no GitHub: `8fd115dc76a868942bd59fed9c7082f6bc1744d1` (árvore idêntica ao checkpoint local `730c3d5`). PR draft [#19](https://github.com/sallumm/fortnite-competitive-platform/pull/19), base `docs/kyrven-handoff`. O relatório, roteiro manual e links de continuidade compõem o commit documental de fechamento. O navegador local concluiu 81/81 com sucesso; o CI funcional acima também concluiu com sucesso. Alterações posteriores desse fechamento são somente documentais. O status dos checks do HEAD documental fica disponível na PR, sem presumir conclusão antecipada.

## Arquivos alterados exclusivamente na Etapa E

| Arquivo | Finalidade |
| --- | --- |
| `src/brand.css` | Contraste de estados e quebra do cabeçalho tablet |
| `e2e/brand-audit.spec.ts` | Auditoria de 47 rotas × dois temas × três viewports, incluindo atividade cancelada |
| `.github/workflows/ci.yml` | Check de marca e artefatos também em sucesso |
| `docs/PROMPT18_REPORT.md` | Procedência, inventário, resultados, falhas e limites |
| `docs/esports/MANUAL_SETUP.md` | Dependências e verificações antes da operação, sem liberação de gates |
| `docs/esports/RECRUITMENT.md` | Corrige referência histórica à etapa D e liga ao fechamento |
| `docs/brand/IDENTITY.md` | Compatibilidade canônica e alcance da auditoria recuperada |
| `README.md` | Links e situação real do domínio esports |

Nenhuma migration, corpus canônico, dependência ou contrato funcional anterior foi alterado pela Etapa E. Os seis checkpoints de A–D permanecem ancestrais da branch; não houve reconstrução dessas etapas.

## Pendências e funções não prontas

- Supabase hospedado: aplicação das migrations, Auth/SMTP, RLS/RPC via gateway, storage, funções, exclusão/exportação completas, duas ou mais contas/equipes reais e callbacks não validados nesta etapa.
- Gates de lançamento, adolescentes e Academy Roster continuam fechados. Operação e documentos exigem revisão jurídica/proteção adequada; gerar textos ou registrar uma referência de autorização não comprova conformidade.
- Questões/provas precisam de autoria e revisão editorial; não há banco fictício publicado. Limites de listagem: 500 questões e 100 tentativas/bolsas recentes; paginação maior é futura.
- Equipe humana, atendimento, revisões, disponibilidade de feedback, política de retenção, cron e backups precisam de configuração/validação.
- Elenco profissional, formalização e publicação de jogadores continuam pendentes. Nenhuma contratação/promoção automática ou carreira garantida.
- Pro comercial, cargos pagos, assinaturas, checkout, webhooks e LivePix não implementados/ativados. Fase futura: mensal/trimestral/anual, titular adulto responsável e confirmação segura no servidor.
- Os geradores legados `seed-sql.mjs` e `training-seed.mjs` não têm modo `--check` e gravam migrations históricas. Não foram executados nesta retomada; 002/008 foram conferidas pela comparação binária e aplicação SQL. Não usar regeneração como etapa de deploy.
- Lighthouse, dispositivos reais, auditoria independente, pentest e validação jurídica não executados. Axe e npm audit têm escopos limitados.
- Próximas fases: jurídico, Prompt 19 manual/APIs, Prompt 20 hardening e Prompt 21 auditoria independente somente de leitura seguida de plano de correções.

Consulte [MANUAL_SETUP.md](esports/MANUAL_SETUP.md), [RECRUITMENT.md](esports/RECRUITMENT.md), [ASSESSMENTS_DEVELOPMENT.md](esports/ASSESSMENTS_DEVELOPMENT.md) e [IDENTITY.md](brand/IDENTITY.md). O handoff original é uma fotografia histórica e não foi reescrito. Não houve merge, publicação, recrutamento real, pagamento ou aplicação remota de migrations.
