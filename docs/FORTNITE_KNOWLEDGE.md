# Fortnite Knowledge — base revisável e assistência especializada

## Continuidade e produto

Base: `feat/road-to-competitive`, commit `e8b3c3543e4b61e77fda1c1cacf03b93f62be841`. A pilha de PRs anteriores permanece aberta; este trabalho não parte da main e não altera autenticação, XP, calendário, resultados, contas ou currículo existente. Sem deploy, merge ou contratação de serviço.

`/knowledge` esclarece dúvidas de Fortnite usando conteúdo público selecionado. `/app/coach` continua responsável por assistência pessoal e organização. A página de conhecimento não lê perfil privado, agenda, equipe, resultados ou conversas. Há acesso pela central de ajuda, Academy, glossário/pesquisa, biblioteca, Meta Center, competitivo e busca global; não foi adicionada outra navegação extensa de chat.

Respostas determinísticas são identificadas como **base de conhecimento**, sem fingir geração. Incluem explicação, limitações, referências, revisão e materiais internos. Sem evidência atual suficiente, o sistema informa a lacuna. Não adiciona treinos nem altera agenda. A biblioteca e o construtor existentes continuam responsáveis por essas ações.

## Acervo e atribuição

A migration 024 publica 25 explicações iniciais, com classificações e limites. Os conceitos práticos reutilizam a taxonomia editorial pesquisada em `training-knowledge.json`, com permalink da versão original. Essa camada de explicação não substitui exercícios, metas, artigos ou registros de meta. A recuperação consulta também o corpus Meta existente por versão e contexto, sem copiá-lo.

IGL (in-game leader) é explicado editorialmente como a função de coordenação de decisões durante a partida: comunicar rotações, posições e escolhas de confronto; os integrantes continuam fornecendo informação. É uma definição editorial original, não uma exigência oficial de torneio. O artigo Dignitas de Endgame não foi usado como se contivesse uma definição de IGL.

Storm Surge é descrito como mecanismo ligado à população remanescente em fases da tempestade e a jogadores abaixo de um limite de dano causado. A explicação distingue essa mecânica do dano normal da tempestade. A fonte oficial abaixo é histórica; números de 2022 **não** foram utilizados como valores atuais.

Fontes consultadas nesta implementação (10/10/2026 em São Paulo; execução UTC já em 11/10):

| Fonte | Verificação e uso | Limitação |
| --- | --- | --- |
| https://www.fortnite.com/news/fortnite-chapter-3-season-3-competitive-storm-surge-update | Texto oficial, publicado em 20/07/2022; definição geral de Surge | Fonte histórica; não confirma limiares atuais |
| https://www.fortnite.com/news/fncs-schedule-and-competitive-updates | Comunicado oficial de 29/05/2026, texto consultado | Diferencia anúncios e mudanças; não basta para confirmar regras vigentes de todo torneio |
| https://www.fortnite.com/news/fortnite-global-championship-2026-primer | Prévia oficial de 22/09/2026, texto consultado | Evento de setembro já passado; não tratado como torneio atual nem como fonte de resultados |
| https://dignitas.gg/articles/how-to-actually-win-endgames-in-fortnite | Guia de 22/06/2026, texto consultado | Análise editorial; não foi adotado como regulamento ou promessa de resultado |
| https://dev.epicgames.com/documentation/fortnite/fortnite-glossary | Busca encontrou a documentação, mas abertura retornou conteúdo incompleto | Não atribuídas definições competitivas novas a uma página que não pôde ser lida integralmente |
| Corpus kyrven `src/data/training-knowledge.json` | Taxonomia e exemplos já integrados, leitura do arquivo e preservação de origem | Definições editoriais, não fatos de temporada |

Não foram assistidos vídeos, executados mapas no Fortnite ou verificados resultados ao vivo. Não há pesquisa na internet em tempo real em cada consulta. Regras, premiações, horários, elegibilidade e loot exigem registros editoriais atualizados e contexto correto. Quando faltam, a resposta reconhece essa limitação.

## Administração: ensinar, revisar e publicar

`/admin/ai`, acessível como **Inteligência Artificial** no painel editorial, exige administrador real no backend. Não há administração na demonstração.

