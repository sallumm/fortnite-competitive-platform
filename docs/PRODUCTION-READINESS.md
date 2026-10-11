> Relatório histórico de uma etapa anterior. Para o estado cumulativo, migrations 001–024 e pendências atuais, consulte [ECOSYSTEM_VALIDATION.md](ECOSYSTEM_VALIDATION.md) e [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md).

# Clutchfolio 5.0 — auditoria e preparação para publicação

Auditoria em 10/10/2026. Base: `feat/competitive-intelligence`, commit `2e2eaed`. Não houve migração de arquitetura, substituição do banco, ativação de serviços pagos ou publicação pública. Os PRs anteriores continuam em sequência; mergear 2.0 → 3.0 → 4.0 → 5.0, ajustando as bases conforme necessário.

## Auditoria e prioridades

| Prioridade | Constatação | Resolução / situação |
| --- | --- | --- |
| P0 | Exclusão da demonstração deixava conversas, checklists e rascunhos | Remoção de todos os caches do produto, preservando tema e armazenamento de outros aplicativos; navegação completa limpa memória |
| P0 | Endpoint de exclusão aceitava corpo sem limites e timestamp inválido poderia passar | Identidade derivada do token, confirmação estrita, autenticação recente válida, origem autorizada, stream limitado a 2 KB, erros sem detalhes privados; versão do SDK fixada |
| P0 | Exportação excluía histórico do Coach e preparação competitiva | JSON inclui registros pessoais e dados complementares; paginação e filtro explícito do proprietário, além de RLS; falha impede exportação incompleta |
| P0 | Chave privilegiada poderia ser colocada em variável pública | Build rejeita chaves secretas/service-role e nomes públicos de segredos; comando adicional valida configuração de produção |
| P1 | Falha de hidratação privada podia manter carregamento indefinido | Estado de falha acionável e recuperação por tentativa; teste de regressão com adaptador |
| P1 | Menu móvel fora da tela continuava disponível ao teclado | Visibilidade acompanha abertura, controle com `aria-expanded`, Escape, foco contido e bloqueio de rolagem |
| P1 | Calendário mensal apertado em celulares | Agenda inicial em mobile, lista de sete dias, semana com rolagem própria, intervalo explícito e títulos completos |
| P1 | Conteúdo de demonstração podia aparecer antes do backend configurado | Catálogo inicia vazio quando há Supabase; erro não fabrica conteúdo real |
| P1 | Navegação desaparecia ao carregar páginas lazy | Suspense dentro do conteúdo conserva estrutura da aplicação |
| P1 | Favorecidos desatualizados podiam aparecer em lembretes/dashboard | Mesma validação de publicação, status, confirmação e validade da central competitiva |
| P1 | Rascunhos corrompidos e troca de sessão podiam reaproveitar estado inadequado | Validação de estrutura, resultados e exercícios; chave por proprietário e remontagem por sessão |
| P1 | Controles sem contexto, IDs de modais repetidos, progresso inválido | Feedback temporário configurável; IDs únicos, limites seguros no progresso e alvos de toque de 44 px |
| P1 | Login perdia a intenção de navegação | Retorno somente para rota interna `/app`, sem redirecionamento externo |
| P1 | Título/duração do dashboard poderiam divergir da sessão ativa | Duração usa snapshot da sessão; histórico tolera conclusão antiga sem timestamp; CTA honesto sem rotina |
| P1 | SPA entregava apenas metadados genéricos aos robôs | Pré-renderização opcional de artigos públicos no build, canonical e sitemap, sem exportar rascunhos; redirects preservam arquivos gerados |
| P1 | Auditoria npm encontrou 2 críticos e 1 moderado no desenvolvimento | Vitest atualizado para 5.0.3; auditoria novamente executada |
| P2 | Sete regiões duplicavam a mesma lista de fases no bundle | Lista compartilhada preservando campos, IDs e datas; manifesto permite medir JS inicial |
| P2 | Ausência de aviso offline e armazenamento de tema podia lançar exceção | Aviso explícito de conexão; tema e treino permanecem utilizáveis quando escrita local falha |
| P2 | Teste de duração usava dois instantes diferentes e falhava por 1 ms | Fixture captura um único instante; servidor conserva arredondamento correto |

## Design system e experiência

Identidade, temas claro/escuro, tokens de cor, tipografia de sistema e componentes existentes preservados. Navegação agrupada em Meu espaço, Explorar, Minha evolução e Ajuda; perfil mantém preferências e privacidade. Indicadores de foco usam o token de destaque. Modal nativo mantém isolamento de foco, títulos únicos e rolagem dentro do viewport. Movimento reduzido respeita a preferência do sistema. Agenda oferece uma experiência própria de leitura em mobile. Não foram adicionadas imagens pesadas, fontes externas ou animações decorativas.

