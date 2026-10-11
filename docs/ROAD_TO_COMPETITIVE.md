# kyrven — Road to Competitive

Implementação sobre `feat/meta-aware-mastery`, commit `ea6d975`, preservando a pilha cumulativa dos PRs 1–14. Esta entrega não mescla a pilha nem publica o site. Migração incremental: `202610100023_road_to_competitive.sql`.

## Produto e sequência editorial

A jornada é um ciclo privado de estudo e prática. Os 30 dias são uma referência de calendário, não uma dose de treino, prazo de profissionalização ou prazo de expiração do progresso. Quatro etapas abertas, repetíveis e sem bloqueio por nota:

| Etapa | Intenção | Construção | Zero Build |
| --- | --- | --- | --- |
| 1 — Fundamentos | Entender o jogo e experimentar uma habilidade por vez | Primeira partida, controles, inventário/tempestade, mira, materiais e peças/edição | Primeira partida, controles, inventário/tempestade, mira e cobertura/mobilidade |
| 2 — Controle e aplicação | Praticar proteção e uma decisão simples | Peeks/trocas e Piece Control/Box Fight/Realistic | Peeks/trocas e chegada ao mapa |
| 3 — Tomada de decisão | Explicar escolhas usando informação disponível | Drop, rotações e camadas/movimentação de Endgame | Rotações e Endgame de Zero Build |
| 4 — Integração e avaliação | Revisar uma partida e repetir condições comparáveis | VOD Review e diferenças entre partidas casuais, Ranked, Scrims e torneios | VOD Review e diferenças entre partidas casuais, Ranked, Scrims e torneios |

São 13 aulas em Construção e 11 em Zero Build, com 15 aulas únicas do currículo existente, todas com texto, exemplos, objetivos, atividade guiada, critérios e fontes. Não foram criadas aulas vazias ou códigos de mapa. Os vídeos e materiais existentes podem ser consultados pela página publicada da aula; não alegamos análise audiovisual nem criamos vídeos novos. O catálogo continua administrável pelos recursos editoriais existentes. As definições versionadas dos dois programas são revisadas no código, sem publicação arbitrária pelo cliente.

O ciclo preserva uma cópia das aulas e perguntas disponíveis no início. Isso permite consultar a versão efetivamente estudada após edições ou arquivamento da fonte. O link de cada aula permite consultar também a versão publicada. Conteúdo relacionado a uma temporada mantém seu escopo e limitações editoriais; esta sequência de fundamentos não é uma afirmação de meta atual.

## Pesquisa consultada e limites

Consulta: 2026-10-10, America/Sao_Paulo. A sequência é uma decisão editorial, não uma metodologia clinicamente ou cientificamente validada para Fortnite.

