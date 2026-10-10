# Clutchfolio — experiência interativa

## Escopo e inspeção

Implementação incremental sobre `feat/product-excellence` (541a4c8), preservando as versões anteriores. As PRs anteriores precisam ser integradas na ordem de dependência. Não houve substituição da arquitetura, mudanças de schema, migração de autenticação ou publicação em produção.

A inspeção percorreu os arquivos do projeto, o catálogo, as páginas, os componentes compartilhados, a persistência local/Supabase, as migrations 001–006 e os testes. Prioridades encontradas:

- Prévia pública estática e FAQ desatualizado sobre o Coach.
- Editor de rotina sem arraste, desfazer, instruções ou execução prévia.
- Execução mostrando todos os formulários simultaneamente.
- Preferência de movimento ausente; animações sem um sistema compartilhado.
- Calendário sem transferência direta entre dias.
- Navegação sem busca rápida nem modo compacto.
- Relatórios sem zoom e consulta tabular visível dos gráficos.
- Copiar código dentro de formulários podia disparar submit implícito.

## Implementado

| Área | Interação real |
| --- | --- |
| Landing | Planejamento por dias e duração, registro de exemplo, abas com indicador animado, recursos reais do catálogo, treinamento e competitivo com origem temporal, FAQ corrigido |
| Navegação | Busca local de páginas e exercícios, Ctrl/Cmd K, drawer com foco e Escape, sidebar compacta e indicação de rota com layout animation |
| Dashboard | Cartões com resposta ao pointer, contagem de sessões que anima apenas mudanças, XP com spring; estatísticas continuam derivadas dos registros |
| Planejador | Sortable por alça, teclado e botões, duração, remoção, instruções, 30 estados de desfazer, total, prévia, salvamento real |
| Calendário | Transição por período e visualização, arraste entre datas, editor com data atual/proposta/fuso, conflitos e confirmação; recorrências continuam com exceção por ocorrência |
| Sessão | Exercício focado, escolha de etapas, anterior/próximo, visão geral opcional, timer, resultados e rascunho por usuário/sessão preservados |
| Relatórios | Períodos animados, contadores, animação de gráfico controlada pela preferência, brush para séries com pelo menos oito medições e tabelas dos valores |
| Onboarding, habilidades, Coach | Transições entre etapas/habilidades e entrada de respostas sem reter formulários antigos |
| Perfil | Preferência de movimento persistida no navegador e aplicada globalmente |
| Restante do produto | Camada compartilhada de tema, tipografia, contraste, cartões, formulários, foco, feedback, estados vazios e transição de rotas; conteúdos, administração e fluxos mantidos |

A rotina completa já pode ser duplicada pela ação existente. Exercícios repetidos dentro da mesma rotina continuam proibidos pelo banco: não removemos essa regra para introduzir uma duplicação que falharia ao salvar. Limites existentes: 20 etapas, 1–120 minutos por etapa e 240 minutos por rotina. Desfazer é local; depois de salvar ou fechar o editor, não restaura uma gravação anterior.

O arraste do calendário não grava dados. Abre um editor com proposta, respeitando o fuso do perfil, os avisos de conflito e as permissões existentes. O botão Salvar agendamento é a confirmação explícita. Pelo teclado ou sem arraste, use o botão do evento e o campo de data. Torneios editoriais, atividades concluídas/canceladas e sessões vinculadas não têm alça de reagendamento.

## Movimento e acessibilidade

`MotionSystem` usa MotionConfig, LazyMotion e `m`. Recursos domMax são um chunk assíncrono; as rotas já eram lazy. Não há framer-motion instalado diretamente em paralelo a motion (framer-motion é dependência interna do pacote). Não adicionamos engine de scroll, vídeo ou efeitos infinitos.

Preferências: completo, reduzido e somente respostas essenciais. A preferência do sistema prevalece sobre completo. Conteúdo permanece visível quando IntersectionObserver não existe. Spring/layout usam transform; transições de conteúdo usam opacity. Contadores iniciam no valor real e animam somente atualizações; leitores de tela recebem o valor final. Resultados de gráficos continuam condicionados a configuração comparável, não a horas acumuladas.

Modais permanecem dialogs nativos, com foco, Escape, backdrop e restauração do foco. Não há retenção de páginas privadas em AnimatePresence durante saída. Drag and drop inclui instruções/avisos em português e ações alternativas por botões. O timer fica no fluxo para não encobrir campos focados.

Referências oficiais consultadas em 10/10/2026:

- https://motion.dev/docs/react-installation
- https://motion.dev/docs/react-lazy-motion
- https://motion.dev/docs/react-accessibility
- https://motion.dev/docs/react-animate-presence
- https://motion.dev/docs/react-layout-animations
- https://dndkit.com/legacy/presets/sortable/overview/
- https://dndkit.com/legacy/api-documentation/sensors/keyboard/

