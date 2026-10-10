# Skill Maxing Engine

O fluxo privado `/app/evolution-plan` reutiliza o catálogo pesquisado, o Training Builder, `training_plans`, `activity_series`, calendário, Session Player e relatórios. Não exige LLM, chave externa ou serviço pago. A seleção de exercícios é determinística; UUIDs são identificadores, não seleção aleatória.

## Configuração e seleção

O jogador escolhe modalidade, experiência, dispositivo, objetivo, até 12 competências com importância 1–5, intervalos semanais e minutos desejados. Dias sem janela ficam livres. Pode informar múltiplas janelas e reservas pessoais sem descrever compromissos. Parceiros, relato livre, campeonato favorito atual e avaliação inicial são opcionais.

`src/data/skill-maxing-rules.json` versiona pesos e limites editoriais. O catálogo acrescenta competências/exercícios sem ampliar enums de habilidades. A configuração separa perfil, catálogo, proposta, agenda, execução e revisão.

1. Excluir exercícios não publicados, sem pesquisa verificada, com revisão vencida, modalidade incompatível ou restrição explícita de dispositivo. Iniciantes não recebem exercícios avançados. Exercícios intermediários podem aparecer com aviso e revisão das instruções; o catálogo não presume uma variante de iniciante inexistente.
2. Modo solo exclui atividades com competências multiplayer, salvo revisão. Prática competitiva requer interesse informado. Revisão seleciona apenas finalidade de análise. Preferências de amigos/adversários favorecem prática contextualizada, sem criar matchmaking.
3. Ordenar focos pela cobertura semanal dividida pela importância. Pontuar candidatos por competências, meta ativa vinculada ao exercício, dificuldades registradas, nível, protocolo de avaliação, finalidade e variedade; reduzir repetição recente. Desempate por ID estável.
4. Propor até três etapas por sessão. Divisão inicial dos minutos é editorial e editável, não duração cientificamente ideal. O perfil curto limita a sugestão inicial a 20 minutos, como conveniência de produto. Nunca elevar automaticamente o orçamento.
5. Buscar o primeiro horário livre em incrementos de cinco minutos dentro das janelas, em todas as semanas solicitadas (1–4). Compromissos reservados e agenda existente bloqueiam encaixe. Uma sessão por dia; múltiplos blocos ficam no builder. Sem encaixe, o dia permanece sem treino com explicação.
6. Explicar competências, prioridade, finalidade, metas/relatos usados, ausência de dados e métricas. Relato livre permanece para revisão humana, sem análise diagnóstica. Baseline exige registro manual com protocolo constante, sem nota universal.

IDs, textos editoriais e metadados recuperados são dados; não executam instruções ou alterações.

## Prévia e confirmação

A prévia permite alterar horário e abrir o builder real: repetir, duplicar, mover com teclado ou drag, ajustar minutos, blocos, notas e atividades particulares. O modo manual cria sessões vazias e exige preenchimento válido. O builder salva mudanças apenas na proposta até confirmação.

Salvar preferências não altera a agenda. Uma segunda tela mostra datas, duração, fuso e séries e exige **Confirmar e salvar plano na agenda**. A migration incremental `202610100020_skill_maxing.sql` adiciona somente configurações e recibos de aprovação.

A RPC autenticada valida esquema fechado, limites, competências, catálogo, customizações pelo validador existente, disponibilidade, reservas, datas, fuso e conflitos antes de persistir. Ela reutiliza o bloqueio das três tabelas de agenda do Coach, impedindo inserções concorrentes entre consulta e confirmação. Todas as rotinas, séries, configuração e recibo são uma transação: falha desfaz tudo. Token idempotente evita duplicação; reuso com payload diferente é rejeitado. Limite de 20 confirmações por conta a cada 24 horas. RLS permite leitura apenas do proprietário; escrita nessas duas tabelas ocorre somente pelas RPCs. Exclusão de perfil remove os dados por cascade. A prévia também rejeita divergência de nível entre a rotina editada e a configuração confirmada, alinhada à validação do servidor.

O fuso é IANA, independente do fuso do dispositivo. Horários repetidos em DST escolhem a primeira ocorrência; horários inexistentes são rejeitados, alinhados ao calendário. Novas séries usam os mecanismos já existentes de edição de ocorrência, cancelamento e revisão de série. Após salvar, rotinas podem ser duplicadas, arquivadas e editadas pelo planejador. Repetir por 1–4 semanas copia a organização; ajustes de semanas futuras exigem nova prévia ou edição explícita de série.