- [Epic Games — Construção Zero](https://www.fortnite.com/news/fortnite-zero-build-take-the-offensive-in-this-no-build-battle-royale?lang=pt-BR): apresentação oficial histórica de 2022. Sustenta a distinção entre modalidades, não confirma itens, valores ou regulamentos da temporada atual. A página foi consultada; o acesso textual disponível é limitado. Nenhum vídeo foi analisado.
- [Trumble et al. — revisão sistemática, PMID 37615780](https://pubmed.ncbi.nlm.nih.gov/37615780/): resumo consultado. Prática distribuída e recuperação de informação apresentaram benefícios em estudos de educação em saúde, com heterogeneidade de intervenções e avaliações. Sustenta oferecer revisão e perguntas com feedback como recursos educacionais; não valida transferência motora para Fortnite, duração diária, curva de progressão ou quatro semanas universais.
- [Dutra et al. — ensaio de habilidades motoras seriais, PMID 40778584](https://pubmed.ncbi.nlm.nih.gov/40778584/): resumo consultado. Crianças realizaram uma tarefa de sequência de teclas; intervalos curtos entre tentativas tiveram melhores resultados naquele protocolo. É um contraponto à generalização de que distribuir qualquer prática seria sempre superior. Não justifica impor esses intervalos ou cargas a jogadores de Fortnite.
- Mantidas as referências originais de cada aula e a base de pesquisa anterior (`TRAINING_RESEARCH`, `TRAINING_METHODOLOGY`, registro de evidências e taxonomia). As relações entre aula, exercício e competência são editoriais explícitas.

As pausas atendem à disponibilidade e preferência do jogador. Não existe duração universal cientificamente perfeita, sequência garantida ou incentivo a preencher todo tempo livre. A avaliação de conceitos mede respostas ao instrumento editorial, não habilidade competitiva precisa nem prontidão profissional.

## Fluxos reais

1. Em `/app/road`, informar modalidade, experiência declarada, dispositivo, objetivo, dificuldade opcional e disponibilidade. Avaliação inicial prática é opcional.
2. Confirmar criação do ciclo. Nenhuma atividade é adicionada à agenda nesta etapa.
3. Abrir aulas preservadas; estudar, revisar, responder perguntas ou pular por declaração própria. Pular não é evidência de aprendizagem. Cada registro pode incluir observação privada.
4. Escolher uma etapa e uma semana. O Skill Maxing existente seleciona exercícios publicados e atualmente verificados, compatíveis com modalidade/dispositivo/experiência e competências da etapa. Metas, histórico e diversidade continuam utilizando as regras existentes.
5. Revisar horários, duração e exercícios, inclusive atividades personalizadas, por meio do construtor existente. A prévia não escreve no banco.
6. Confirmar explicitamente a agenda. A transação revalida disponibilidade persistida, conflitos, permissões, duração e catálogo. Planeja apenas uma semana; a proposta pode ser repetida ou ajustada nas seguintes.
7. Executar no player existente, com pausa, recuperação, conclusão manual, resultados e observações. O timer não marca aprendizagem ou exercício concluído automaticamente.
8. Consultar histórico e relatório do ciclo, exportar JSON, revisar metas existentes e iniciar outro ciclo com as preferências anteriores.

A preferência por amigos/adversários habilita atividades compatíveis quando disponíveis, sem criar matchmaking. Exercícios podem ser repetidos e atividades personalizadas entram pelo construtor já existente. Não foi criado um segundo calendário, player, catálogo, sistema de metas ou ledger de XP.

## Evidências e relatório

- Estudo concluído/revisado, conteúdo pulado por declaração, avaliação conceitual e execução prática são contagens distintas.
- Marcos de estudo indicam somente que todas as aulas de uma etapa foram estudadas. Não concedem XP extra nem simulam conquista de habilidade.
- Sessões têm vínculo próprio com o ciclo, preservado mesmo se a rotina for excluída. Os resultados continuam no histórico e nos relatórios existentes.
- Comparações exigem exercício, métrica, configuração, unidade/versão, condições e contexto compatíveis. Repetições na mesma sessão não viram observações independentes. Protocolos medidos precisam ter unidade e versão correspondentes; registros futuros não são usados.
- O relatório não atribui causas, não transforma volume em evolução e informa ausência de dados suficientes. Metas relacionadas são as registradas no sistema existente, sem conclusão automática pela leitura.
- Dificuldades/observações refletem declarações e notas de prática; mensagens operacionais de pausa ou alteração de preferência não são apresentadas como dificuldades.
- O próximo ciclo usa o objetivo, disponibilidade e histórico existentes; não aumenta o volume automaticamente.

## Persistência, privacidade e segurança

`road_programs` é uma definição pública versionada, somente leitura para o cliente. `learning_journeys`, `learning_journey_events` e `learning_journey_batches` possuem RLS por usuário e acesso de leitura autenticado. Alterações são RPCs tipadas, com `search_path` vazio, validação e autenticação. Não há gravação direta do cliente em progresso ou snapshots.

- O servidor constrói snapshots a partir das aulas publicadas da modalidade; não aceita conteúdo de aula, respostas corretas ou progresso forjado pelo frontend.
- Um ciclo aberto por conta, limite de cinco criações por dia e 120 registros de aprendizagem por hora; o ledger Academy mantém seu próprio limite. Preferências não mudam modalidade de um ciclo já criado.
- Aprovação da semana reutiliza as transações atômicas de Skill Maxing e Meta Training e vincula o resultado ao ciclo na mesma transação. Token de confirmação protege retry idempotente e uso em outra etapa/conta.
- A ordem de locks preserva o calendário e o perfil existentes. Disponibilidade alterada exige nova prévia. Nenhuma alteração silenciosa da agenda.
- Um usuário não consegue associar uma rotina à jornada privada de outra conta. O contexto de aprendizagem da sessão é derivado no servidor e imutável enquanto o ciclo existir.
- Pausar o ciclo não cancela ou move compromissos já confirmados. Isso é informado na interface; o usuário gerencia os compromissos no calendário.
- Excluir um ciclo exige confirmação específica e remove eventos/vínculos da jornada. Treinos, calendário e registros gerais da Academy permanecem separadamente gerenciáveis. Exclusão de conta utiliza as cascatas existentes; exportação da conta inclui os novos registros.
- A demonstração usa chaves próprias `clutchfolio-road-demo-v1`, conta `demo`, separada do banco real. Escritas conjuntas são restauradas em caso de falha de armazenamento; testes simulam falta de espaço. Limpar dados locais no navegador continua sendo uma ação que remove a demonstração.
- kyrven coach recebe somente modalidade, estado, objetivo e contagens da jornada escolhida, quando a personalização foi autorizada. Familiaridade, observações, respostas e notas privadas não são enviados nesse resumo. Conteúdo e objetivos permanecem dados, não comandos. Ações de agenda continuam tipadas e confirmadas.

## Integrações e operação

Acessos no dashboard, Academy, Training Center, planejador, relatórios e busca de navegação. A jornada abre biblioteca, calendário, histórico, metas, Coach e central competitiva existentes. Rota carregada sob demanda; nenhuma dependência adicional, serviço pago, scraping, automação com site fechado ou publicação.

A assistência da jornada e o planejamento são determinísticos. Não há custo de tokens para esses recursos. IA externa continua opcional, com consentimento, provedor, orçamento e limites anteriores. Banco utiliza a infraestrutura Supabase existente e suas cotas, sem promessa de operação gratuita ilimitada.

## Validação e limitações

- Novos testes de domínio: duas modalidades, aulas completas, lacunas editoriais, declaração versus evidência, sessões curtas, ausência de dados e resumo contextual.
- Banco PostgreSQL/PGlite aplica todas as 23 migrations: autenticação, isolamento, snapshots, perguntas históricas, transições, limites, aprovação/retry/rollback, conflito de agenda, vínculo após exclusão de rotina, consentimento do Coach e exclusão específica.
- Demonstração: persistência, avaliação, pausa/retomada, falhas de armazenamento com rollback, aprovação sem duplicação e mudança de disponibilidade sem mover agenda.
- Navegador: fluxo completo em desktop, tablet e mobile, Construção/Zero Build, resultados, recarga, avaliação, relatório final, axe WCAG A/AA, erros de JavaScript e largura. Resultados consolidados do commit constam no PR.
- Corrigida a disposição mobile das ações em aulas: botões passam a ocupar linhas acessíveis, evitando transbordamento e dificuldade de toque.
- Corrigida a fixture de VOD do teste existente para usar a data de São Paulo, pois a virada UTC não deve tornar uma revisão de teste futura no fuso consultado pelo Coach. Regra de produção preservada.

Não foram aplicadas migrations em Supabase remoto nem validados login real, contas reais conectadas ou latência de produção. Antes de disponibilizar a usuários: aplicar 023 em staging após 001–022, validar duas contas, criação concorrente, recuperação de sessão, conflitos e exclusão de conta; atualizar a função Coach; conferir corpus/editorial, consentimento e backups. O currículo inicial é limitado às aulas efetivamente publicadas e não cobre todos os aspectos avançados. Novas versões do programa exigem revisão editorial no código.

**Sem deploy, merge da pilha ou promessa de profissionalização em 30 dias.**