1. O administrador explica um conceito. `teachingProposal` organiza título, assunto e possível temporalidade por regras; a mensagem permanece local e não é salva automaticamente.
2. A proposta mostra exatamente o conteúdo e a classificação “informação do administrador”. Ambiguidades de temporada precisam ser preenchidas. É possível corrigir todos os campos.
3. Fontes podem ser adicionadas com campos simples. Há editor avançado para listas de fontes e links internos.
4. **Salvar rascunho** grava uma versão privada. Ausência de fonte permite preparar o rascunho, mas bloqueia publicação. Conteúdo não confirmado também não pode ser publicado.
5. O laboratório consulta versões salvas em modo privado. A opção de rascunhos exige autorização no servidor. Respostas anteriores podem ser mantidas na tela para comparação.
6. **Revisar publicação** abre prévia e confirmação específica. Somente depois a nova revisão passa à recuperação pública.
7. Editar um rascunho mantém a versão publicada anterior. Arquivar/despublicar retira a versão das consultas. Restaurar cria uma nova revisão de rascunho; não troca a versão pública silenciosamente.

Conflitos de assunto, modalidade e contexto bloqueiam publicação concorrente de registros independentes. Uma versão oficial não pode ser substituída por classificação não oficial. Conflitos detectados na recuperação produzem uma limitação explícita. Fontes são revisadas por pessoas: classificar uma URL como oficial não prova por si só que uma afirmação está correta.

## Recuperação e temporalidade

Recuperação lexical determinística, com normalização de acentos, aliases, termos relevantes, prioridade de título e busca bounded no Postgres. Não há embeddings, treinamento de pesos ou busca semântica simulada. Para este corpus pequeno, a abordagem evita nova dependência e custo; lacunas podem ser resolvidas por aliases e novas publicações sem deploy.

Conceitos gerais são separados de conteúdos de temporada. Conteúdos contextuais exigem temporada exata e, quando definidos, versão e região exatas; modalidade, datas de verificação e revisão também são verificadas. Perguntas sobre regras/meta atual não usam definições permanentes como prova de atualidade. Retornos são limitados a quatro trechos; recuperação de banco é limitada antes da resposta. A seleção restritiva pode recusar uma resposta mesmo existindo um material não encontrado, o que é preferível a inventar um fato.

O Coach reaproveita publicações gerais relevantes, de forma opcional durante o rollout, sem alterar sua lógica de contexto privado, histórico e confirmação. O Meta Center continua sendo a fonte única de mecânicas e versões específicas; editar conhecimento não modifica automaticamente planos do Skill Maxing.

## Operação, segurança e privacidade

- Migration incremental `202610100024_fortnite_knowledge.sql`: configurações, rascunhos, revisões imutáveis para clientes, uso privado e diagnósticos mínimos.
- RLS permite somente administradores ler rascunhos, revisões e diagnósticos. RPCs de escrita exigem papel administrativo real; clientes não têm INSERT/UPDATE/DELETE direto. Recuperação pública retorna somente payload aprovado e não expõe identidade administrativa.
- Validação no cliente/servidor, optimistic locking, bloqueio transacional editorial, fonte HTTPS sem credenciais, limite de tamanho e quota editorial. Publicação e operações de retirada/restauração usam confirmação tipada.
- A função `fortnite-knowledge` autentica JWT, mantém RLS, valida corpo incrementalmente, restringe origem, método e parâmetros; não usa service-role nem ferramentas de execução.
- Até 60 consultas/dia e 6/minuto por usuário, reduzíveis pelo administrador. IA externa compartilha a reserva existente do Coach: 20 chamadas/dia por usuário e 500 globais/dia. Falhas também consomem a reserva. Nenhum retry pago automático.
- Dados recuperados são referências não confiáveis, separados das instruções internas. O provedor existente valida saída estruturada e citações; não recebe chaves, registros privados ou ferramentas administrativas.
- O usuário precisa autorizar o envio da pergunta e dos trechos públicos, além de possuir o consentimento externo vigente do Coach. Sem chave, consentimento ou disponibilidade, permanece a explicação determinística.
- Perguntas não são persistidas como conversas. Por padrão, diagnósticos guardam apenas tipo/data; palavras-chave de lacunas são opt-in. Nenhuma conversa privada é incorporada ao corpus ou usada para treinar modelos pela plataforma. Retenção operacional: 30 dias. Logs não são medição total de faturamento.
- Reiniciar o laboratório limpa apenas respostas locais. Recarregar incrementa a versão de conhecimento. Não há cache persistente de respostas a apagar, nem exclusão de conhecimentos, configurações ou conversas de usuários.
- Status do provedor é consultado em endpoint autenticado administrativo: presença de configuração, nome e limites, nunca o valor da chave. Uma chave configurada não comprova disponibilidade comercial do serviço.

