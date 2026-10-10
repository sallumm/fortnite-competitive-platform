# Competitive Intelligence 4.0

Entrega incremental sobre 3.0 (`feat/clutch-coach`), preservando Auth, RLS, sessões, XP, calendário recorrente, relatórios, biblioteca e Coach. Não aplica migrations em produção e não publica o site. O PR 4.0 deve ser integrado após os PRs 2.0/3.0.

## O que funciona

- Central: pesquisa, região/modalidade/tipo, favoritos persistentes, regiões pessoais, próximos encontros por fase, indicação de andamento somente quando intervalo e validade permitem, resultados com origem identificada, notícias/análises por data original.
- Calendário: fases classificatórias, sessões, finais e inscrições têm tipos distintos. UTC convertido no fuso do perfil; datas sem horário permanecem datas da fonte, sem conversão inventada. ICS de fase ou evento, dia inteiro quando necessário, UID estável, escaping e folding UTF-8. Cancelamento usa STATUS:CANCELLED, adiamento usa TENTATIVE.
- Preparar para competição: perfil, rotina existente, objetivo, checklist configurável persistido por conta, exercícios compatíveis com modalidade e priorizados por objetivo/nível, conteúdos educativos e acesso à agenda. Sugestões de até três horários usam a disponibilidade previamente salva e ignoram compromissos recorrentes/exceções. Não supõem disponibilidade quando ela não existe.
- Proposta: treino ou sessão confirmada → validação no servidor → consulta de conflitos → prévia com validade de 15 minutos → botão de confirmação → transação com revalidação e resultado persistido. Uma confirmação repetida retorna o mesmo ID. Não são feitas alterações pelo texto do modelo.
- Editorial: temas, tags, natureza da fonte, publicação original da fonte, validade e histórico administrativo das últimas 20 revisões. Rascunhos/agendamentos não aparecem no catálogo público. Datas de revisão não reordenam publicação. JSON de fases é validado por Zod e PostgreSQL; este editor estruturado fica restrito aos administradores.
- Coach: link contextual envia apenas o ID de um evento público. RPC autenticada recupera um evento publicado, com formato/regras/fases e validade, sem obter checklist, objetivos privados ou dados de outra conta. Resposta por regras mostra fatos cadastrados e links à preparação confirmada. Favoritos continuam dependendo de consentimento privado. Provedor externo continua opcional, com consentimento, limites e contrato da versão 3.0.
- Biblioteca: uma nova ilha de fundamentos, sem duplicar Reisshub/Raider/Jivan já cadastrados; metadados complementares nos exercícios originais. Nenhum mapa foi testado dentro do Fortnite.

## Banco e operação

Aplicar, na ordem e depois das migrations anteriores:

1. `202610100005_competitive.sql`: colunas editoriais adicionais; fases como JSON limitado a 32 entradas, sem criar uma arquitetura paralela; tabelas privadas `competition_preparations`, `competitive_preferences`, `competition_proposals`; RPCs `competition_preview`, `competition_confirm`, `coach_competitive_event`.
2. `202610100006_competitive_seed.sql`: novos registros; conflitos de ID/slug são ignorados para preservar edições existentes. Somente metadados novos vazios nos exercícios originais e resultado ainda vazio do Global recebem enriquecimento. Não se reexecutam os seeds anteriores.
3. Reimplantar a função `clutch-coach` para aceitar o parâmetro contextual `tournament_id`. Sem isso, a UI nova não terá o contrato completo com o backend antigo.

Preparação e preferências têm RLS por `auth.uid()`, inclusive inserção/atualização/exclusão. Propostas não permitem INSERT/UPDATE pelo cliente; apenas RPC tipada, até 60 propostas por conta/dia. Confirmação bloqueia a linha do perfil, a proposta, o evento e a agenda, verifica horário e conflitos novamente e vincula a atividade ao campeonato. Treinos: duração da rotina, de 5 a 120 minutos; sessão competitiva: duração real cadastrada até 240 minutos. Sessões maiores exigem agenda externa/ICS nesta versão. Proposta expirada/cancelada/despublicada/desatualizada é recusada. Uma sessão cujo horário não foi confirmado não pode ser adicionada como um horário fictício.

O histórico editorial existente audita os novos campos. Um editor comum não ganha acesso aos registros de treinamento privados. O demo usa apenas dados de teste do navegador, identificado pelo produto, e não consulta provedores.

## Pesquisa verificada em 10/10/2026

Todos os textos do catálogo são sínteses originais; não são cópias integrais de matérias/regulamentos.

