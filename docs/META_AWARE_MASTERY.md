# kyrven — Meta-aware Skill Maxing

Implementação sobre `feat/skill-maxing-engine`, commit `f32cb3f5b2e89bc3b19f45ae688c6ce5bace877d`. Os PRs 1–13 estavam abertos e encadeados: esta base contém suas mudanças cumulativas, embora ainda não tenham sido mesclados à main. Nenhum PR anterior foi descartado, mesclado ou substituído. Esta entrega não publica a aplicação.

## Fluxos implementados

- `/app/meta-training`: preferências competitivas editáveis (modo principal/secundários, BR/Reload/Zero Build, formato de prática, preferência individual/equipe e contexto editorial), filtros por competência e nível, links oficiais, distinção entre fundamento geral e vínculo editorial, montagem de rotina combinando/repetindo exercícios com o Training Builder existente.
- `/app/evolution-plan`: contexto opcional exato e formato de prática independente do formato oficial do evento, vinculação editorial como critério de desempate ponderado no motor existente; preserva modalidade, dispositivo, objetivos ponderados, avaliações, disponibilidade, compromissos, variedade e regras de recuperação. Modo manual e assistido continuam editáveis. Fontes e limitações acompanham explicações. Não agenda antes de confirmação.
- Confirmação contextual usa `confirm_meta_evolution_plan`, um invólucro transacional de `confirm_evolution_plan`, mantendo todas as validações, horários IANA, conflitos, limites e recibos existentes. O token fica vinculado à proposta completa **e** às referências do meta. Referência revisada/expirada entre prévia e confirmação rejeita a operação inteira. Repetir a mesma confirmação retorna o recibo original.
- Planos e VODs recebem contexto derivado no servidor. Sessões guardam uma cópia imutável do contexto; editar/arquivar a rotina ou publicar uma revisão editorial não altera esse histórico. Um lock compartilhado na rotina mantém exercícios e contexto da mesma edição durante a abertura da sessão.
- Revisões opcionais avisam sobre mudança, retirada ou vencimento de referências. Não alteram rotinas ou agenda automaticamente. O editor existente permite personalizar a próxima sessão; não há migração silenciosa de resultados.
- Guias de localização confirmados podem receber favoritos e notas **privadas**, vinculados à revisão original. Fontes e histórico continuam na página pública do Meta Center.
- VOD Review manual registra contexto (versão, modo, formato, região/contexto competitivo) junto dos objetivos, competências, exercícios e marcadores existentes; filtros e recorrência de dificuldades respeitam agrupamentos de contexto.
- Relatórios e Coach deixam de comparar resultados de versões/modos/formatos/regiões/contextos competitivos diferentes, mantendo também unidade, protocolo, cenário, dispositivo, sensibilidade e configuração. Legado sem contexto fica em grupo separado. O relatório mostra a distribuição dos contextos registrados. Volume de treino e participação não comprovam melhoria.
- Coach consultável a partir do Meta Center de treinamento e preparação de competições: consulta autenticada, limitada a quatro referências públicas atuais, da seleção exata, com fontes datadas e limitações. Funciona no modo por regras identificado; um provedor configurado continua opcional e sujeito ao consentimento existente. Perfil competitivo privado somente com personalização autorizada. Os dados da equipe não são enviados ao Coach.
- Marca visível, títulos, metadados, pré-renderização e linguagem do produto atualizados para **kyrven** / **kyrven academy** / **kyrven coach**. Chaves de armazenamento, IDs de métricas, nomes de funções, rotas, domínio e repositório permanecem compatíveis. Não foram criados recrutamento, kyrven esports ou kyrven development.

## Equipes com consentimento

`/app/teams` usa grupos privados extensíveis (capacidade 2–8 no servidor; UI 2, 3 ou 4). Capacidade não declara formato de torneio vigente.

