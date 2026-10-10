# Performance Intelligence — acompanhamento com evidências

Base: `feat/training-maxing`, commit `3c3e67a` (PR #6). Continuação incremental da pilha anterior, sem substituir autenticação, Supabase, rotinas, calendário, XP ou conteúdo. Esta PR não faz deploy e não aplica migrations em banco remoto.

## Auditoria e decisões

Já existiam avaliações pessoais, diário de sessão, resumo semanal salvo, planejamento assistido, recorrências, conflitos, benchmarks, metas numéricas, preparação por competição e Coach. Eles foram reutilizados.

Lacunas encontradas e tratadas:

- A seleção de exercícios por habilidade usava apenas uma categoria ampla. Tracking, shotgun, posicionamento e box fighting precisam de associações editoriais específicas. A seleção agora usa habilidades, título e tags, com bloqueio explícito de exercícios de construção para Construção Zero. Não é classificação científica de transferência de habilidade.
- Faltava distinguir variação observada, causa desconhecida e recomendação. O motor de análise é determinístico e não diagnostica fadiga, ansiedade ou capacidade do jogador.
- Repetições da mesma sessão não são avaliações independentes. O histórico completo permanece; diagnósticos de sequência usam a última medição do grupo em cada timestamp de conclusão de sessão. Isso exige que as condições do grupo continuem iguais.
- Metas tinham um booleano de conclusão, sem pausa, arquivo ou trilha de edição. As tabelas existentes foram ampliadas; mudanças preservam revisões privadas e não modificam XP.
- VOD Review era um exercício/diário, sem marcadores próprios. A nova entidade privada registra uma revisão manual, sem duplicar resultados de treino ou alegar análise por IA.
- O Coach não interpretava algumas perguntas de continuidade e não recebia a habilidade prioritária. Classificação e contexto foram ampliados com consentimento; texto livre de VOD e readiness continuam fora do contexto enviado a provedores.
- O formulário semanal não invalidava a prévia ao mudar horário/dias. Isso foi corrigido.
- A validação foi separada em módulo carregado sob demanda para não incorporar Zod no bundle inicial apenas para os novos formulários.

## Recursos e definições

### Minha Evolução

Rota `/app/evolution`, integrada ao dashboard, navegação e busca. Reúne perfil competitivo autodeclarado, prioridade salva no planejamento, avaliações pessoais, diagnóstico, comparações, distribuição, metas, agenda, histórico, favoritos e recursos educativos vigentes.

Períodos de 7/30/90 dias ou intervalo personalizado de até 366 dias, interpretados no fuso do perfil. Resultados futuros e sessões não concluídas são excluídos da análise. Exportação JSON contém intervalo, fuso, data de geração, resumo, evidências e registros do usuário do período.

XP representa participação em sessões, não rank do Fortnite nem uma medida universal de habilidade. A central não cria penalidades por descanso.

### Diagnósticos determinísticos

| Observação | Critério | Limitação |
| --- | --- | --- |
| Sequência favorável | Três sessões do mesmo grupo, diferenças estritas na direção definida no protocolo | Não comprova aprendizado geral ou transferência para partidas |
| Oscilação | Três sessões do mesmo grupo com inversão do sinal entre as diferenças | A causa permanece desconhecida |
| Poucos registros | Menos de dois resultados numéricos do exercício no período | Não compara habilidade entre pessoas |
| Comparação incompleta | Falta configuração; em protocolo padronizado, falta unidade/versão | Não preenche dados ausentes |
| Dificuldade recorrente | Mesma categoria em dois ou mais diários distintos do período | É relato pessoal, não diagnóstico |
| Atividade pendente | Horário e duração planejados passaram, sem conclusão vinculada | Falta de registro não prova que a prática não ocorreu |
| Meta sem medição recente | Sem resultado do protocolo/unidade/versão/configuração nos últimos 14 dias | Cenário e condições ainda devem ser conferidos antes de avaliar a meta |
| Meta vaga | Sem protocolo e sem critério escrito | Sugere um critério observável; não promete quantidade de melhoria |

Comparações mantêm exercício, métrica, unidade, versão, configuração e condições declaradas separados. Protocolos atuais não são aplicados retroativamente a resultados de versões incompatíveis. Grupos legados ficam identificados, sem direção científica presumida.

### Recomendações e planejamento

Escolha de habilidade específica, modalidade, nível autodeclarado, menor frequência documentada e duração disponível. Ordem estável e explicação visível; não há sorteio ou modelo generativo simulado. A proposta de rotina só persiste após confirmação. Escolher data/horário e confirmar o evento ocorre no planejador existente, que mantém conflitos, recorrências, exceções e reagendamento por arraste com prévia.

O planejamento salva habilidade principal e habilidades secundárias junto às preferências existentes. Disponibilidade e descanso permanecem sob controle do usuário. Preparação competitiva reutiliza o fluxo existente, fontes e validade; um evento antigo não ganha horários ou requisitos inventados.

### Metas

Criar/editar nome, critério, habilidade, exercícios relacionados, prazo opcional e protocolo numérico. Unidade, versão, configuração e limites são validados. Estados: em andamento, pausada, concluída pelo usuário e arquivada. Nenhum alvo observado conclui automaticamente uma meta.

`personal_goals.completed` continua compatível com os fluxos antigos. O trigger sincroniza o booleano com o estado e preserva a conclusão anterior ao arquivar, sem apagar conquistas. Retomar uma meta a coloca novamente em andamento. `goal_revisions` registra antes/depois e data, com leitura somente do proprietário. Rotinas relacionadas são identificadas por exercício, sem afirmar que uma sessão atendeu à meta.

### VOD Review Center

Rota `/app/vod`. Revisões privadas com partida, data, competição opcional, vídeo autorizado opcional, duração, habilidades, exercícios, notas e até 80 marcadores. Timestamp em segundos, situação, erro percebido/decisão correta/questão e observação. Permite editar, excluir com confirmação, pesquisar e filtrar. Categorias recorrentes são contadas por revisões distintas.

Links HTTPS de YouTube/Twitch com declaração explícita de permissão, sem iframe, upload, cópia ou processamento. A declaração não verifica licença automaticamente. Usuário continua responsável por ter permissão; o link é opcional. Registros livres são renderizados como texto, não HTML ou instruções.

### Readiness opcional

Na execução, permite energia/concentração percebidas (escala pessoal 1–5, campos opcionais), tempo disponível e preferência leve/habitual. Não é avaliação de saúde nem de habilidade. Registro associado a sessão própria, editável/excluível, sem alterar automaticamente duração, agenda, XP ou resultado. Não vai ao Coach nem a provedores externos; pode integrar a exportação privada solicitada pelo proprietário.

### Relatórios

Relatórios existentes recebem intervalo personalizado e evidências complementares. Resumo semanal salva também distribuição diária de sessões, comparações, diagnósticos, VODs e atividades sem conclusão registrada. Semanas anteriores continuam consultáveis; snapshots legados são identificados e podem ser atualizados explicitamente. Metas e diagnósticos de recência refletem os dados no momento da geração, não uma data histórica inferida de conclusão.

Gráficos interativos possuem alternativa textual e respeitam intensidade de movimento. Exportação semanal em texto inclui fatos e recomendações do snapshot. Comparações entre períodos se referem à frequência registrada; períodos parciais não são tratados como equivalentes.

### Coach

Perguntas de semana, habilidade acompanhada, treinos de tracking e dificuldades registradas usam o contexto autorizado. Projeção inclui prioridade de habilidade, avaliações resumidas sem notas livres, estados das metas e contagem de revisões manuais de VOD/categorias. Não inclui vídeo, marcadores/textos de VOD, readiness ou histórico completo de revisão de metas.

Backend filtra sempre pelo usuário autenticado. Sem consentimento de contexto, esses dados não são retornados. Sem provedor, respostas continuam identificadas como regras; ações no calendário mantêm prévia tipada e confirmação.

## Migração e privacidade

Aplicar `202610100009_intelligence.sql` após 001–008. Amplia `skill_reviews`, `planning_preferences` e `personal_goals`; adiciona `goal_revisions`, `vod_reviews` e `training_readiness`. Não reescreve sessões ou resultados e não altera transações de XP.

RLS de dados novos restringe leitura/gravação ao proprietário; revisões de meta não aceitam update/insert de cliente. FK composta de readiness exige sessão da mesma conta. Triggers validam links, tipos, limites, referências publicadas, habilidades, marcadores, identidade e duração. VODs têm limite diário de 60 novas revisões por conta, conferido com lock do proprietário; edição não consome a cota. Novas entidades possuem cascade de exclusão com perfil; exportação inclui dados e auditoria privados.

Demonstração usa armazenamento local explicitamente identificado, com mesmas validações de formulário e separação das contas reais. Banco remoto exige migration antes de abrir os novos fluxos; não é feita migração silenciosa no cliente.

## Verificação e homologação

Verificações locais em 10/10/2026:

- `npm test`: 155 testes aprovados em 23 arquivos, incluindo 20 testes novos de domínio/PostgreSQL. Cobertura nova: isolamento por proprietário, consentimento e projeção do Coach, condições de comparação, ausência de dados, exclusão de resultados futuros/pulados, validação de metas/VOD, cota diária, auditoria privada, preservação da conclusão ao arquivar e FK de readiness.
- Navegador Chromium/Playwright: fluxo novo aprovado em desktop (1366×900), tablet (768×1024) e emulação Pixel 7. A suíte completa contém 30 cenários; a CI do PR executa a suíte, testes unitários, auditoria e build novamente. Não houve teste em aparelho físico.
- `npm run build`: aprovado, incluindo TypeScript do frontend e da função Coach. Entrada de 392,34 kB / 125,55 kB gzip; novas páginas e validação carregadas sob demanda. Sem dependências novas. São medidas do build, não resultados de Lighthouse.
- `npm audit --audit-level=high`: zero vulnerabilidades informadas pelo registro nesta execução. Não é garantia de segurança completa.
- `git diff --check`: aprovado.
- `npm run check:production`: bloqueado pela ausência de `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_SITE_URL`. Sitemap e pré-renderização editorial continuam opcionais e não foram gerados sem configuração.

O fluxo novo de navegador usa dados de teste na demonstração explicitamente identificada, e não dados de contas reais. Os checks axe incluem o conteúdo principal das páginas de Evolução e VOD. Capturas desktop/tablet/mobile foram inspecionadas; cadastro/login remoto e aparelhos físicos continuam pendentes de homologação.

### Organização dos arquivos

| Área | Arquivos principais |
| --- | --- |
| Experiência | `Evolution.tsx`, `Vod.tsx`, `GoalManager.tsx`, `SessionReadiness.tsx`, `ReportEvidence.tsx`, navegação, dashboard e CSS compartilhado |
| Domínio | `intelligence.ts`, `intelligence-report.ts`, `intelligence-validation.ts`, `intelligence-types.ts`, `skill-match.ts`, tipos e estado existentes |
| Integrações | Relatórios, semana, avaliações, execução, Training Center, planejamento, exportação e domínio compartilhado do Coach |
| Persistência | Migration incremental `202610100009_intelligence.sql` |
| Verificação | `tests/intelligence.test.ts`, `tests/intelligence-database.test.ts`, `e2e/intelligence.spec.ts` e ajustes nos testes anteriores |

Antes de publicar:

1. Integrar PRs anteriores em ordem; fazer backup e aplicar migration 009 em homologação.
2. Reimplantar a função Clutch Coach, sem configurar provedor pago automaticamente.
3. Configurar variáveis, URLs/redirects, Supabase e controles operacionais conforme `PRODUCTION-READINESS.md`.
4. Validar com duas contas reais: metas/estados/auditoria, VOD/referências, readiness/privacidade, agenda/sessão, exportação e exclusão.
5. Conferir fuso, semanas anteriores, registros legados, desconexão e persistência em dispositivos físicos.
6. Conferir temas, movimento reduzido, teclado e leitores de tela nas novas interfaces.

## Limitações e próximos passos

Não há análise automática ou hospedagem de vídeo, sincronização de rascunhos incompletos de VOD entre dispositivos, avaliação médica, nota universal de habilidade, prova automática de execução no Fortnite ou notificação com site fechado. Alterações não salvas do formulário de VOD não são persistidas; salvar a revisão também valida e inclui o marcador que estiver sendo editado com observação preenchida. Intensidade de movimento/tema continuam preferências locais do navegador; modalidade, dispositivo, objetivo, fuso, lembretes e planejamento são persistidos na conta.

Comparabilidade depende da consistência dos registros declarados. Sensibilidade/dispositivo/cenário não são extraídos automaticamente do jogo. Duas sessões legadas com mesmo timestamp não são contadas como avaliações distintas pelo diagnóstico. Histórico de metas começa nesta migration; datas anteriores de conclusão não são inventadas.

Supabase remoto, autenticação real, dispositivos físicos e requisitos legais específicos do serviço dependem de homologação e operação. Testes locais de PostgreSQL/Chromium não substituem essas etapas. Não houve teste de Fortnite, Lighthouse ou deploy.

Próximos incrementos: IDs explícitos de sessão nos grupos de diagnóstico, escolha persistida de condições comparáveis por meta, rascunhos de VOD recuperáveis com conflito, edição otimista versionada entre abas e snapshots mensais opcionais. Relatórios mensais atuais são gerados a partir dos registros preservados e podem ser exportados; somente resumos semanais possuem snapshot salvo no banco.
