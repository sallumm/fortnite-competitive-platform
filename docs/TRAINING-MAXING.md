# Training Maxing — implementação incremental

Base: `feat/premium-interactive`, commit `a03dce0`. Esta PR continua a pilha das versões anteriores; não recria o projeto, troca autenticação ou substitui o Supabase. A integração deve respeitar a ordem das PRs anteriores.

## Auditoria e decisões

O editor anterior excluía exercícios já escolhidos e usava `exercise_id` como identidade de arraste. O trigger do banco também proibia repetições. As sessões já mantinham snapshots e conclusão manual; o XP já era transacional e idempotente. Calendário, recorrências, exceções, vínculos com campeonatos, diário, Coach, exportação e relatórios foram reutilizados.

Prioridades resolvidas:

- UUID próprio de cada etapa, separado da identidade do exercício. Até 50 etapas, 1–120 minutos inteiros por etapa e 240 minutos totais. O limite é de integridade, não uma recomendação de volume.
- Taxonomia extensível por arrays de categorias e tags, mantendo a categoria antiga para compatibilidade. Mira (Aim), Mecânicas, Piece Control, Combate, Noção de Jogo, Endgame, Preparação Competitiva, VOD Review e Construção Zero.
- Rotinas antigas ganham IDs ao aplicar a migration, sem perder etapas. Sessões antigas não são reescritas.
- Atividades privadas são documentos dentro da rotina de seu proprietário. Não foi criada uma segunda biblioteca pública nem uma entidade redundante. Podem ser reutilizadas no editor a partir das rotinas da conta; excluir a última rotina remove essa atividade do seletor, mas snapshots das sessões permanecem.
- Rascunhos do editor são locais, separados por usuário. O rascunho de uma nova rotina pode ser recuperado ao reabrir o criador. Salvar grava a rotina real; fechar não publica um plano incompleto.
- Correção de resultados usa RPC com controle de revisão e auditoria somente de leitura para seu proprietário. Não altera XP.
- Demonstração passa a exigir uma escolha explícita persistida para continuar após refresh. Continua identificada e separada de Supabase/contas reais; sair/excluir remove a opção.
- Correção do cascade local de rotina: referências de agenda/série são identificadas antes de excluir, preservando sessões e removendo exceções órfãs.

## Fluxos implementados

| Área | Comportamento |
| --- | --- |
| Training Center | Continuidade da sessão, rotina salva/favorita, exercícios recentes, benchmarks, metas mensuráveis e histórico detalhado pesquisável por nome/exercício/nota e filtrável por estado |
| Builder | Busca por nome/habilidade/tag, categoria, modalidade, instruções/fontes, atividades privadas, repetição, blocos, duração, repetições, notas, links HTTPS permitidos, duplicar etapa, ordenar por pointer/teclado/botões, desfazer, prévia e salvar |
| Rotinas | Criar do zero, modelos editáveis, editar, duplicar com novas identidades, favoritar, arquivar/restaurar, agendar e iniciar |
| Catálogo | 27 novos protocolos editoriais específicos; códigos conferidos em páginas oficiais. Nenhum mapa é inventado e nenhuma eficácia é prometida |
| Sessão | Etapa focada, instruções e notas do plano, copiar código, link de apoio, tempo global e por etapa, pausa/retomada, anterior/próximo, conclusão manual, pular, resultados, configuração, condições do teste e observações |
| Recuperação | Rascunho no navegador e checkpoint remoto autenticado, validado e com versão para detectar outra aba. Timer deriva de timestamps, não da quantidade de callbacks do intervalo |
| Resultado | Unidade/versão/limites do protocolo, cenário, dispositivo, sensibilidade declarada e duração do teste. Etapas puladas não geram tendência e não entram na distribuição praticada |
| História | Snapshot da execução, duração ativa, estado, etapas repetidas, parâmetros, resultados, notas, correção com versão anterior preservada e exportação |
| Meta | Exercício/protocolo, configuração comparável, valor inicial, alvo e prazo opcional. Último resultado real; grupos com condições diferentes não são escolhidos automaticamente para avaliar a meta |
| Calendário | Sistema existente de fuso, recorrências semanais, exceções, conflitos, confirmação e associação com torneio preservado |
| Relatórios | Séries separadas por exercício, métrica, unidade, versão, configuração e condições; repetições permanecem medições distintas; volume não comprova evolução |

