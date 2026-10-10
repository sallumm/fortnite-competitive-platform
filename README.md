# Clutchfolio — MVP de treinamento e informação competitiva

Projeto novo, independente, em português brasileiro. Nome de trabalho sujeito a pesquisa formal de marca. Interface carvão/verde-lima/violeta, modo claro, layouts responsivos, foco visível e suporte a movimento reduzido. Nenhum repositório existente foi alterado.

## Estado da entrega

Código versionado no GitHub, 20 testes locais aprovados e workflow de testes/build aprovado no GitHub Actions, sem publicação do site ou Supabase hospedado configurado. A demonstração funciona sem serviços externos, explicitamente no navegador. As contas reais e a editoria persistente exigem configurar Supabase. Não há credenciais privadas, pagamentos, resultados inventados ou servidor Discord fictício.

| Implementado | Observação |
| --- | --- |
| Landing, navegação, temas e demonstração | Demonstração separada da conta real |
| Cadastro, login, logout, recuperação e alteração de senha | Implementação Supabase Auth; requer configuração e validação hospedada |
| Onboarding em quatro etapas, perfil e preferências | Modalidade, nível, foco, dispositivo, duração e fuso |
| CRUD e duplicação de rotinas, ordenação de exercícios | Etapas validadas no cliente e banco |
| Agenda diária/semanal/mensal, edição e remoção | Instantes UTC, exibição no fuso do perfil |
| Sessões, cronômetro, pausa, retomada, conclusão/interrupção | Rascunho neste navegador; snapshot de conteúdo no banco |
| Resultados, notas, histórico e exportação dos dados | Dados autodeclarados, privados por RLS |
| Relatórios, metas, XP, ranks e conquistas derivadas | XP por RPC atômico; limite diário; sem penalidade por descanso |
| Catálogo, busca, filtros, favoritos e cópia de códigos | 8 exercícios; fontes verificadas; sem gameplay testado |
| Central competitiva e calendário | 4 eventos editoriais iniciais; lista incompleta, atualização manual |
| Páginas de eventos, favoritos, exportação `.ics` | Sem horário confirmado: evento de dia inteiro, sem conversão inventada |
| Vínculo entre preparação para evento e agenda | Treino agendado com referência ao torneio |
| Notícias, análises, Academy, glossário e busca | 4 conteúdos iniciais originais com fontes e contexto |
| Painel editorial: exercícios, campeonatos, aulas e notícias | CRUD, publicação futura de artigos, data de revisão, auditoria e RLS |
| Central de ajuda e recomendações por regras | Não se apresenta como IA generativa |
| Comunidade configurável, planos conceituais | Convite opcional; PRO/ELITE sem vendas |
| Exclusão de conta, exportação, textos legais preliminares | Função de servidor exige login recente; operação pública precisa de revisão |
| Headers de segurança, robots, sitemap condicional, metadata | SPA; SEO social/servidor ainda limitado |

## Tecnologias e estrutura

React, TypeScript, Vite, React Router, CSS com tokens, Lucide, Recharts, Zod, Supabase/PostgreSQL. Vitest, Testing Library e PGlite verificam lógica, fluxos em DOM e permissões SQL. Dependências exatas estão travadas em `package-lock.json`.

| Diretório | Conteúdo |
| --- | --- |
| `src/pages` | Telas carregadas sob demanda |
| `src/components` | Navegação, calendário e componentes compartilhados |
| `src/lib` | Tipos, cliente Supabase, persistência, lógica, validação, SEO e catálogo inicial |
| `public` | Favicon, redirects SPA, headers e robots |
| `supabase/migrations` | Esquema, RLS, funções transacionais e conteúdo inicial |
| `supabase/functions/delete-account` | Exclusão autenticada, exclusivamente no servidor |
| `tests` | Testes de interface, lógica e PostgreSQL |
| `scripts` | Geração reproduzível de seed SQL e sitemap |
| `.github/workflows/ci.yml` | Testes e build em GitHub Actions após envio ao repositório |

Mais detalhes em `ARCHITECTURE.md`, `RESEARCH.md` e `VALIDATION.md`.

## Execução local

Use Node.js 24 LTS e npm. Na pasta extraída:

```bash
npm ci
npm run dev
```

Abra `http://localhost:5173`. Sem `.env`, use “Explorar demonstração”. O cadastro informa que está indisponível; não existe autenticação local simulada.

```bash
npm test
npm run build
npm run preview
```

`dist` é gerado para hospedagem estática. Não abra `index.html` diretamente por `file://`; módulos e rotas precisam de servidor HTTP.

## Ativar Supabase

1. Crie um projeto Supabase próprio. Escolha uma região adequada e guarde a senha do banco fora do frontend.
2. Execute, na ordem, os dois arquivos de `supabase/migrations` no SQL Editor. São migrations de um projeto novo; não aplique sobre banco alheio ou produção existente. A segunda insere o catálogo inicial.
3. Copie `.env.example` para `.env.local`. Preencha somente a URL pública e a chave publicável/anon do projeto:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA-CHAVE-PUBLICAVEL-OU-ANON
VITE_DISCORD_INVITE=
VITE_SITE_URL=
```

Essas duas variáveis são públicas por definição. **Nunca coloque service_role, senha do banco ou token administrativo em variáveis `VITE_`.** Reinicie o dev server após alterar a configuração.

4. No Auth, configure Site URL e as Redirect URLs para `http://localhost:5173/auth`, `http://localhost:5173/auth?recovery=1` e as equivalentes do endereço publicado. Mantenha confirmação de e-mail configurada conforme sua política. Configure SMTP e CAPTCHA antes de abrir cadastros; existem limites de envio e autenticação do provedor.
5. Crie uma conta pela interface, confirme o e-mail quando exigido e faça o onboarding. O perfil é criado com o ID do usuário autenticado.
6. Atribua o administrador manualmente no SQL Editor, usando o ID real da sua conta em Auth → Users:

