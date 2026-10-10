# Clutch Coach 3.0

Incremento sobre a versão 2.0. As rotinas, XP, sessões, recorrências, diários, relatórios e o Supabase existentes continuam preservados. O chat está em `/app/coach`, com entradas em Meu Dia, Planejador, Relatórios, Biblioteca e Competitivo. Nenhuma publicação ou alteração de banco hospedado foi realizada nesta entrega.

## O que funciona

- Chat responsivo com conversas, sugestões, estados de carregamento/erro, referências, navegação interna e identificação do método de resposta.
- Assistência **por regras**, sem chave de modelo: recomenda catálogo publicado compatível com modalidade/foco/nível informado, explica vocabulário, mostra agenda/favoritos autorizados e calcula relatórios com dados reais. Não é apresentada como IA generativa.
- Relatórios de 7, 30 e 90 dias: total de sessões, minutos ativos, categorias, metas atuais, dificuldades do diário e variações entre resultados com exercício, métrica do snapshot e configuração iguais. Não inferem habilidade por horas. Metas não possuem data de conclusão, portanto são mostradas como estado atual.
- Planejamento: atividades avulsas em dias selecionados, recorrência semanal com término explícito em oito semanas, reagendamento/cancelamento de atividades avulsas. Planos de treinamento existentes podem ser vinculados. Edição de ocorrências/séries existentes continua disponível no Planejador 2.0.
- Prévia autenticada, validação, conflitos com agenda e recorrências/exceções, expiração em quinze minutos, confirmação explícita e resultado idempotente. Cancelamento exige a expressão específica `CANCELAR`. Alterações não são executadas pelo modelo.
- Histórico desligado por padrão. Preferências e histórico opcional privados; exclusão de conversas remove mensagens por cascade. Na demonstração, somente mensagens enviadas com histórico ativado são salvas no navegador, nunca enviadas a provedores.
- Sugestões em Meu Dia, opt-in, somente para atividades/favoritos efetivamente registrados. Sem notificações com o site fechado.
- Adaptador real OpenAI Responses API, desacoplado pela interface `CoachProvider`, saída estruturada, referências permitidas e `store:false`. Ele gera orientação complementar; observações numéricas e ações continuam determinísticas.
- Perguntas competitivas com geração ativada consultam uma página oficial permitida, com timeout, limite de bytes, remoção de scripts e proibição de redirecionamento. Se a página não puder ser lida, não há geração de informações atuais por memória do modelo.

## Dependências e limites reais

A demonstração funciona com `npm ci` e `npm run dev`, sem Supabase ou provedor. Contas reais precisam da migração `202610100004_coach.sql` e da Edge Function `clutch-coach`. A chave externa é opcional e exclusivamente de servidor. A comunicação real com um provedor **não foi executada nesta sessão**, pois não há chave configurada; os contratos HTTP foram verificados por testes com transporte simulado.

A seleção de assunto e a interpretação inicial de datas/dias são baseadas em regras. Datas, horário inicial sugerido (18h), duração e dias devem ser revisados no formulário. Não há compreensão irrestrita de linguagem, execução autônoma de operações, pesquisa geral na web ou sincronização de torneios/resultados. A consulta oficial recupera uma página; não certifica que um evento salvo está atualizado e não substitui a conferência de regras/horários na Epic. Páginas que exigem JavaScript, excedem o limite ou não contêm texto legível levam à resposta de limitação.

O contexto é reconstruído para cada pergunta. O histórico organiza conversas, mas não é reenviado inteiro ao modelo: perguntas de acompanhamento devem indicar a habilidade, período ou atividade. Não existe monitoramento de partidas, acesso a credenciais de Fortnite/Discord ou diagnóstico de saúde.

Máximo de 200 sessões detalhadas por relatório, com total real contado separadamente e aviso de amostragem. Até 20 metas, 100 ocorrências na agenda e 10 favoritos. Calendário consultado: hoje até quatorze dias adiante, no fuso do perfil; o usuário pode abrir o Planejador para outros intervalos. Recomendações de exercícios usam categorias editoriais, não uma avaliação validada da eficácia de cada mapa ou arma. Autoavaliações qualitativas de habilidades permanecem na área Minhas Habilidades e não são convertidas em notas pelo Coach.

## Implantação posterior