Os dez modelos são pontos de partida editáveis, não metodologias cientificamente superiores. Construção Zero começa com a modalidade do perfil e não recebe modelos de construção. Uma escolha explícita de todas as modalidades permite uma rotina mista.

## Pesquisa e origem do conteúdo

Verificação em 10/10/2026. As instruções são textos originais do Clutchfolio. A verificação diz respeito à página publicada e ao código, não a execução no Fortnite. Disponibilidade e opções internas da ilha podem mudar; protocolos orientam registrar cenário e versão e não estimar precisão sem contagem.

| Fonte primária | O que foi conferido |
| --- | --- |
| https://www.fortnite.com/@reisshub/4175-6046-6184 | Training Hub V2: descrição de aim, edits, piece control, fighting e freebuild |
| https://www.fortnite.com/@raider464/2424-4344-7824 | Mechanics Training V5: aim, piece control, editing, peeks e box fighting |
| https://www.fortnite.com/@jivantv/7037-5244-5527 | How To Piece Control: drills de piece control e Box Fight |
| https://www.fortnite.com/@jivantv/5473-5965-0108 | Forever Zone Wars: zona móvel e rodadas; sem equiparar a competição oficial |
| https://www.fortnite.com/@donwozi/8022-6842-4965 | SKAAVOK Aim Trainer: código e catálogo do criador |
| https://www.fortnite.com/@persa.maps/3366-3974-5505?lang=pt-BR | Persa Training: mecânicas, mira, controle de peças, edição e Boxfight; publicações recentes da comunidade brasileira |
| https://dev.epicgames.com/documentation/pt-br/fortnite/replays-feature-in-fortnite-creative | Replays como registro para revisão; protocolos de VOD são editoriais |
| https://www.epicgames.com/help/c-34254770/c-33726977/a25553277?lang=pt-BR | Limitações de compatibilidade de replay após atualização |
| https://www.youtube.com/watch?v=ZNwzbeUVgto | Metadados públicos de vídeo do Felipersa sobre rotina para campeonatos duo, publicado em 2025; link de referência histórica, sem republicar conteúdo ou assumir formato atual |

A busca por vídeos brasileiros de 2026 não forneceu cobertura verificável suficiente. Não alegamos ter assistido aos vídeos; o player do YouTube não pôde ser consultado integralmente. Terminologia também foi confrontada com publicações atuais do criador brasileiro Persa na Epic. Freebuild, Edit Course, Retake, Piece Control, Box Fight, Realistic e Zone Wars são preservados. Noção de Jogo evita uma tradução literal de game sense; tarpar descreve construir proteção durante o avanço, enquanto rotação, posicionamento, refresh e controle de materiais têm protocolos específicos de revisão.

