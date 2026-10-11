# KYRVEN — fundação de staging e implantação controlada

Data: 11/10/2026. Esta missão prepara arquivos e procedimentos locais. Não criou projeto, domínio, hospedagem, SMTP, widget, backup ou monitoramento. Não aplicou migrations, mudou Auth/DNS nem publicou. A autorização do Prompt 24 exige autorização expressa adicional para cada alteração remota de infraestrutura.

## Escolha de arquitetura

Proposta: Supabase dedicado exclusivamente a staging, PostgreSQL padrão suportado pelo serviço, dados sintéticos; frontend React/Vite estático em hospedagem com proteção de acesso a testers. Avaliar Cloudflare Pages + Access primeiro porque o código já contém _headers e _redirects. A alternativa Netlify exige conferir os limites de créditos e disponibilidade de proteção privada. Vercel exige conversão de headers/rewrites e avaliar plano: Hobby é restrito a uso pessoal não comercial ([documentação](https://vercel.com/docs/plans/hobby)). Não criar infraestrutura por estar sugerida aqui.

Titular confirmou ausência de domínio e organização Cloudflare definida. O conector Supabase retornou projects=[] nesta sessão; isso prova a lista visível vazia, não a inexistência de todas as contas possíveis do titular. Nenhum project ref ou URL foi inventado. Cloudflare não possui ferramenta de zona utilizável identificada nesta sessão. GitHub está acessível; Codex Security/Strix têm ferramentas, mas scanner ativo não é adequado sem alvo identificado/autorizado. Nenhum scan contra terceiros.

## Arquivos executáveis locais

- `npm run build:staging`: tipos, Vite modo staging, artefato com meta robots e X-Robots-Tag noindex/nofollow/noarchive, robots Disallow: /, sem sitemap, cache no-store e fallback SPA. Desativa prerender remoto inclusive se PRERENDER_PUBLIC era 1. Não publica. Usa .env.staging/.env.staging.local, nunca carrega .env.production pelo modo do build. Variáveis herdadas de processo têm precedência: usar job/shell isolado e conferir project ref antes de qualquer deploy.
- Build sem variáveis é demonstração offline, explicitamente sem serviços. Quando alguma das quatro variáveis obrigatórias estiver preenchida, o build exige conjunto completo e vínculo URL/ref de staging.
- `npm run check:staging`: valida somente formato/vínculo das variáveis e rejeita os padrões de segredo conhecidos pelo checker em VITE_*; sem infraestrutura falha deliberadamente. Não é detector completo de segredos: revisar todas as variáveis públicas e nunca colocar senha/token privado sob outro nome VITE_*. Não confirma posse, conexão, migrations, proteção Access ou configuração Auth. Chaves Turnstile de teste só servem para ensaio isolado; validar widget real depois.
- `npm run check:staging-artifact`: recusa ausência de noindex, sitemap, CSP e fallback no artefato. CI valida build normal e staging sem deploy.
- `scripts/staging-catalog.sql`: consultas read-only de versão, RLS, policies, funções, grants e configuração de buckets. Não coleta linhas pessoais/sessões/secrets. Executar somente no projeto identificado/autorizado, nunca em projeto encontrado incidentalmente.

O build de produção existente continua separado. Ambos escrevem `dist`: nunca reutilizar o resultado do build normal para staging; reexecutar build:staging/check antes do upload autorizado. O artefato não restringe acesso por si só. robots/noindex não são autenticação.

## Sequência de ações do titular e gates

1. Definir organização proprietária, adulto responsável, operador técnico, canal privado de incidentes/privacidade, orçamento máximo mensal e região do banco. Nenhum nome pessoal precisa estar no Git público. Escolher Free de staging ou orçamento pago explicitamente; não criar produção agora.
2. Criar conta/organização Supabase por sua própria ação ou autorizar uma operação concreta: nome staging, organização identificada, região, plano/custo e recuperação. Confirmar project ref do painel e propriedade. Senha do banco/token ficam no cofre local/provedor, nunca enviados no chat ou Git. Preferir acesso MCP/CLI restrito ao projeto e escopo mínimo; verificar documentação vigente.
3. Identificar conta Cloudflare e hostname de staging proposto. Não comprar domínio. Pages pode fornecer hostname do provedor após criação autorizada; até então permanece indefinido. Não criar zona ou alterar DNS nesta missão.
4. Antes de conectar Git/deploy, configurar proteção de acesso para todos os endereços de staging: domínio base do provedor, alias de branch, previews imutáveis e eventual domínio próprio. Testar visitante anônimo e tester permitido. Se o provedor não permitir fechar o endereço base, não publicar o aplicativo nesse endereço. Não usar um build público temporário para depois protegê-lo.
5. Autorizar separadamente implantação do banco, configurações Auth/SMTP/CAPTCHA, secrets/Edge e publicação privada. Para cada ação preencher a ficha abaixo com IDs/efeitos/custo/recuperação. Uma aprovação genérica de documentação não autoriza essas operações.
6. Depois dos testes reais e backup restaurado, solicitar auditoria independente e decisão por modalidade. Nenhum gate local autoriza produção, LivePix ou recrutamento.

## Ficha obrigatória antes de operação remota

| Campo | Preencher antes de solicitar autorização |
|---|---|
| Serviço e proprietário | Organização/conta inequivocamente do titular |
| Projeto e ambiente | ID/ref, região, staging; URL/hostname exatos |
| Operação e efeito | Criação, conexão Git, migrations específicas, Auth, secrets, deploy, Access ou DNS; uma lista explícita |
| Custo potencial | Plano, limites, excedentes, orçamento e quem paga; consultar custo vigente |
| Dados | Apenas fixtures sintéticas e contas de teste; destinos de e-mail autorizados |
| Estado anterior | Inventário, export/configuração segura e backup quando aplicável |
| Recuperação | Conter acesso, retornar frontend ao artefato validado ou corrigir banco incrementalmente; responsável |
| Evidência da aprovação | Autorização expressa do titular para essa lista, sem registrar secrets |

Ainda não é possível preencher IDs reais. Nenhuma solicitação de autorização de infraestrutura é apresentada como se esses campos estivessem definidos.

## Supabase 001–030

1. Conferir integridade Git das 30 migrations contra a base. Não reescrever histórico. Catalogar seeds incluídos e impedir reexecução manual; manter recrutamento/gate fechados. Conferir o histórico de migrations do projeto antes de qualquer push.
2. Instalar/identificar CLI oficial aprovada localmente e registrar versão. Descobrir comandos com `supabase --help`, `supabase link --help`, `supabase migration list --help`, `supabase db push --help`, `supabase db dump --help` e `supabase functions deploy --help`. CLI não estava disponível na missão anterior; não assumir flags sem verificar a versão. Comandos deste passo não incluem deploy.
3. Após autorização, vincular somente o ref confirmado, comparar lista local/remota e executar dry-run quando a versão oferecer. Revisar a sequência integral antes do db push; abortar se histórico divergente. A migration 029 possui assertivas deliberadas; não removê-las para resolver falha. A 030 é incremental, com leitura pura, páginas e expiração explícita. Não há migration 031 neste Prompt 24.
4. Antes de modificar banco existente, obter backup recuperável e registro de configuração. Projeto staging vazio ainda precisa registrar baseline. Não correr scripts de reset, drop, seed histórico ou restore sobre banco existente.
5. Aplicação autorizada deve ser seguida de catálogo real. Esperado em public/private: 94 tabelas, 131 policies, 145 funções; extensões/provedor podem acrescentar objetos, então comparar nomes/assinaturas com `scripts/security-database-inventory.mjs`, não somente contagens. auth/storage/realtime não são replicados integralmente por PGlite.
6. Examinar grants PUBLIC/anon/authenticated, policies USING/WITH CHECK, proprietário de SECURITY DEFINER e search_path vazio; schema private fora da Data API. Exatamente cinco helpers privados necessários foram readmitidos em 029. Confirmar REST/RPC real e schema cache sem ampliar grants para contornar erro.
7. Storage: bucket meta-images privado, limite 3 MiB; migration 016 declara MIME PNG/JPEG/WebP, mas handler atual tem validação mais restrita — conferir bytes reais e contrato efetivo. O ramo condicional de criação só existe se storage.buckets estiver disponível; confirmar policies reais em storage.objects e ausência de policies permissivas de outros projetos. Testar visibilidade editorial pública e URLs assinadas, outro usuário, AAL1/AAL2, expiração, remoção e órfãos.
8. Falha: manter aplicação fechada, preservar erro sanitizado e catálogo parcial. Não repetir migrations cegamente. Distinguir falha transacional de comando parcialmente aplicado e comparar migration ledger. Recuperação por correção incremental revisada ou restauração em projeto isolado autorizado; nunca apagar migration aplicada.

Consultar changelog antes de criar projeto. A revisão atual encontrou upgrade PostgreSQL 15.19/17.11 com correções e recomendações para ltree/pgcrypto/btree_gist; não foram encontradas declarações dessas extensões no histórico do projeto. Reavaliar versão/extensões realmente instaladas no novo banco, sem executar reindex/reencriptação por presunção ([aviso oficial](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)).

## Variáveis e funções

| Nome | Local / natureza | Uso |
|---|---|---|
| VITE_SUPABASE_URL | Browser, público | URL do staging identificado |
| VITE_SUPABASE_ANON_KEY | Browser, público | Chave publishable ou legacy anon; nunca secret/service_role |
| VITE_SITE_URL | Browser/build, público | Origem HTTPS exata; sem query, fragment ou credenciais |
| VITE_TURNSTILE_SITE_KEY | Browser, público | Widget do staging com hostname permitido |
| VITE_DISCORD_INVITE | Browser, opcional | Convite oficial conferido; pode permanecer vazio |
| KYRVEN_STAGING_PROJECT_REF | Verificação local | Ref informado pelo titular, vínculo URL/ref; não autorização |
| SUPABASE_URL/ANON_KEY | Runtime Edge | Fornecidos pelo projeto; confirmar compatibilidade de anon/JWT legado com gateway/SDK |
| SUPABASE_SERVICE_ROLE_KEY | Runtime Edge, segredo | delete-account, meta-media e recruitment-submit; jamais frontend |
| ALLOWED_ORIGIN | Runtime Edge, configuração | Origem exata do frontend, sem fallback localhost em deploy |
| OPENAI_API_KEY | Runtime Edge, segredo | clutch-coach e fortnite-knowledge; não necessária para ensaios sem IA |
| TURNSTILE_SECRET_KEY | Edge e configuração Auth, segredo | recruitment-submit/Siteverify e integração CAPTCHA Auth |
| SUPABASE_ACCESS_TOKEN / senha/URL do banco | Cofre operador/CLI | Gestão e migrations; não guardar em .env frontend |

Cinco Edge Functions deployáveis: delete-account (getUser/AMR, exclusão privilegiada), meta-media (Auth/cargo+AAL2, bucket privado), recruitment-submit (Auth/quota/Siteverify/ticket; gate continua fechado), clutch-coach e fortnite-knowledge (Auth, RLS, quotas e IA opcional). `_shared/billing.ts` é contrato puro, não endpoint LivePix.

verify_jwt=false em config.toml é intencional: o handler verifica Auth.getUser. Implantação deve validar cada caminho 401/403, token malformado/expirado, CORS, 413/429/503, timeout e ausência de segredo no erro. Ausência de Origin não é autorização; chamadas diretas do Supabase não recebem WAF do frontend. Não definir secret IA nem testar provedor pago sem autorização de uso/custo.

## Hospedagem privada, headers, cache e recuperação

Receita proposta: Node 24; instalação por lockfile `npm ci --ignore-scripts`; `npm run check:staging`, `npm run build:staging`, `npm run check:staging-artifact`; saída dist. Desativar auto-deploy de produção e de outras branches antes de conectar Git. Não adicionar workflow com token de deploy agora. Preferir publicação manual aprovada do artefato exato após proteger todos os hostnames.

Pages aplica _headers a assets estáticos; respostas de Pages Functions exigem headers próprios ([documentação](https://developers.cloudflare.com/pages/configuration/headers/)). Conferir HTTP de /, /security, /app/skills, rotas editoriais, 404 e assets: CSP, nosniff, frame-ancestors, Referrer-Policy, Permissions-Policy, noindex, no-store. Fallback universal só está no artefato de staging; validar rotas/arquivos ausentes na hospedagem. Frontend estático não controla cache do Auth/REST/Storage: conferir respostas diretas e nunca configurar cache everything em endpoints autenticados.

HTTPS/certificado e proteção da origem devem ser verificados em todos os endereços acessíveis. Não ativar HSTS preload/includeSubDomains sem domínio, inventário e aprovação. CSP existente permite *.supabase.co para compatibilidade; restringir ao projeto real e testar imagens assinadas/WebSocket quando o ref existir, por alteração revisada. Não liberar unsafe-eval/script-src *.

Previews Pages são públicos por padrão. O toggle Access de preview não protege automaticamente hostname base/custom domain; cada caminho precisa de política e teste negativo ([documentação](https://developers.cloudflare.com/pages/configuration/preview-deployments/)). Um link difícil de adivinhar não é proteção. Recuperação: conservar artefato/hash anterior e configuração Access, fechar rotas se proteção falhar, restaurar versão validada por operação autorizada e repetir teste anônimo. Rollback frontend não desfaz migration; conferir compatibilidade e preparar correção incremental. Nenhuma política/regra remota foi aplicada.