## Segurança revisada

As migrations 001–006 mantêm RLS e isolamento por proprietário; as suites PGlite exercitam permissões editoriais, publicação, isolamento entre contas, recorrências, ações confirmadas, custos/limites do Coach e cascatas. Exclusão usa autenticação recente de até 15 minutos e só remove o ID devolvido pelo serviço de autenticação. A chave de serviço existe somente na função de servidor.

O Coach conserva consentimento separado para contexto, envio externo e histórico, limites no servidor, validação de ações e confirmação obrigatória. Não houve chamada paga a modelos. A ausência de vulnerabilidades conhecidas no npm não prova segurança completa. PGlite, adaptadores e funções isoladas não substituem testes de integração no Supabase real nem avaliação de infraestrutura.

## SEO e pré-renderização

Para publicar conteúdo indexável, configure as variáveis públicas e `PRERENDER_PUBLIC=1` no ambiente de build. O comando `npm run build` obtém apenas artigos publicados, com `published_at` anterior ao build, pela API pública do Supabase usando anon/publishable e as políticas existentes. Produz `/news/<slug>/index.html` e `/academy/<slug>/index.html` com texto escapado, fonte, data, aviso de validade, metadados e canonical. Acrescenta os URLs ao sitemap. Nenhum catálogo de demonstração é promovido a conteúdo publicado.

O snapshot precisa de novo build após publicação, edição ou exclusão de artigo. Se houver falha de obtenção quando a opção estiver habilitada, o build falha. A navegação React segue existente; isso não migra a aplicação para SSR. Cloudflare Pages serve os arquivos HTML existentes e aplica fallback SPA quando não há `404.html` raiz; redirects explícitos ficam restritos às rotas de conta. Validar URLs com e sem barra final e previews antes do domínio definitivo. Não há resultados de Lighthouse nesta auditoria.

## Checklist de publicação (bloqueadores antes de usuários reais)

- [ ] Revisar e integrar a sequência de PRs; conferir CI em cada base.
- [ ] Configurar Node 24, `npm ci`, `npm run build`, saída `dist` no Cloudflare Pages.
- [ ] Definir `VITE_SUPABASE_URL`, chave pública `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL` HTTPS; executar `npm run check:production`. Nenhuma chave privada com prefixo `VITE_`.
- [ ] Aplicar migrations 001–006 em staging e produção, em ordem; conferir schema, RLS, índices, privilégios e cascatas com duas contas de teste.
- [ ] Publicar `clutch-coach` e `delete-account`, configurar `ALLOWED_ORIGIN` exata por ambiente e secrets exclusivamente no servidor.
- [ ] Configurar Auth Site URL, redirects `/auth` e `/auth?recovery=1`, confirmação de e-mail, SMTP autorizado, política de senha e limites de Auth.
- [ ] Testar cadastro, confirmação, login, recuperação, sessão expirada, logout e retorno a rota privada no backend real.
- [ ] Testar calendário/fusos/recorrências, sessão, relatórios, favoritos e checklist com persistência entre dispositivos.
- [ ] Testar Coach com dois usuários: consentimentos, contexto mínimo, proposta, conflito, confirmação, limites, timeout e exclusão do histórico. Se ativar provedor, estabelecer orçamento e alertas antes.
- [ ] Testar exportação completa e exclusão real: login recente, confirmação, cascatas, impossibilidade de ler dados excluídos e retenção de backups documentada.
- [ ] Atribuir administração pelo processo seguro documentado; testar conta comum impedida de editar/publicar.
- [ ] Atualizar conteúdo editorial, fontes, validade e datas; conferir sitemap/pré-renderização e compartilhamento sem JavaScript.
- [ ] Conferir domínio, HTTPS, redirects, CSP, deep links e ausência de segredos no bundle. CSP atual permite Supabase `*.supabase.co`; domínios personalizados precisam de ajuste específico.
- [ ] Configurar backups adequados ao plano disponível; executar restauração em staging. Não considerar retenção automática como backup validado.
- [ ] Configurar `VITE_DISCORD_INVITE` apenas com convite autorizado, moderação e canal de suporte verdadeiro.
- [ ] Identificar operador e contato de privacidade; revisar termos, retenção, transferências e tratamento de adolescentes antes de abrir cadastro. Documentos atuais são preliminares.
- [ ] Avaliar exigências vigentes de LGPD e ECA Digital, melhor interesse, privacidade por padrão, aferição etária e participação de responsáveis quando aplicável com profissional habilitado. Checkbox de termos não demonstra conformidade.
- [ ] Definir monitoramento mínimo de erros, sem conteúdo de conversas ou dados pessoais; alertas e plano de resposta. Nenhum fornecedor de telemetria foi ativado.
- [ ] Validar com usuários em aparelhos reais, teclado e leitor de tela; revisar todos os estados de permissão, erro e rede em staging.

