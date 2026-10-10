# Implementação, validação e publicação

## Entrega funcional

- `/academy/research`: pesquisa por competência, categoria e modalidade; glossário com contexto e exemplo; princípios; fontes classificadas; cinco trilhas editáveis.
- Biblioteca: filtros por competência e finalidade, critério de conclusão, aplicação, limitações, prazo de revisão e links para evidências.
- Construtor existente: a trilha abre um rascunho com exercícios reais. Nenhuma rotina é salva sem o botão de confirmação. Depois de salvar, agenda, sessão, histórico e relatórios continuam pelos fluxos existentes.
- Administração: filtro de revisão pendente/vencida, seleção de competências e referências, finalidade, critérios, limitações, notas, prazo e retirada. As revisões usam `content_revision_history` existente. Também foi corrigida a edição de arrays de categorias e do objeto de medição no formulário genérico.
- Catálogo: 27 exercícios enriquecidos, quatro atividades adicionais e uma nova ilha confirmada na listagem. IDs e protocolos dos exercícios anteriores não mudam.

## Arquitetura

`src/data/training-knowledge.json` é o corpus editorial versionado: 54 competências, 26 referências (uma inacessível, explicitamente excluída das referências de exercícios), nove princípios e cinco trilhas. `exercise-research.json` fornece metadados dos exercícios existentes com defaults compartilhados; `research-exercises.json` contém as quatro novas atividades. Fontes e taxonomia são atualizadas por PR, não pelo painel administrativo.

A migration **010** adiciona `exercises.research` e a tabela pública `training_knowledge`. Não cria entidades privadas redundantes. A migration **011** publica o corpus e os novos exercícios. O seed só enriquece um exercício existente quando instruções, fonte, modalidade e protocolo de medição ainda correspondem ao original; registros já modificados por um editor ficam para revisão manual. Nenhuma migration histórica foi alterada.

`node scripts/research-seed.mjs` gera a migration 011 e o índice mínimo de validação do frontend; `--check` verifica divergências sem escrever. Depois que 011 for aplicada em qualquer ambiente compartilhado, atualizações futuras precisam de **nova migration**; não regenerar uma migration já aplicada. O corpus da interface corresponde ao build; o banco mantém cópia versionada para integridade e futura recuperação no servidor. Não se deve alterar a cópia SQL isoladamente.

A validação usa Zod no cliente e trigger no PostgreSQL: IDs conhecidos, referências acessíveis, modalidades compatíveis, campos limitados, datas com fuso, ausência de IDs duplicados e retirada acompanhada de despublicação. A tabela de conhecimento só concede SELECT público. Escritas de exercícios continuam sujeitas ao papel administrativo e auditoria existentes. Não há mudança em autenticação, dados privados, XP, métricas históricas ou políticas de exclusão de conta.

A página de pesquisa e o corpus completo são carregados em módulos separados. A validação global usa apenas o índice de IDs/modalidades/acesso; metadados repetidos compartilham defaults. Não foram adicionadas dependências. Zod fica em chunk compartilhado separado para cache; isso não é uma alegação de menor transferência total. `retrieveTrainingKnowledge` prepara uma projeção pública limitada para uso futuro: dados de referência, sem comandos, sem texto externo executável e sem dados de usuários. Este PR não liga essa função a um novo provedor ou ao backend do Coach; não promete respostas generativas novas.

## Testes e limites

Os resultados finais verificáveis estão em `VALIDATION.md` nesta pasta. Os testes de banco executam PostgreSQL via PGlite com papéis anon/authenticated, auth.uid e migrations reais. Isso cobre lógica SQL e RLS localmente; não valida configuração de uma instância Supabase remota, Auth/SMTP, Edge Functions ou permissões do ambiente de produção.

Os testes de navegador usam Chromium real com a demonstração local identificada. Não houve login com conta real nem cadastro remoto de conteúdo. Capturas e relatórios ficam nos artefatos do runner, não são imagens inventadas. Os testes anteriores continuam exercitando criação, repetição de exercícios, agendamento, execução, recuperação, conclusão, histórico, relatórios, Coach e exclusão local.

## Checklist de homologação

1. Revisar a sequência de PRs e aplicar somente a cadeia corretamente integrada. Este PR tem base `feat/performance-intelligence`, não `main`.
2. Fazer backup e aplicar 010 e 011 primeiro em staging, após 001–009. Conferir quantidade de registros e exercícios que permaneceram sem contexto por terem sido editados.
3. Com duas contas reais, verificar que rotinas, sessões e resultados permanecem isolados; usar conta editorial separada para revisar/despublicar um exercício e consultar a auditoria.
4. Abrir uma trilha, ajustar, salvar, agendar, executar, registrar resultado, finalizar e consultar o relatório. Atualizar a página entre etapas. Confirmar preservação de sessões anteriores.
5. Rever o corpus e datas antes de publicação; conferir os recursos das ilhas no jogo caso se deseje declarar teste funcional. Não marcar metodologia como cientificamente validada.
6. Configurar as variáveis e o checklist de produção já existentes (`docs/PRODUCTION-READINESS.md`). A nova área não exige chaves, APIs pagas ou envio de dados pessoais.
7. Validar domínio, políticas públicas e links. Nenhum deploy ou migration remota foi executado por este trabalho.

Para reverter a interface, reverter o commit do aplicativo; as colunas/tabelas aditivas podem permanecer sem uso. Evitar apagar o histórico editorial ou snapshots para fazer rollback. Despublicar atividades novas, se necessário, preserva referências históricas melhor que removê-las.