1. Responsável cria o grupo e fornece seu apelido voluntariamente.
2. Gera convite privado de alta entropia (dois UUIDs aleatórios), válido por 24 horas, de uso único. Apenas o hash é persistido; nenhum diretório de jogadores ou mensagem para desconhecidos.
3. Convidado autenticado confirma **ACEITAR** e informa o apelido que deseja compartilhar. RLS passa a permitir leitura somente desse grupo. A criação do convite autoriza o vínculo por parte do responsável; o destinatário dá o segundo aceite.
4. Integrantes propõem sessões com objetivo, exercícios publicados/verificados, contexto, horário em seu fuso e duração. **AGENDAR** é uma confirmação específica. Nenhuma agenda particular de outro integrante é alterada.
5. Cada usuário confirma sua participação; o backend consulta seus conflitos sem divulgar nomes/horários de compromissos privados aos colegas. Aceites também entram nos mecanismos existentes de conflito do Coach, calendário e preparação competitiva. O calendário pessoal exibe separadamente sessões compartilhadas que o usuário aceitou.
6. Cada integrante pode copiar os exercícios para sua própria rotina e usar o player real existente. Resultados da execução ficam particulares; presença/observação compartilhada é registrada separadamente e manualmente. Não há transferência automática de desempenho individual para uma nota coletiva, nem XP por aceitar sessão.
7. Metas, notas e VODs coletivos exigem **COMPARTILHAR**; vídeos exigem autorização de uso. Apenas o autor pode excluir o seu material. Cancelar sessão preserva participação registrada. Sair revoga acesso e remove contribuições compartilhadas do próprio usuário; responsável pode excluir a equipe com confirmação destrutiva específica. Contas e treinos privados são preservados.

A demonstração local **não simula consentimento de outra pessoa**: equipes exigem contas autenticadas e banco configurado. Testes de banco executam o vínculo com quatro identidades distintas. Não há matchmaking, chat, integração dentro do Fortnite ou notificações com o site fechado.

## Fonte e atualidade

A base existente é preservada: `src/data/meta-knowledge.json`, migrations 014–016 e documentação de pesquisa anterior. O sistema não amplia a cobertura factual com registros inventados. `meta_entries` permanece append-only, com validação de fontes, revisão encadeada, autoria administrativa e auditoria. O CMS existente continua sendo o mecanismo de atualização de mecânicas/mapas/regras.

Fontes oficiais consultadas nesta etapa, em 2026-10-10 (leitura de páginas, não análise audiovisual):