Pesquisa científica de contexto: estudo original *Long-Term Motor Learning in the “Wild” With High Volume Video Game Data* (https://pmc.ncbi.nlm.nih.gov/articles/PMC8720934/) analisou registros de Aim Lab, não estes mapas de Fortnite. O resultado de busca expõe limitações de equipamento e dados observacionais; o texto integral foi bloqueado por verificação de navegador. Não usamos isso para prescrever dosagem, atestar transferência para torneios, calcular uma nota universal ou chamar modelos de treino de cientificamente validados.

Motion e dnd-kit existentes foram mantidos conforme documentação oficial (https://motion.dev/docs/react-accessibility e https://dndkit.com/legacy/presets/sortable/overview/). Identidades únicas da etapa resolvem o arraste de exercícios repetidos sem uma segunda biblioteca de animação.

## Banco, segurança e operação

Aplicar **007_training** e depois **008_training_seed** após migrations 001–006. 007 amplia as tabelas existentes, substitui validação/start/finish de treino, adiciona checkpoint e auditoria de resultados, metadata de catálogo e metas. 008 publica os protocolos editoriais com IDs próprios. `node scripts/training-seed.mjs` regenera apenas o seed a partir do catálogo versionado.

RLS de planos, metas e sessões foi preservada. Checkpoint/correção usam `auth.uid()`, lock, versão esperada, validação de payload/tempo e `search_path=''`. Sessões continuam sem update direto para cliente. A auditoria tem select somente do proprietário e não permite gravação cliente. Planos não aceitam snapshots de catálogo fornecidos pelo cliente: o servidor resolve o exercício e a sessão guarda sua cópia. Atividade privada não pode declarar mapa verificado. Links de apoio são limitados a HTTPS em Fortnite, Epic e YouTube. Nenhuma chave externa é exposta, nenhum serviço pago é ativado e nenhuma aplicação é publicada.

Conclusão manual continua obrigatória para etapas novas. Apenas esperar o relógio não conclui treino. Uma sessão com todas as etapas puladas não recebe XP. Finish mantém o limite diário de XP, lock do proprietário e idempotência; correção/checkpoint não inserem XP.

Não há sincronização de rascunhos incompletos de rotina entre dispositivos. Sessões sincronizam checkpoints com a conta depois da confirmação do servidor; em falha de rede, a interface informa que só existe cópia local. Fechar o navegador antes de uma requisição terminar pode perder a última alteração no servidor; a cópia local ajuda somente no mesmo navegador. Não há execução de lembretes com o site fechado.

## Verificação executada em 10/10/2026

- `npm test`: **135 testes em 21 arquivos passaram**, incluindo 14 testes novos de domínio/PostgreSQL. As migrations 001–008 foram aplicadas em PGlite; foram verificadas RLS entre duas contas, validação no servidor, checkpoint com versão, conclusão manual, XP idempotente, correção auditada, snapshots e contexto mínimo do Coach com consentimento.
- `npm run build`: **passou**, incluindo TypeScript do frontend e do Coach. Sitemap foi omitido porque `VITE_SITE_URL` não está configurada; pré-renderização editorial permanece opcional.
- `npm audit --audit-level=high`: **zero vulnerabilidades reportadas**. Não equivale a atestar segurança integral.
- `PLAYWRIGHT_EXECUTABLE_PATH=/tmp/chromium npm run test:e2e -- --workers=1`: **27 testes passaram** em Chromium 153, nos projetos desktop (1366×900), tablet (768×1024) e mobile (Pixel 7 emulado). Incluem teclado, arraste com confirmação, temas/movimento reduzido, verificações axe nas telas cobertas e regressões dos recursos anteriores.
- O novo teste de aceitação percorreu os seis exercícios exigidos, uma repetição e uma atividade privada: criação, ordenação/undo, duração/notas/blocos, persistência após refresh, agenda, execução, pausa/retomada, conclusão manual, resultado, relatório, histórico, correção, meta e edição sem alterar o snapshot histórico. Capturas do editor, sessão e histórico também foram inspecionadas; isso não é uma auditoria visual de todos os dispositivos físicos.
- `git diff --check`: passou. O seed 008 foi regenerado a partir do catálogo versionado.

## Checklist de homologação e publicação

1. Integrar a pilha das PRs em ordem e aplicar 007/008 em homologação com backup prévio.
2. Reimplantar a função Clutch Coach se houver alteração de sua contextualização.
3. Conferir variables/redirects/Supabase/RLS seguindo `docs/PRODUCTION-READINESS.md`.
4. Executar o fluxo com duas contas reais: isolamento, criação/edição, agenda/recorrência, início, checkpoint, pausa, conclusão, correção, exportação e exclusão.
5. Testar refresh, outra aba, desconexão e retomada em dispositivo físico; confirmar fuso/DST.
6. Conferir temas, movimento reduzido, teclado e toque; atualizar a verificação das fontes antes de divulgar.
7. Publicar somente após aprovação dos fluxos de homologação. Esta entrega não faz deploy.

## Limitações e evolução seguinte

Login/cadastro, Supabase remoto e permissões com contas reais ainda dependem de ambiente configurado. PGlite valida as funções e RLS em PostgreSQL local; o navegador valida a demonstração real e sua persistência, sem simular disponibilidade do servidor remoto. Não houve teste dentro do Fortnite, Safari/iOS físico, Lighthouse ou notificações em background.

Próximas melhorias: rascunhos de rotina sincronizados com conflitos explícitos, avaliações personalizadas padronizadas, seleção explícita de condições em metas, calendário de avaliações e revisão periódica das fontes do catálogo. Pausas opcionais podem ser atividades privadas ou pausa do timer; não existe detecção automática de prática dentro do Fortnite.