| Fonte | O que foi verificado e uso |
| --- | --- |
| [FNCS Solos 2026 — regras de 31/08](https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-championship-series-fncs-solos-2026-official-rules) | Solo Battle Royale; sete regiões; classificatórias, Fast Track, Heats, LCQ e finais. Anexos A/B/C separam pontuação, datas e prêmios. Datas de 28/09 a 27/10 cadastradas por fase; horários permanecem nulos. Elegibilidade/avanços variam por etapa. |
| [Regras gerais](https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-competitive-master-rules) | Requisitos gerais e conduta separados das regras do evento. A plataforma não determina elegibilidade automaticamente nem solicita credenciais. |
| [Victory Cups C7S4 — 20/08](https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-victory-cups-chapter-7-season-4-official-rules) | Solo, console Zero Build, Solo Reload e Duos Reload. Requisitos e avanço dependem da modalidade. Pontuação Reload e horários finais remetem ao jogo; não foram fabricados. |
| [Ranked Cups C7S4](https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-ranked-cups-chapter-7-season-4-official-rules) | Battle Royale e Reload; recompensas cosméticas. Regras não são transferidas para Cash Cups. Não foi validada uma Cash Cup específica para cadastrar novas sessões. |
| [Calendário BR](https://www.fortnite.com/competitive/schedule?region=BR) | Programação dinâmica, sem fuso inequívoco no conteúdo recuperado. Consultar por região e dentro do jogo antes de preencher sessões. Não é uma integração automática. |
| [Atualização anual — 29/05](https://www.fortnite.com/news/fncs-schedule-and-competitive-updates?lang=en-US) | Global antecipado para setembro, ajustes no calendário e anúncio Solo posterior. Conteúdo identificado como histórico. |
| [Global 2026 — primer](https://www.fortnite.com/news/fortnite-global-championship-2026-primer) | Evento de setembro, duplas e prêmio geral anunciado; não confirma premiação individual dos usuários. |
| [Team Vitality — 28/09](https://vitality.gg/en-eu/blogs/presse/havok-by-vitality-remporte-le-fortnite-global-championship-2026) | Comunicado da organização participante sobre SwizzY/Pixie e HavoK by Vitality. Fonte primária da organização, explicitamente diferente de classificação completa da Epic; sem pontos inventados. |
| [Raider464 Mechanics V5](https://www.fortnite.com/@raider464/2424-4344-7824) | Código 2424-4344-7824 conferido; exercício original preservado. |
| [Reisshub Training Hub V2](https://www.fortnite.com/@reisshub/4175-6046-6184) | Código 4175-6046-6184, recursos descritos pelo criador; ilha já presente, sem duplicação. |
| [Jivan How To Build, unixomaps](https://www.fortnite.com/@unixomaps/4509-3485-1670) | Código 4509-3485-1670 conferido; novo exercício editorial para fundamentos. Criador creditado como unixomaps conforme a página oficial. |
| [Dignitas: círculo final — 27/08](https://dignitas.gg/articles/how-to-play-the-final-circle-positioning-endgame-rotations-and-last-zone-decisions) | Análise especializada usada como referência educativa, não como regra nem prova de eficácia. |
| [Vídeo de Jivan: How to Improve](https://www.youtube.com/watch?v=xIm4XALhyuc) | Identificado pelo índice público de pesquisa. A página do vídeo foi bloqueada por limitação de acesso nesta verificação; não foi assistido/transcrito, não sustenta afirmações técnicas nem foi cadastrado como conteúdo verificado. |
| [Notas do ecossistema 42.30 — 01/10](https://dev.epicgames.com/documentation/fortnite/42-30-fortnite-ecosystem-updates-and-release-notes) | Documento técnico de ecossistema, não evidência suficiente do meta de loot competitivo. Não foi publicada tier list presumida. |

Resultados completos, partidas/pontos, todas as organizações, Cash Cups específicas e mudanças de meta ainda exigem curadoria verificável. A central representa esse limite com ausência de registro/validade, em vez de preencher lacunas. A pesquisa não executou o Fortnite nem inferiu horários a partir da duração aproximada de uma sessão.

## Atualização autorizada

A [Fortnite Data API documentada](https://dev.epicgames.com/documentation/fortnite/using-fortnite-data-api-in-fortnite) disponibiliza métricas agregadas de ilhas/modos, com limites e histórico limitado. A documentação consultada não fornece um feed de torneios/classificações para esta implementação. Não foi identificado um feed autorizado confiável suficiente para sincronizar a central. Não há scraper, endpoints privados, importação de texto como instrução, nem coleta de credenciais. A decisão implementada é curadoria manual com fonte, prazo e auditoria. Essa conclusão não afirma que nenhuma outra API poderá existir.

Fluxo editorial: consultar fonte → diferenciar anúncio, inscrição e sessão → indicar região e fuso → publicar regras/resumo original e fonte → validar fase → definir prazo de revisão → publicar. Alterações/adiamentos exigem revisão de treinos pessoais; a plataforma não move compromissos silenciosamente. Atualizar validade é uma afirmação do editor de que revisou a fonte, não um indicador de sincronização.

## Validação e limites

Resultado local: **99 testes passando**, em 13 arquivos, e build aprovado. Testes reais de lógica, fluxos em DOM simulado e PostgreSQL/PGlite cobrem: UTC/fuso/madrugada, intervalos desconhecidos, ICS/UTF-8, favoritos, preferências, ausência de disponibilidade, conflitos, fontes obrigatórias, fases duplicadas, registro desatualizado, publicação futura, RLS, auditoria, limite diário, expiração, revalidação, idempotência e vínculo pessoal. Regressões 2.0/3.0 permanecem na suíte. `npm test` e `npm run build` incluem também checagem estática da Edge Function.

Não foi validado em Supabase hospedado, nem efetuada chamada paga de IA ou teste visual em navegador móvel real. SEO é metadata/canonical/JSON-LD no cliente; preview de redes sociais e indexação sem JavaScript continuam limitados pela SPA. `VITE_SITE_URL` não configurado mantém sitemap omitido, sem inventar domínio. Não há serviço de notificações com o site fechado.

Não há custo de API externa novo no 4.0. Supabase/hosting dependem da configuração e do consumo contratados, sem promessa de plano ilimitado. Chamadas generativas continuam sujeitas ao orçamento documentado em `docs/CLUTCH_COACH.md`; este PR não muda modelo/preços.