1. Aplicar as migrações pendentes **na ordem**, sem reaplicar seeds sobre conteúdo editado. Para um projeto Supabase já vinculado: `supabase db push`.
2. Publicar: `supabase functions deploy clutch-coach --project-ref SEU_PROJECT_REF`.
3. Configurar `ALLOWED_ORIGIN` com a origem real do frontend. `SUPABASE_URL` e `SUPABASE_ANON_KEY` são fornecidos pelo ambiente da função. Não há cliente service-role no Coach.
4. Opcionalmente adicionar `OPENAI_API_KEY` nos secrets do Supabase, pelo painel ou arquivo de secrets não versionado. Nunca usar prefixo `VITE_`, copiar chave ao frontend, commit ou chat.
5. Entrar com duas contas de teste, ativar contextos separadamente e validar RLS, histórico e propostas. Ativar consentimento externo somente após revisar a política do provedor. Conferir quotas/billing no provedor e custos Supabase antes de abrir produção.

`verify_jwt=false` no gateway é acompanhado de validação obrigatória `Auth.getUser` em todo POST. As consultas e RPCs conservam o JWT do usuário, usam `auth.uid()` e RLS. O backend nunca aceita um proprietário fornecido no corpo. A função rejeita origem não permitida e corpos maiores que 16 KB, incluindo streaming sem Content-Length. Somente ações do schema estrito são aceitas.

## Segurança e contexto

`coach_context` obtém apenas campos do assunto solicitado. Sem consentimento, nenhum dado privado é retornado. Para exercícios, usa perfil mínimo (modalidade, objetivo, nível, fuso, disponibilidade) e catálogo publicado. Para evolução, consulta sessões concluídas do intervalo, seus resultados/diários e metas atuais. Para agenda, resolve compromissos e regras/exceções. Para competição, consulta somente favoritos da conta. E-mail, nome, XP, outras contas e banco completo não são enviados ao provedor.

O provedor recebe a pergunta, seções resumidas e IDs/títulos de referências, delimitados como dados não confiáveis. Não recebe ferramentas, SQL, acesso à agenda ou credenciais. Conteúdo editorial, perguntas e páginas recuperadas nunca são instruções internas. Saída com campos extras, citações desconhecidas, números/URLs/códigos na orientação, JSON inválido, recusa ou truncamento é descartada, mantendo a resposta por regras. Isso reduz riscos, mas não elimina todas as alucinações textuais; a orientação mantém aviso explícito de erro/hipótese. React renderiza texto, sem HTML do modelo.

Propostas são imutáveis para gravações diretas do cliente. RPCs autenticadas criam e confirmam payloads tipados. O servidor revalida parâmetros, proprietário, plano, atividade não iniciada, limite de horizonte, duração e conflitos antes de gravar. Há lock transacional e repetição idempotente da confirmação. O resultado contém os IDs persistidos. As RPCs de histórico recebem conteúdo que deve sempre ser tratado como dado do usuário, nunca autorização ou fonte de análise.

Quotas são reservadas atomicamente no PostgreSQL: 6 solicitações/minuto, 60/dia por conta, 20 gerações/dia por conta e 500 gerações/dia para toda a instalação. Sem retries automáticos; falhas externas também consomem a reserva. Prévia/confirmar passam pela quota e criação de propostas tem limite independente de 60/dia. Diagnósticos mínimos: contadores privados, sem prompts, respostas ou chave em logs; contadores com mais de 30 dias são removidos durante reservas. Histórico tem máximo de 100 conversas e 100 mensagens por conversa. Mensagens sem opt-in não são persistidas. Propostas pendentes guardam somente dados necessários para a confirmação; podem ser excluídas pela conta, e a exclusão da conta remove todo o conjunto.

## Provedores e custos verificados em 10/10/2026

Preços padrão de texto, USD por milhão de tokens, sem cache, impostos, busca ou infraestrutura. Disponibilidade e quotas dependem de região, conta e modelo. Não há benchmark próprio de latência ou qualidade em português nesta entrega.

| Opção avaliada                                 | Entrada / saída | Exemplo: 2.000 entrada + 600 saída        | Decisão                                                                                                                                                                                                                        |
| ---------------------------------------------- | --------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OpenAI GPT-4.1 mini                            | US$ 0,40 / 1,60 | US$ 0,00176 por chamada; US$ 1,76 / 1.000 | Adaptador implementado; snapshot `gpt-4.1-mini-2025-04-14`, sem etapa de reasoning, suporte a saída estruturada. Sem tier gratuito para esse modelo.                                                                           |
| Google Gemini 2.5 Flash-Lite                   | US$ 0,10 / 0,40 | US$ 0,00044 por chamada; US$ 0,44 / 1.000 | Alternativa de baixo custo; não implementada. Tier gratuito tem quotas e uso de dados para melhorar produtos; pago indica não usar para essa finalidade. Não enviar registros privados ao tier gratuito sem análise adicional. |
| Anthropic Claude Haiku 5.5, até 100 mil tokens | US$ 0,10 / 0,50 | US$ 0,00050 por chamada; US$ 0,50 / 1.000 | Alternativa avaliada; não implementada. Rever disponibilidade, políticas por modelo e contrato antes de escolher.                                                                                                              |