```sql
insert into private.user_roles(user_id, role)
values ('UUID-REAL-DA-SUA-CONTA', 'admin')
on conflict(user_id) do update set role=excluded.role;
```

Recarregue o site e abra `/admin`. Usuários comuns não podem atribuir esse papel. Não conceda acesso ao esquema `private`.

7. Publique a função de exclusão com a CLI Supabase autenticada e vinculada ao seu projeto:

```bash
supabase functions deploy delete-account --project-ref SEU-PROJECT-REF
supabase secrets set ALLOWED_ORIGIN=https://SEU-ENDERECO-PUBLICADO
```

A CLI deve ser instalada pelo método oficial adequado ao seu sistema. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são variáveis de servidor do ambiente Supabase; não as copie ao frontend. A função rejeita exclusão após mais de 15 minutos do último login: saia e entre novamente antes de tentar. Em produção, valide Auth, exclusão e cascades com contas de teste antes de abrir o serviço.

## GitHub novo e independente

Repositório do projeto: https://github.com/sallumm/fortnite-competitive-platform. A branch principal é `main`. O workflow de CI executa os testes e build em cada push/PR.

```bash
git clone https://github.com/sallumm/fortnite-competitive-platform.git
cd fortnite-competitive-platform
npm ci
npm run dev
```

Não adicione `.env.local`, `node_modules` ou `dist`. O `.gitignore` já os exclui.

## Publicar no Cloudflare Pages

Após o código estar no repositório novo, conecte-o a um projeto **Pages**, usando integração Git:

| Configuração | Valor |
| --- | --- |
| Framework | React (Vite) |
| Diretório raiz | Raiz do repositório |
| Comando de build | `npm run build` |
| Diretório de saída | `dist` |
| Node | `24` |
| Variáveis públicas | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`, convite opcional |

Configure as variáveis nos ambientes adequados e faça rebuild: Vite incorpora valores no build. Para começar só com a demonstração, omita as variáveis Supabase. Depois da primeira publicação, defina `VITE_SITE_URL` com o endereço HTTPS verdadeiro para gerar sitemap e configure esse mesmo endereço nos redirects do Auth e `ALLOWED_ORIGIN`. Confira `_headers` e `_redirects` na publicação.

O subdomínio do Pages depende da disponibilidade e das condições da plataforma. Não foi reservado domínio. Domínio próprio pode exigir aquisição e configuração DNS, além da verificação de marca.

## Operação editorial

No painel, mantenha uma fonte HTTPS, a data de verificação, o prazo de revisão e o controle de publicação. Artigos podem ter data futura; RLS só os expõe após a data definida. Torneios sem horário confirmado usam datas e exportação de dia inteiro. Horários devem ser convertidos de uma origem de fuso conhecida para UTC. Informação vencida permanece com aviso e link original, sem fingir atualização automática.

Os registros de revisão ficam em `content_revision_history` e são legíveis somente por administradores; a UI ainda não oferece comparação/restauração. Atualização do conteúdo no banco não exige editar o código, exceto a demonstração, que mantém um catálogo de referência separado. Não execute novamente o gerador de seed para substituir edições ao vivo.

## Limitações e próximos passos

- Supabase hospedado, e-mails, função de exclusão, Cloudflare não foram configurados nesta sessão. Não há URL publicada.
- QA visual em desktop/mobile, auditoria WCAG, Lighthouse e testes de navegadores reais não foram executados. Os testes de interface usam DOM simulado.
- Base editorial inicial reduzida. Não há resultados atuais, classificação, profissionais, organizações, meta completo, transmissão incorporada ou sincronização automática.
- Calendário pessoal tem agendamentos individuais; não há recorrência automática semanal nem reagendamento inteligente de vários treinos.
- Rascunhos do treino ficam neste navegador; ao trocar dispositivo, a sessão ativa permanece, mas timer e resultados em preenchimento precisam ser retomados manualmente. Limite atual de tempo ativo: 24 horas por sessão.
- Tendências exigem mesma definição de métrica. Cenário/arma/configuração ainda são responsabilidade do registro do usuário; IDs estruturados de configuração são a próxima melhoria.
- Notificações são avisos ao abrir o site, sem push, e-mail ou monitoramento de fundo. Não há assistente generativo, pagamentos ou coaching humano.
- Termos e privacidade são preliminares. Identifique operador e canal de direitos, revise proteção de adolescentes e condições de IP antes de operação pública/comercial.
- SPA limita SEO de crawlers sem JavaScript e cartões sociais por artigo. Próxima etapa: SSR/prerender de conteúdo público e sitemap vinculado ao banco.
- Uso gratuito de infraestrutura depende dos limites e condições dos provedores. Não foram estimados custos de escala ou domínio.
