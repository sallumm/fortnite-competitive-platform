# Arquitetura do MVP

Clutchfolio é uma SPA React/TypeScript compilada pelo Vite. A hospedagem é estática e independente de construtores: Cloudflare Pages serve `dist`, enquanto Supabase Auth, PostgREST e PostgreSQL cuidam de identidade, dados e autorização. CSS com tokens próprios evita adicionar um framework de estilos a uma interface pequena. Lucide fornece ícones, Recharts é carregado na rota de relatórios e Zod valida edição de conteúdo.

## Limites de confiança

O navegador não define papéis nem calcula XP para contas reais. PostgreSQL é a autoridade de propriedade, permissões editoriais e progressão. O esquema `private` contém a atribuição administrativa, sem concessões a visitantes ou usuários autenticados. `is_admin()` é uma função restrita que retorna somente um booleano. A UI administrativa é uma conveniência; suas gravações também passam por RLS e constraints.

Todo dado privado carrega um proprietário. Agendamentos possuem chave estrangeira composta que impede associar o plano de outro usuário. Sessões e transações de XP só recebem escrita pelas funções `start_training` e `finish_training`. A conclusão bloqueia a linha do perfil e da sessão, valida os resultados, aplica o teto de 200 XP/dia UTC e grava estado e XP na mesma transação. Reenvio da conclusão retorna o resultado anterior. Isso impede duplicação de XP, mas não prova que a pessoa realizou o treino: os registros são autodeclarados.

## Modelo implementado

| Entidade | Responsabilidade |
| --- | --- |
| `profiles` | Preferências e onboarding; e-mail fica no Auth |
| `exercises` | Exercícios, dados de ilhas, fonte e métrica |
| `training_plans` | Rotinas com até 20 etapas validadas no banco |
| `scheduled_sessions` | Agenda com vínculo opcional a torneio |
| `training_sessions` | Sessão e snapshot dos exercícios da data de início |
| `personal_goals` | Metas autodeclaradas sem bônus de XP |
| `xp_transactions` | Livro de XP, exclusivo por sessão |
| `bookmarks` | Exercícios e eventos salvos |
| `articles` | Notícias, análises e aulas com publicação futura opcional |
| `tournaments` | Calendário editorial, horário opcional e validade da revisão |
| `content_revision_history` | Auditoria de alterações editoriais |
| `private.user_roles` | Papel administrativo definido pelo operador |

Etapas e resultados ficam em arrays JSONB limitados, dentro da sessão/rotina. O MVP não exige análise SQL transversal de cada tentativa; a opção reduz gravações e permite snapshots atômicos. Ao expandir o volume ou implementar métricas detalhadas, migrar para `plan_exercises` e `exercise_results` normalizados. Migrations versionadas mantêm essa evolução reproduzível.

Conquistas e ranks são derivados dos registros persistidos, sem tabela adicional redundante. Os ranks medem participação. Fontes ficam nos registros editoriais; para múltiplas referências e workflow com revisores distintos, evoluir para `sources`, `article_sources` e `editorial_reviews`.

## Dados e conteúdo

Na instalação sem Supabase, somente a demonstração grava dados, explicitamente no navegador. Não há conta local falsa. Ao configurar Supabase, o conteúdo publicado vem do banco e a demonstração continua isolada com o catálogo inicial. Datas de verificação e limites de validade permanecem visíveis; nenhum feed promete estar atualizado permanentemente.

Os snapshots preservam instruções e métricas de uma sessão mesmo depois de edições do catálogo. As tendências comparam apenas o mesmo exercício e definição de métrica; equivalência de cenário, arma e configuração continua dependendo do registro e da observação do jogador, informada na interface. Uma versão futura deve acrescentar identificadores estruturados de configuração.

## Expansão planejada

Resultados de torneios, rodadas, temporadas, jogadores e organizações precisam de fontes autorizadas e governança editorial antes de receber dados. Não há scraping, API não autorizada ou jogadores fictícios. A futura IA deverá usar uma interface de servidor com conhecimento revisado, referências e limites por usuário; a central atual é busca estruturada. Pagamentos, coaching humano, push e sincronização automática não estão ativos.

## Operação

Auth usa limites do provedor; o RPC limita inícios a 60 em 24 horas. Isso não substitui controle de abuso em escala. Configure CAPTCHA/SMTP/limites de Auth antes de abrir cadastro. A função de exclusão valida o token no Auth, a origem e login recente, e usa a chave administrativa apenas no servidor. RLS não fornece proteção contra roubo de sessão por extensões ou dispositivo comprometido; CSP, tratamento de texto por React e ausência de HTML arbitrário reduzem a superfície web.