| Fonte | Constatação útil | Limite |
| --- | --- | --- |
| [Documentação da API de Dados do Fortnite](https://dev.epicgames.com/documentation/pt-br/fortnite/using-fortnite-data-api-in-fortnite) | API pública de métricas agregadas de ilhas; não compartilha dados pessoais; possui limites de taxa e janela documentada | Não fornece por si só regulamentação, alterações de mecânicas ou resultados individuais; não sustenta sincronização automática de meta |
| [Biblioteca oficial de regras](https://www.fortnite.com/competitive/rules-guidelines/rules-library?lang=pt-BR&region=BR) | Regras por evento e temporada; existem documentos distintos de FNCS Solo e outros campeonatos | Um formato não deve ser extrapolado a Ranked ou a outro evento; conferir o documento específico |
| [Atualizações de programação e competições do FNCS](https://www.fortnite.com/news/fncs-schedule-and-competitive-updates?lang=pt-BR) | Comunicado datado diferencia competições de Duplas e torneio Solo posterior | Publicação de maio não substitui regulamento vigente ou verificação dos horários atuais |
| [Swagger oficial da Data API](https://api.fortnite.com/ecosystem/v1/docs/) | Endpoint oficialmente documentado para engajamento de ilhas | Não habilitamos cron, scraping de endpoints privados ou um feed fictício de alterações |

Não foi identificada nessas fontes uma integração documentada que forneça o corpus completo exigido de meta/regras/mapas. Por isso, nenhuma sincronização automática foi ativada. Não há promessa de tempo real. Conteúdo externo continua sendo dados de referência, não instruções do sistema. Fontes com acesso apenas a metadados ou indisponíveis não fundamentam respostas atuais. Verificações futuras, revisão expirada, edição substituída ou retirada não são tratadas como conhecimento atual. Contextos históricos selecionados são identificados; suas referências não confirmam a versão mais recente.

### Cobertura e lacunas

O catálogo preservado contém BR Construção, Zero Build, Reload Construção/Zero Build e contextos específicos de eventos. Muitos contextos têm formato **não especificado**; isso é exibido e não convertido implicitamente em Solo/Duplas/Trios. Não há atualmente contexto editorial confirmado de torneio Trio: o recurso de grupos de três funciona sem fabricar um regulamento. Vínculos de treino são relações **editoriais**, não prova científica de transferência, eficácia ou causalidade do meta. Relações herdadas de revisão anterior são sinalizadas.

Versão registrada não garante ausência de hotfix posterior. Informação factual não equivale a disponibilidade dentro de todo torneio. Fontes, validade e disponibilidade precisam ser revistas pelo editor. Os timestamps futuros presentes na base anterior são preservados e ficam inelegíveis até a sua validade; os testes que usam essa base controlam o relógio explicitamente. Fixtures editoriais criadas em testes de banco são dados simulados **somente de testes**.

## Segurança e arquitetura

Migrations incrementais **021** e **022**, sem reescrever migrations anteriores:

- Amplia `competitive_preferences` existente, preservando regiões/lembretes. Campos competitivos novos são opcionais para registros legados.
- Contexto e referências derivados e validados no servidor; cliente não pode gravar um snapshot arbitrário. Versão/mode/format vêm do corpus autorizado. Verificação de modalidade inclui atividades personalizadas e planos de modo `both`.
- `meta_plan_approvals` com RLS por dono e vínculo ao recibo existente. Mesmo ordenamento de locks do aprovador original (calendário antes de perfil), evitando inversão entre os dois caminhos.
- `meta_study_notes` com RLS por usuário. Exportação de dados inclui notas, recibos contextuais e somente as contribuições próprias de equipe; limpeza local mantém chaves compatíveis e abrange novos registros.
- Tabelas de equipe com SELECT condicionado à associação aceita. Sem grants de escrita direta a clientes: mutações somente via RPC autenticadas e tipadas. Helpers internos com privilégios mínimos. Convites fora da equipe não revelam nomes ou dados dos membros.
- Limites: 5 equipes criadas por usuário, 10 associações, 10 convites/equipe/dia, 20 novas sessões/equipe/dia, 50 materiais/autor/equipe/dia; capacidade protegida por lock e confirmação transacional. Limites do planejamento/Coach anteriores continuam ativos.
- Não é possível alterar dados particulares de outro jogador, mesmo sendo responsável de equipe. Apenas observações compartilhadas explicitamente são visíveis aos integrantes. Nenhuma chave administrativa no frontend.
- Usuários menores não recebem diretório, contatos com desconhecidos, incentivo de volume ou metas de excesso de prática. Ainda é necessária revisão jurídica de termos/privacidade e decisões operacionais antes de uso público por adolescentes.

## Custos, desempenho e operação

Não adicionamos biblioteca, serviço pago, provedor novo ou chamadas automáticas a APIs externas. Planejamento/revisão por regras e demonstração não consomem tokens de modelo. Operação real depende das cotas/preços do projeto Supabase (armazenamento, tráfego e funções), sem pressupor gratuidade ilimitada. O Coach generativo mantém controles e custos descritos em `docs/CLUTCH_COACH.md` e configuração existente; estimativas anteriores precisam ser reconferidas antes da ativação. Nenhum serviço pago foi ativado.

Páginas novas são lazy-loaded. Relatórios usam snapshots locais; notas/equipes consultam somente dados autorizados, com paginação e limite explícito. Recuperação do Coach limita conteúdo e quantidade de referências. Nenhum número de Lighthouse foi inventado. Consulte resultados de build/relatório de bundle no PR; medições de produção real ainda não foram realizadas.

## Verificação e limites de aceitação

Novos testes em `tests/meta-training.test.ts`, `tests/meta-mastery-database.test.ts` e `e2e/meta-mastery.spec.ts`:

- Contexto exato, fontes utilizáveis, referência expirada/futura/substituída, incompatibilidade de modo, relações fundamentadas e aviso sem apagar histórico.
- Snapshot derivado no banco, imutabilidade histórica, isolamento, confirmação contextual idempotente e rollback.
- Duplas/Trio, dois aceites, limite de capacidade, revogação, negação a estranho, proteção de registros pessoais, compartilhamento autorizado e saída.
- Contexto separado em resultados e assistência sem inventar conhecimento atual.
- Chromium desktop/tablet/mobile: perfil persistente, exercícios repetidos/combinados, Training Builder real, contexto de VOD persistido, referências do Coach, acessibilidade axe, largura mobile e identidade preservando storage.
- Suítes anteriores continuam cobrindo execução, agendamento, recorrência, XP idempotente, recuperação de timer, histórico e relatórios.

PGlite executa todas as migrations reais com roles `anon`/`authenticated` e `auth.uid()` controlado. Isso **não equivale** a aplicar migrations no Supabase remoto, testar Supabase Auth real, concorrência multi-conexão ou operar duas contas no navegador conectado. Nenhuma migration foi aplicada ao banco de produção. Falhas do provedor, limites do Coach e permissões editoriais continuam nos testes anteriores. Os resultados finais verificáveis estão no PR.

Ainda não implementados: interseção automática de disponibilidade da equipe; edição recorrente de séries coletivas; métricas quantitativas de metas coletivas; vinculação automática de participação à finalização da sessão privada; reaplicação em lote de revisões do meta. Há caminhos manuais reais, com confirmações, sem apresentar essas automações como existentes.

## Antes de qualquer publicação

- Revisar e integrar a sequência de PRs na ordem correta, sem começar de main desatualizada.
- Backup do banco e aplicação incremental 021/022 em staging; testar rollback de negócio e tabelas/RLS com duas ou três contas reais.
- Atualizar função `clutch-coach` no ambiente autorizado, mantendo CORS, autenticação, limites e consentimento de provedor.
- Validar login/redirect do convite com usuário novo, convite expirado, saída e exclusão de conta/grupo; conferir conflitos e fusos no Supabase real.
- Revisar corpus e hotfixes, fontes, versões e permissões editoriais; não preencher lacunas com suposições.
- Revisar privacidade, governança de grupos e materiais autorizados para adolescentes.
- Confirmar cotas, backups, monitoramento e variáveis já documentadas nas versões anteriores.
- Validar build, testes, mobile, tema claro/escuro e operação conectada antes de decidir publicar.

**O site permanece sem publicação.** A decisão de publicação é posterior, conforme a preferência do usuário de esperar maior prontidão.

## Resultado local consolidado

A validação completa e seu commit serão referenciados no PR. O build atual mantém code splitting; o chunk principal possui cerca de 418 kB sem compressão / 131 kB gzip. Isso não representa toda a transferência inicial: use `npm run report:bundle` para a soma de entrada e imports estáticos. A soma observada da entrada com imports estáticos é 558.820 bytes / 174.318 bytes gzip (exclui CSS, rotas lazy e overhead de transporte). Fontes/latência de rede e desempenho de dispositivos reais continuam fora desse número.

Verificação local: `npm test` — **236 testes / 40 arquivos**, `npm run build` — passou, `npm audit --audit-level=high` — **0 vulnerabilidades**. A suíte de navegador contém **57 cenários**; o resultado final e a validação do commit remoto estão registrados no PR.