Com OpenAI, entrada completa limitada a 16.000 bytes UTF-8 e saída a 600 tokens. Reserva conservadora de **US$ 0,008/chamada**, incluindo margem de tokenização/overhead; 500 chamadas/dia correspondem a aproximadamente US$ 4/dia ou US$ 120 em 30 dias, somente geração, nos preços verificados. Cenário típico de 2.000/600 tokens é menor. Revalidar preços antes de operar: o limite é por chamadas, não por leitura automática da fatura. Supabase, armazenamento, tráfego, domínio e operação editorial são custos separados. Quotas não significam gratuidade. Configure também limites/alertas de cobrança no provedor. Trocar modelo/provedor exige reavaliar teto de custo, consentimento, saída e testes.

Todos permitem chamadas HTTP de Edge Functions Supabase. Qualidade em PT-BR e latência devem ser medidas com o mesmo conjunto de perguntas (ausência de dados, termos Build/Zero, explicações, hipóteses e injection) antes de trocar adaptador. Não foram atribuídas pontuações fictícias. A interface `CoachProvider` permite substituir o transporte/modelo sem dar ao modelo acesso a alterações.

Fontes oficiais consultadas:

- OpenAI modelo e preços: https://developers.openai.com/api/docs/models/gpt-4.1-mini
- Saída estruturada: https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
- Privacidade/retention: https://developers.openai.com/api/docs/guides/your-data (`store:false` não elimina retenção de prevenção de abuso por padrão).
- Google preços: https://ai.google.dev/gemini-api/docs/pricing
- Google schema: https://ai.google.dev/gemini-api/docs/structured-output
- Google quotas: https://ai.google.dev/gemini-api/docs/rate-limits
- Google regiões: https://ai.google.dev/gemini-api/docs/available-regions
- Anthropic preços: https://platform.claude.com/docs/en/about-claude/pricing
- Anthropic retention: https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- Supabase dependências de funções: https://supabase.com/docs/guides/functions/dependencies

## Base de conhecimento

O catálogo publicado existente fornece mapas, instruções, métricas e links: nenhum código novo foi inventado. Conteúdo editorial válido é recuperado por categoria. Glossário curado complementar mantém fontes e distingue terminologia comunitária de regras oficiais; explicações de treinamento são sugestões editoriais, não resultados científicos ou garantias. Não há RAG vetorial obrigatório nem envio da base inteira. Pesquisas científicas não cadastradas/verificadas não são citadas como evidência de eficácia.

- Epic glossário: https://dev.epicgames.com/documentation/fortnite/fortnite-glossary
- Epic Ranked: https://www.fortnite.com/competitive/discover-competitive/fortnite-ranked-play-explained
- Epic regulamentos atuais: https://www.fortnite.com/competitive/rules-guidelines/rules-library
- Terminologia comunitária (não regulações): https://fortnite.fandom.com/wiki/Community_Terminology (consulta de busca; leitura direta indisponível nesta sessão).
- Dignitas, orientação especializada sobre endgame/recursos: https://dignitas.gg/articles/how-to-actually-win-endgames-in-fortnite
- Dignitas, decisões de zona final: https://dignitas.gg/articles/how-to-play-the-final-circle-positioning-endgame-rotations-and-last-zone-decisions

Números de Storm Surge de artigos antigos não foram incorporados como regras atuais. FNCS/Cash Cups não recebem formato fixo codificado. Piece control, box fights, freebuild e tarping são explicados com ressalva de Build.

## Verificação

`npm test` cobre a suíte anterior mais contexto mínimo, dono/consentimento, ausência de dados, comparação exata, mapas não inventados, validação estrita, autenticação/origem/tamanho, quotas, falhas externas, parsing da Responses API, grounding e proteção da consulta oficial. Testes PostgreSQL em PGlite executam as quatro migrations e verificam RLS, propostas sem execução, conflitos revalidados, recorrência, idempotência, confirmação destrutiva, expiração, persistência e exclusão. DOM simulado verifica preferências, histórico opt-in, exclusão, chat por exercício e confirmação adicionando agenda.

`npm run build` verifica TypeScript do frontend, checagem estática da função Edge (declaração mínima de APIs Deno e SDK local versionado) e produção Vite. O runtime Deno hospedado não foi executado. Testes não equivalem a validação de serviço hospedado, navegador real/mobile, auditoria WCAG ou chamada paga. Validar esses pontos quando configurarmos a hospedagem.