## Provedores e custos

Reutilizado `CoachProvider` e `OpenAIProvider` já existentes; não foi adicionada biblioteca redundante. O adaptador atual usa `gpt-4.1-mini-2025-04-14`, Responses API, saída JSON estruturada, `store:false`, timeout de 15 s, limite de entrada em bytes e 600 tokens de saída. `store:false` não equivale a Zero Data Retention; políticas do provedor ainda se aplicam.

Preços de texto consultados nas páginas oficiais abaixo; dólares por milhão de tokens, sem impostos, câmbio, cache ou serviços adicionais:

| Opção | Entrada / saída | Exemplo com 1.000 tokens de entrada + 600 de saída | Situação |
| --- | --- | --- | --- |
| GPT-4.1 mini | US$ 0,40 / 1,60 | US$ 0,00136/chamada | Adaptador reutilizado; chamadas dependem de chave/crédito |
| Gemini 2.5 Flash-Lite | US$ 0,10 / 0,40 | US$ 0,00034/chamada | Alternativa avaliada, não implementada; tier gratuito tem limites e política de melhoria de produtos diferente do pago |
| Claude Haiku 4.5 | US$ 1,00 / 5,00 | US$ 0,00400/chamada | Alternativa avaliada, não implementada |

Fontes: https://developers.openai.com/api/docs/models/gpt-4.1-mini ; https://ai.google.dev/gemini-api/docs/pricing ; https://platform.claude.com/docs/en/about-claude/pricing . Não foram realizados benchmarks comparativos de qualidade em português ou latência. Os limites por conta e disponibilidade precisam ser conferidos no projeto do provedor. As APIs podem ser integradas pelo servidor Supabase via HTTP; nenhuma requer expor chave no frontend. Respostas estruturadas são essenciais, mas não garantem verdade factual.

Os valores são exemplos de consumo, não custo real registrado nem orçamento monetário garantido. A camada determinística não consome tokens; banco, funções e armazenamento ainda têm os limites do plano Supabase. Não foi ativado serviço pago.

## Validação e limites restantes

Testes de domínio, handler, banco e UI cobrem definição de Surge sem números antigos, terminologia, fontes, ausência de dados, temporada/modalidade/versão/região, conflitos, recusa fora de escopo, autenticação, isolamento de rascunhos, publicação explícita, concorrência, arquivo, restauração, quota, falha de provedor e reinício não destrutivo. Testes administrativos de UI usam mocks somente nos testes; RLS/RPCs são verificados separadamente em Postgres local PGlite com todas as migrations. Testes de navegador incluem desktop, tablet e mobile, fontes, limitação de atualidade, recarga, restrição administrativa, axe e overflow.

Resultados finais verificáveis são registrados no PR. Limitações: não aplicada a migration ao Supabase remoto; não testado provedor pago com chave real; não medido faturamento/latência de produção; nenhuma avaliação garante correção universal. O catálogo administrativo inicial está limitado aos 500 registros e 1.000 revisões mais recentes, com limite explícito; ampliar exige paginação/filtros de servidor.

Antes do uso real: aplicar 024 em staging após 001–023, implantar `fortnite-knowledge`, atualizar `clutch-coach`, configurar ALLOWED_ORIGIN, validar administrador e duas contas comuns, rever cada publicação e validade, testar desativação/limites e optar por provedor somente com orçamento autorizado. Sem publicação do site nesta entrega.

A revisão final também verifica se o patch registrado foi sucedido no mesmo modo antes de usá-lo para uma pergunta sobre o meta atual. Uma edição recente não torna uma versão antiga do jogo vigente; consultas históricas explícitas continuam possíveis. Correspondências lexicais fracas são descartadas em relação ao melhor resultado, evitando que uma comparação direta receba trechos de outro assunto apenas por uma palavra incidental. Esse corte é uma regra editorial testável, não uma medida de precisão semântica científica.