Dependências resolvidas: motion 14.1.0, dnd-kit core 6.3.1, sortable 10.0.0, utilities 3.2.2. Core/sortable pertencem à API que a documentação atual identifica como Legacy. A decisão foi usar a API estável documentada compatível com o projeto; não misturar gerações de dnd-kit. O sensor de teclado usa scroll automático imediato para garantir geometria consistente antes de confirmar a ordem.

## Verificação e limites

Verificação local final, em 10/10/2026:

- `npm test`: **121 testes em 19 arquivos passaram**, incluindo os 118 existentes e três novos testes DOM.
- `npm run build`: **passou** (TypeScript frontend/funções e Vite). Sitemap não gerado sem VITE_SITE_URL; pré-renderização editorial opcional desativada nesta configuração.
- `npm audit --audit-level=high`: **0 vulnerabilidades conhecidas**, sem equivalência a uma auditoria completa de segurança.
- Chromium 153 real com Playwright: **24 testes passaram**, oito cenários em desktop 1366×900, tablet 768×1024 e mobile Pixel 7. Incluem axe WCAG A/AA, ausência de overflow, console/erros/requisições nos fluxos críticos, navegação privada/pública, artigos/eventos, edição confirmada, teclado, persistência, retomada e exclusão local.
- Capturas efetivamente inspecionadas: landing desktop escura, landing tablet clara, planejador desktop, execução desktop e estados mobile. O painel fixo do timer foi removido após identificar que podia encobrir campos. As capturas após scroll de documentos longos podem deslocar elementos fixed; a captura de viewport é usada para conferir a composição da tela.
- `git diff --check`: passou.
- `npm run check:production`: bloqueia publicação como esperado sem VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e VITE_SITE_URL.

Os testes novos estão em `tests/premium-ui.test.tsx` e `e2e/premium.spec.ts`; `playwright.config.ts` inclui tablet. `tests/motion-setup.ts` disponibiliza matchMedia no jsdom; Motion e dnd-kit não são substituídos por respostas simuladas. Os testes de navegador usam Chromium real, dados locais explicitamente de demonstração e verificações axe. Cobrem teclado, proposta sem gravação, salvamento, retomada de resultados, exclusão, descoberta pública, temas e movimento reduzido. As capturas são artefatos de testes, não imagens simuladas.

A validação real de login/cadastro, permissões administrativas em sessão autenticada, Supabase remoto e falhas de rede do provedor continua dependendo de um ambiente configurado. Testes de banco, isolamento, Coach e funções existentes permanecem na suíte. Não houve execução dentro do Fortnite, Lighthouse, Safari/iOS nativo nem publicação para contas reais. O modo de demonstração é separado da conta e não comprova disponibilidade do serviço remoto.

Não se oferece sync entre dispositivos para rascunhos de sessão; eles usam sessionStorage. Arraste por toque dispõe de botões equivalentes, mas não foi validado em hardware físico. O undo não se aplica a alterações já gravadas. A busca atual encontra exercícios e abre a biblioteca; não é pesquisa remota nem filtragem editorial completa.

Build local sem variáveis Supabase: entrada e imports estáticos somam **425.108 bytes JS**, **137.873 bytes gzip**, contra 337.515/106.650 na base 5.0. A diferença é +87.593 bytes JS/+31.223 gzip. O chunk domMax soma aproximadamente 61,67 kB/19,58 kB gzip; gráficos e drag and drop permanecem em rotas/chunks separados. CSS e requisições lazy não fazem parte da soma de entrada. Repetir a medição com as variáveis reais antes da publicação.

O ganho visual tem custo de JavaScript: medimos bundle em vez de alegar melhoria de Lighthouse. Compare números no mesmo escopo e configuração. domMax é assíncrono, mas é solicitado após a montagem do sistema de movimento; não é carregado somente depois de uma interação.

## Revisão antes da publicação

- Integrar as PRs anteriores e esta PR na ordem da pilha.
- Executar npm ci, npm test, npm run build, npm run test:e2e e check:production.
- Seguir docs/PRODUCTION-READINESS.md para Supabase, migrations, RLS, redirects, domínio, backups e consentimento de IA.
- Repetir cadastro/login, edição, reagendamento, sessão/relatório e exclusão em homologação com duas contas reais.
- Conferir modo reduzido do sistema, tema claro e toque em dispositivo físico.
- Conferir validade dos conteúdos competitivos antes de divulgar a plataforma.
- Nenhuma nova variável ou migration é exigida por esta mudança visual. Não há serviços pagos ativados.
