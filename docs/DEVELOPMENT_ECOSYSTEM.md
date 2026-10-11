# kyrven · ecossistema integrado de desenvolvimento

Auditoria e implementação em 11/10/2026 (UTC). Base: `feat/fortnite-knowledge`, commit `e2a800a01bfa42c279bd2212ec85ff0082fdf859`. As PRs 1–16 estavam abertas e empilhadas na inspeção inicial; esta entrega continua a ponta cumulativa, sem substituir o trabalho pela main. Nenhuma publicação ou serviço pago foi ativado.

## Arquitetura e continuidade

React/TypeScript/Vite, Supabase Auth/Postgres/RLS, funções de servidor existentes e demonstração local foram preservados. A auditoria percorreu inventário de páginas, componentes, bibliotecas, dados editoriais, scripts, funções e migrations; a inspeção aprofundou os contratos de integração, leitura/persistência, contexto, permissões e testes. Não significa inspeção manual de cada linha ou teste hospedado de todos os serviços.

`development.ts` é uma síntese somente de leitura, que conecta aulas por `curriculum.exercise_ids` aos exercícios e resultados existentes. Não cria uma segunda entidade de progresso. `useStudy` fornece registros da conta; `useRoad` fornece jornadas; o Store mantém rotinas, agenda, sessões, resultados, metas e XP. O Dashboard reúne estes dados; os relatórios usam o mesmo período e fuso do relatório existente.

O motor determinístico recebe estudo como contexto opcional com proprietário explícito. Somente conclusão/revisão na versão atual de uma aula publicada, válida, compatível e já verificada favorece seus exercícios ligados por ID. O bônus reutiliza o peso editorial de objetivo (8), não é uma constante científica. Os demais critérios de modalidade, disponibilidade, experiência, histórico e meta permanecem. A justificativa referencia a aula, versão e fonte; a descrição da rotina preserva esse contexto ao salvar. A versão de regras é `skill-maxing-2026-10-11.1`. Ler uma aula não comprova dominar a habilidade.

Road transmite seus eventos privados ao mesmo motor. Aulas avançadas continuam acessíveis sem bloqueio de compra ou conclusão de pré-requisitos. Rotinas propostas permanecem editáveis; salvamento/agendamento continuam pelos contratos tipados e confirmações existentes. Nenhuma recomendação altera calendário automaticamente.

## Correções prioritárias realizadas

| Problema observado | Correção implementada |
| --- | --- |
| Estudo e treinamento sem continuidade visível | Dashboard integrado, relatórios de estudo e vínculos exatos aula/exercício |
| Seleção de exercício se perdia ao entrar no planejador | Query validada abre rascunho não salvo; intenção atravessa autenticação/onboarding |
| Progresso de estudo contava versões antigas ou modalidades distintas | Contagem atual separada de histórico preservado |
| Resposta atrasada podia sobrescrever nova consulta de estudo/jornada | Geração de consulta e proteção de proprietário; testes de corrida/logout |
| Rotinas arquivadas e agenda podiam produzir título/horário incoerente no Dashboard | Próxima sessão executável usa rotina ativa correspondente; sessão ativa não herda horário de outra rotina |
| Meta pausada aparecia como objetivo ativo | Filtro por estado real e apresentação da unidade/protocolo |
| Resultado ausente aparentava conclusão | Estado explícito “Sem conclusão registrada” |
| Caminhos antigos ignoravam revisão dos exercícios | Regra comum rejeita verificação futura/inválida, prazo vencido ou conteúdo não verificado |
| Leitura do catálogo dependia do limite implícito do Supabase | Paginação de 500, ordenação estável e erro explícito acima de 10.000, sem dados truncados apresentados como completos |
| Consultas e síntese dependiam exclusivamente da RLS | Filtros de proprietário na leitura e síntese; RLS continua obrigatória |
| Exportação não incluía configuração/confirmações de Skill Maxing | Inclui `evolution_settings` e `evolution_batches` com filtro de proprietário |
| Conteúdo selecionado aparecia ausente durante carregamento | Biblioteca distingue carregamento, falha e item inexistente |
| Contraste de badges insuficiente no tema claro | Token compartilhado ajustado após falha real de axe |

O diagnóstico administrativo verifica metadados, vínculos, versões e modalidade. Não consulta a disponibilidade externa de mapas nem afirma ter testado Fortnite. Os editores e suas permissões existentes são reutilizados.

## Segurança, dados e limites

Nenhuma migration nova: os contratos de `001` a `024` atendem esta integração. Não houve remoção ou regravação de dados existentes, mudança de domínio, identificadores ou políticas para facilitar testes. O teste local aplica todas as migrations, confirma RLS nas tabelas públicas da aplicação e exercita dois usuários, usuário anônimo, edição editorial negada, conclusão e XP idempotentes e snapshot após exclusão da rotina.

A demonstração permanece isolada de contas reais. Um teste com adaptador simulado verifica paginação do catálogo e filtros; não equivale a login hospedado. PGlite executa Postgres local e políticas reais, mas não substitui teste de Supabase hospedado, storage, rede, SMTP ou tokens reais.

Esta integração não envia dados a provedores. Coach conserva consentimento, seleção de contexto, ações confirmadas e alternativa baseada em regras. Knowledge mantém recuperação pública separada; não obtém agenda/dados privados. Nenhum modelo recebeu chaves novas. Não há novas dependências ou custos de API; as leituras adicionais de estudo/jornada precisam ser acompanhadas nas quotas do Supabase. Lembretes com site fechado, matchmaking, análise audiovisual automática e garantias de profissionalização não são oferecidos.

## Fontes técnicas consultadas

- [React · useEffect](https://react.dev/reference/react/useEffect), consultado em 11/10/2026: limpeza de efeitos e respostas fora de ordem. Aplicação: epoch de consulta e testes de troca de conta.
- [Supabase · Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), consultado em 11/10/2026: privilégios, políticas e identidade autenticada. Aplicação: filtros complementares sem substituir RLS e testes por papel.

A pesquisa editorial anterior permanece em `docs/research`, `docs/meta` e `docs/academy`. Esta etapa não atribui nova data de verificação às fontes de jogo, não assistiu vídeos completos e não testou mapas dentro do Fortnite.

## Próximos passos

Integrar as PRs em ordem de dependência; depois executar staging privado com duas contas reais, administração, convites de equipe, exclusão/exportação, consentimento de provedor e callbacks Auth. Rever fontes vencidas no painel, ampliar conteúdo onde há lacunas e medir desempenho em dispositivos reais antes de publicação. Não é possível afirmar uma porcentagem objetiva de prontidão apenas pelos testes locais.