Na demonstração identificada, uma única gravação no armazenamento local salva o lote; não consulta contas reais. Armazenamento local não substitui autenticação ou RLS. A execução usa snapshots existentes, checkpoints, timer por timestamps, pausas e conclusão manual. O histórico continua independente das futuras edições da rotina.

## Reavaliação

A revisão usa a análise existente e somente registros próprios. Compara mesmo exercício/protocolo, unidade, versão e condições. Dificuldades recorrentes em diários oferecem **Incluir foco na próxima prévia**; clicar muda a prioridade, sem mudar a agenda ou duração. A revisão não atribui causas, não confunde horas com habilidade e não aumenta carga ao completar uma semana.

## Fundamentos e limites

Fontes consultadas em 10/10/2026, somadas ao registro de evidências existente:

- [Vardal et al., 2022, PMID 36240151](https://pubmed.ncbi.nlm.nih.gov/36240151/): associação entre espaçamento e desempenho em League of Legends; estudo observacional, não prova causalidade nem duração ideal para Fortnite.
- [Cepeda et al., 2006, PMID 16719566](https://pubmed.ncbi.nlm.nih.gov/16719566/): síntese sobre prática distribuída e memória verbal; generalização para tarefas motoras/esports é limitada.
- [Entrevista documentada com Khanada, Dignitas, 11/09/2026](https://dignitas.gg/articles/how-fortnite-pros-actually-practice-in-2026-featuring-khanada): experiência profissional individual sobre propósito, prática e revisão. Não metodologia universal ou ensaio científico. Consulta textual da página, sem declarar vídeos assistidos.

Pesos, máximo de etapas e divisão inicial são recomendações editoriais auditáveis. Os dados não validam uma metodologia científica específica para Fortnite. Descanso não é falha; o jogador pode reduzir, pausar, interromper ou reagendar. Não há diagnóstico médico, abertura de mapas, matchmaking ou notificações com o site fechado.

## Verificação e publicação futura

Os testes de motor cobrem semana multihabilidade, determinismo, modalidade, orçamento curto, compromisso, revisão vencida, proprietário e configuração inválida. Os testes PostgreSQL/PGlite aplicam todas as migrations e verificam RPC, idempotência, rollback em conflito, isolamento e DST. Playwright usa a demonstração real no desktop, tablet e mobile, sem mock da seleção ou persistência.

A suíte de navegador verifica prévia sem gravação, cancelamento, edição com repetição e atividade personalizada, confirmação, recuperação após reload, três execuções manuais e acesso aos relatórios/revisão; outro cenário usa Construção Zero, controle e dez minutos.

Antes de disponibilizar contas reais: aplicar migration 020 após 001–019 em ambiente de homologação Supabase, conferir RLS com duas contas, concorrência sob carga, autenticação expirada e rede instável. PGlite valida PostgreSQL/RLS, mas não substitui testes no serviço Supabase implantado. O bloqueio global da agenda privilegia integridade e pode limitar concorrência em escala; medir antes de alterar sua estratégia. Não foi realizado deploy ou publicação para usuários.

### Resultados locais — 10/10/2026

- `npm test`: 222 testes, 38 arquivos, aprovados.
- `npm run test:e2e -- --workers=2`: 51 testes aprovados em desktop/tablet/mobile.
- Após adicionar o registro numérico com configuração comparável e refinar checkboxes, repetidos os seis cenários do novo planejador: todos aprovados, incluindo axe na prévia e ausência de erros de página.
- `npm run build`: aprovado; rota lazy do planejador 35,71 kB (12,14 kB gzip), sem biblioteca adicional. Sitemap omitido porque domínio de produção não está definido; pré-renderização editorial opcional não habilitada.
- Smoke do bundle de produção com Chromium: nova rota privada em demonstração, competências e disponibilidade em desktop e mobile, zero erros de console e sem overflow horizontal.
- `npm audit --audit-level=high`: nenhuma vulnerabilidade reportada. Não equivale a certificação de segurança.

O cenário de execução registra valores numéricos e configuração comparável, exige conclusão manual e recupera sessão pausada após reload. O teste de revisão separado verifica dificuldades recorrentes, isolamento e exclusão de medições incompatíveis. Não foram testados mapas dentro do Fortnite nem contas reais no Supabase.
