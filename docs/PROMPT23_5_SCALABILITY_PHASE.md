# Prompt 23.5 — etapa própria para leitura de históricos

Base auditada: 961783a5317e222938599e64c0632eb8835842a1. Esta proposta documenta trabalho pendente; não configura infraestrutura e não declara KYR-039/KYR-040 corrigidos.

## Evidência e razão da separação

src/lib/store.tsx: readRows pagina em lotes de 500, interrompe após 10.000 linhas e refresh agrega perfil, planos, agenda, sessões, metas, XP e nove conjuntos adicionais. Os consumidores pressupõem coleções completas: Dashboard soma todas as transações de XP e encontra treino ativo/último diário; Evolution repete o total de XP; Reports filtra sessões e mostra progressão/transações; performance.ts calcula janelas atual/anterior e associa ocorrências; calendar.ts associa conclusões à recorrência. Aplicar LIMIT ou uma janela de datas apenas no provider alteraria silenciosamente XP, relatórios, recorrência e comparações. Remover o teto substituiria falha explícita por crescimento de memória e requisições sem limite.

A refatoração cruza contratos de dados, cálculos, calendário, exportação e invalidação de sessão. É desproporcional ao bloco de correção de cache e deve ser uma etapa própria, conforme a exceção expressa da Missão 3. Nenhuma permissão foi enfraquecida e nenhum truncamento silencioso foi introduzido.

## Contratos propostos

1. Separar estado operacional pequeno (perfil, preferências, rotina ativa, planos/agenda necessários à janela visível) de histórico.
2. Criar agregações server-side autenticadas de XP e métricas, preservando exatamente as fórmulas atuais. Nunca somar apenas a página carregada.
3. Introduzir páginas por cursor composto (created_at/started_at e UUID) com filtros de intervalo e proprietário impostos no servidor. Retornar next_cursor e resultados completos da página.
4. Consultar histórico de sessões, diários, revisões de metas e relatórios somente nas páginas consumidoras. Cancelar/inutilizar respostas por identidade e AAL usando a fronteira adicionada no Prompt 23.5.
5. Carregar correspondências de sessões para a janela do calendário; conflitos e idempotência permanecem garantidos nas RPCs.
6. Exportação percorre páginas com ordenação estável e informa conclusão; erro/revogação invalida o conjunto, sem produzir exportação declarada completa a partir de páginas parciais.
7. Substituir o erro de 10.000 linhas por navegação/filtros acessíveis, com tratamento de limites e métricas operacionais.

## Critérios de aceitação antes de encerrar os achados

- Fixtures exclusivamente sintéticas com mais de 10.000 linhas por proprietário e duas contas.
- Total de XP, comparações, períodos, agenda e exportação iguais ao cálculo integral de referência.
- Nenhum dado do proprietário B em páginas/contagens/cursors/exportação de A.
- Inserções concorrentes e empates de timestamp sem duplicação ou omissão indevida; documentar semântica de snapshot.
- Não buscar históricos em landing/biblioteca/dashboard quando dispensáveis; registrar número e tamanho de requisições.
- Troca de conta, logout e downgrade durante paginação sem reaplicar resultados antigos.
- Migrations incrementais, índices medidos com EXPLAIN em Postgres/Supabase identificado e regressões de RLS/grants.

## Limites administrativos residuais

O Prompt 23.5 adiciona páginas de questões/provas/atribuições/tentativas e histórico por tentativa, e controles de páginas para cargos/auditoria. KYR-022 permanece parcial: bolsas e seus objetivos/revisões, ciclos e comentários de recrutamento precisam de contratos independentes de paginação. As páginas de avaliações têm offset validado até 100.000; navegação com cursor deve substituir offsets grandes na etapa de escala. Não alterar o modelo competitivo ou direitos comerciais nesta etapa.

## Dependências externas

Projeto Supabase, staging, produção e zona Cloudflare continuam inexistentes ou não confirmados. Nenhum acesso a projeto de terceiro foi feito. Validação de planos de consulta, concorrência real/PostgREST e volume em ambiente identificado exige autorização posterior. Prompt 24 não foi iniciado.