## Limitações e próxima versão

Backend de produção, SMTP, Edge Runtime implantado, APIs externas, domínio, backups e provedor generativo não foram ativados nem validados por esta etapa. Testes de navegador usam Chromium e demonstração, não sessões reais. Axe cobre regras automatizáveis, não toda acessibilidade; testes mobile emulados não comprovam funcionamento em Safari/iOS ou aparelhos físicos. Não há notificações com site fechado nem atendimento ao vivo. Não há declaração de conformidade legal.

Priorizar na próxima versão: homologação com duas contas reais; Playwright também em Firefox/WebKit; catálogo editorial paginado com detalhes sob demanda; política de cache e invalidação; revisão com adolescentes/responsáveis e usuários de leitores de tela; telemetria mínima com opt-in quando necessário; automação de rebuild editorial autorizada. Carregamento do catálogo ainda reúne o conteúdo publicado; precisa de paginação de produto para crescimento substancial.

## Referências técnicas e legais

- [Cloudflare Pages: serving pages e fallback SPA](https://developers.cloudflare.com/pages/configuration/serving-pages/).
- [Playwright: navegadores e instalação](https://playwright.dev/docs/browsers).
- [Lei 15.211/2025 — texto consolidado do ECA Digital](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm).
- [LGPD — texto consolidado, proteção de crianças e adolescentes](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm).

## Resultados verificáveis desta etapa

- `npm test`: **118 testes em 18 arquivos passaram**, incluindo PGlite, DOM/adaptadores e as novas fronteiras de privacidade, exclusão e pré-renderização.
- `npm run build`: TypeScript do frontend e das funções, Vite e scripts de build concluídos. Com configuração vazia, sitemap e pré-renderização são omitidos explicitamente.
- `npm audit --json`: **zero vulnerabilidades reportadas** na instalação auditada (246 dependências contabilizadas). Estado pontual, não garantia de segurança futura.
- Playwright: **8 execuções passaram**, quatro cenários em desktop 1366×900 e Pixel 7 emulado, incluindo regras axe WCAG A/AA nas cinco páginas públicas e dashboard, ausência de erros de console/página e requisições falhas não intencionais.
- Navegador local: Chromium **153.0.8010.0**. O CDN de download padrão retornou arquivo inválido neste ambiente; utilizou-se temporariamente o binário distribuído em `@sparticuz/chromium`, fora das dependências do projeto. A CI usa a instalação padrão do Playwright.
- Bundle de demonstração sem Supabase configurado: JS da entrada mais imports estáticos aproximadamente **337 KB brutos / 107 KB gzip**, sem CSS ou rotas lazy. Charts permanecem em chunk lazy (~383 KB bruto). `npm run report:bundle` reproduz os números exatos; instalação configurada inclui o SDK Supabase e terá payload diferente.
- Nenhuma medição Lighthouse, latência de rede de produção ou índice de busca foi simulada.

Novos testes: `deletion.test.ts`, `local-data.test.ts`, `export-data.test.ts`, `production-check.test.ts`, `prerender.test.ts`, regressão de falha de carregamento em `auth-adapter.test.tsx` e cenários Playwright em `e2e/product.spec.ts`. O teste de pontuação/duração existente teve apenas a fixture temporal estabilizada. A CI executa audit/test/build e testes de navegador, com traces em falhas.

## Arquivos alterados

- `.github/workflows/ci.yml`
- `.gitignore`
- `README.md`
- `docs/PRODUCTION-READINESS.md`
- `e2e/product.spec.ts`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `public/_redirects`
- `scripts/bundle-report.mjs`
- `scripts/frontend-env-check.mjs`
- `scripts/prerender-editorial.mjs`
- `scripts/production-check.mjs`
- `scripts/sitemap.mjs`
- `src/App.tsx`
- `src/components/Calendar.tsx`
- `src/components/Layout.tsx`
- `src/components/ui.tsx`
- `src/lib/competitive-seed.ts`
- `src/lib/export-data.ts`
- `src/lib/local-data.ts`
- `src/lib/seo.ts`
- `src/lib/store.tsx`
- `src/pages/Auth.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Support.tsx`
- `src/pages/Training.tsx`
- `src/styles.css`
- `supabase/functions/_shared/delete-account.ts`
- `supabase/functions/delete-account/index.ts`
- `tests/auth-adapter.test.tsx`
- `tests/competitive-database.test.ts`
- `tests/deletion.test.ts`
- `tests/export-data.test.ts`
- `tests/local-data.test.ts`
- `tests/prerender.test.ts`
- `tests/production-check.test.ts`
- `tsconfig.coach.json`
- `vite.config.ts`
