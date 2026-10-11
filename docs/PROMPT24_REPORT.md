# KYRVEN — Prompt 24: infraestrutura e fundação de staging

Data: 11/10/2026. Branch: feat/staging-foundation. PR #22 draft, destino feat/post-audit-hardening.
Base autorizada: 9d64d992e2193243098cd34282fe01607c8faa7f.
Último commit técnico: bd819a3e65a0b29e71309450b441f08f4b9d7262.
HEAD documental e lista de commits: manifest do pacote final.

## Resultado efetivo

A preparação local foi implementada e preservada. **Nenhum staging hospedado foi criado ou validado.** Supabase list_projects retornou projects=[]; o titular confirmou ausência de domínio e organização Cloudflare definidos. Não existem URLs/ref de staging/produção identificados. Nenhuma compra, projeto pago, DNS/Auth remoto, migration remota, publicação, merge, pagamento ou recrutamento foi executado.

O gate inicial foi respeitado: antes de qualquer alteração, GitHub confirmou sucesso das execuções [38170299368](https://github.com/sallumm/fortnite-competitive-platform/actions/runs/38170299368) e [38170295439](https://github.com/sallumm/fortnite-competitive-platform/actions/runs/38170295439) no HEAD exato 9d64d992. O HEAD remoto foi reconferido; a branch deriva dessa versão cumulativa, não da main antiga.

## Implementado e verificado

Build separado build:staging usa modo staging, não consulta catálogo remoto, omite sitemap e produz HTML/meta robots, robots Disallow e X-Robots-Tag noindex/nofollow/noarchive, cache no-store e fallback SPA. check:staging-artifact valida o resultado. Não há workflow de deploy, token de infraestrutura ou serviço criado. O zip offline de dist é material de revisão, não autorização para publicar.

check:staging valida variáveis públicas e vínculo URL/ref; erros não imprimem valores. Com ausência de serviços, falha deliberadamente. Build totalmente sem variáveis gera demonstração offline; configuração parcial é recusada. Template .env.staging.example vazio foi preservado e .env.staging.local/.env.production.local continuam ignorados. Variáveis de processo têm precedência: operador deve isolar jobs e confirmar ref/ambiente; a validação não comprova posse nem Access/Auth.

O build normal continua disponível. Em staging, o prerender não lê .env.production nem faz fetch, mesmo com PRERENDER_PUBLIC=1. Testes desafiam sitemap reintroduzido, HTML aninhado, secret público, project mismatch, ausência de configuração e prerender remoto. A CI executa build normal, build staging e verificação do artefato.

scripts/staging-catalog.sql é somente leitura, para o futuro projeto identificado: versão PostgreSQL, tabelas/RLS, policies, funções/grants/search_path e buckets. Não executado remotamente. Migrations 001–030 preservadas; nenhuma migration 031 criada.

## Inventário e dependências por missão

| Missão | Implementado/preparado | Ainda não configurado / ação necessária |
|---|---|---|
| A — Inventário | Repositório/CI verificados; variáveis/funções/hosting catalogados | Organização, região, orçamento e responsáveis pelo titular |
| B — Banco | 30 migrations, catálogo local e SQL read-only | Identificar/criar projeto autorizado; migration ledger, aplicação e catálogo PostgreSQL real |
| C — Auth/segurança | Fluxos existentes e roteiro HTTP/SDK positivo/negativo | SMTP, confirmação, recovery, MFA/JWT real, duas abas, CAPTCHA e exclusão/Storage |
| D — Hosting | Artefato staging/CSP/SPA/noindex/cache, sequência de recuperação | Conta/hostname, Access em todos os endereços, HTTPS/headers reais; DNS somente se autorizado |
| E — Operação | Plano backup banco+objetos, restauração, minimização, incidentes/custos | Cofre, backups, restauração medida, orçamento, operadores e alertas reais |
| F — Escala | Reavaliação e etapa separada com referência integral | KYR-022 residual, KYR-039/040 e volumes/EXPLAIN reais; KYR-038 entre abas reais |
| G — SEO/experiência | Favicons/OG/metadados existentes; staging protegido contra indexação no artefato; regressões browser | Domínio/canonical/sitemap/Search Console produção; Lighthouse privado/CWV de campo |
| H — Produto | Planos e gates preservados | Benefícios comerciais, operação humana e contratos não disponíveis; nenhuma ativação |

Os estados e ações detalhados constam em PROMPT24_INVENTORY.md e PROMPT24_STAGING_RUNBOOK.md. Plugin instalado não é projeto conectado. A pesquisa de hosting não identificou ferramenta Cloudflare de zona utilizável nesta sessão; não há inspeção DNS. Codex Security/Strix têm ferramentas expostas; nenhum scanner ativo foi executado sem alvo autorizado.

## Testes e limitações

- Vitest local: 388/388, 66 arquivos; JSON completo no pacote. Após ajuste final que evita leitura de .env.production no prerender de staging, os 5 testes de staging/prerender passaram novamente.
- Playwright local: 81/81, desktop/tablet/mobile, zero flaky/skipped, 5,9 min. Código de UI/e2e preservado. Relatório JSON extraído e log completo no pacote.
- Build staging final bd819a3 e check:staging-artifact: aprovados. TypeScript app/coach incluídos.
- Build normal: tentativa no sandbox falhou por realpath EPERM Windows; repetição fora do sandbox aprovada. Sem alteração de permissões ou código de produto para mascarar teste.
- Static security/brand: aprovados; Actions por SHA, token contents:read e nenhuma etapa de deploy.
- Catálogo PGlite: 94 tabelas, 131 policies, 145 funções; sem tabela public/private sem RLS nem SECURITY DEFINER sem search_path vazio. Não replica Auth/Storage hospedados.
- Bundle de entrada medido pelo report:bundle: 566.141 bytes / 176.462 gzip (assets de entrada enumerados no log). Não é medição de Web Vitals/dispositivo real.
- Integridade: diff Git vazio nas 30 migrations e hashes normalizados LF preservados.
- check:staging e check:production: exit 1 esperado pela ausência de variáveis reais. Não preencher placeholders para fazê-los passar.
- CI do código bd819a3: [38171871057](https://github.com/sallumm/fortnite-competitive-platform/actions/runs/38171871057) concluída com sucesso no SHA exato bd819a3e65a0b29e71309450b441f08f4b9d7262: 388 Vitest, 81 Playwright, build normal/staging, static security/brand, catálogo e artefato, Node 24.21.0. O commit documental posterior não é apresentado como tendo CI aprovada por esta execução.
- Supabase CLI: não encontrada no PATH. Comandos de gestão/deploy só serão definidos após instalar/identificar versão e ler --help, em projeto autorizado.

Nenhum teste foi desativado, timeout/asserção enfraquecido ou gate remoto aberto. O shim de filesystem usado em alguns comandos locais fica fora do produto. Testes locais e artefatos não comprovam emissão de JWT, SMTP, configuração Turnstile, CSP entregue, proteção da origem, backup/restore ou capacidade sob carga hospedada.

## Escala e riscos residuais

KYR-022 continua parcial: bolsas, objetivos/revisões de desenvolvimento, ciclos e comentários ainda exigem paginação própria. KYR-039/040 continuam abertos. Não aplicar LIMIT no provider nem remover o teto sem agregado integral, cursor/snapshot e exportação completa; isso mudaria XP, calendário, comparações ou relatórios. A etapa de PROMPT23_5_SCALABILITY_PHASE.md foi reavaliada e ordenada em PROMPT24_REAL_VALIDATION.md. Não há equivalência de volume nova para encerrar esses achados.

KYR-038 permanece parcial até duas abas reais Auth/SDK no projeto identificado. OBS23-002 não ganha causa por repetição positiva. Esta preparação não altera as classificações herdadas dos 49 nem encerra os 13 externos por mocks.

Alta para lançamento: inexistência de infraestrutura/proteção de acesso/operador/backup recuperável/alertas; risco de previews públicos antes de Access. Média: escala residual, Auth/Storage/quotas reais, CSP wildcard e HTTPS/HSTS/origin não medidos. Baixa: causa histórica intermitente UI. Manual separado Prompt 19 continua não encontrado.

## Ações do titular, custos e decisão

1. Definir organização Supabase, região, plano/orçamento e operador; identificar conta hospedagem e lista de testers.
2. Autorizar operação concreta de criação staging, com serviço/ID/ambiente/efeito/custo/recuperação. Não enviar secrets pelo chat.
3. Definir hostname após criação aprovada e proteger endereço base, alias e previews antes de qualquer publicação. Noindex não restringe acesso.
4. Autorizar sequencialmente migrations, Auth/SMTP/CAPTCHA, secrets/Edge e deploy privado; realizar roteiro HTTP/SDK, catálogo real e restauração isolada.
5. Reavaliar gates com auditoria independente. Sem autorização, parar antes de operação remota.

Referências de custo detalhadas com fontes oficiais em PROMPT24_OPERATIONS_COSTS.md: cenário básico Free de ensaio pode custar US$0/mês dentro das cotas, sem garantir custo total zero/SLA; Supabase Pro parte de US$25/mês, dois Micro aproximadamente US$35/mês antes de extras. SMTP/domínio/backup externo/IA não têm fornecedor/modelo definidos nem total verificável.

Demonstração local sintética e revisão da fundação em código: GO. **Staging autenticado hospedado e produção: NO-GO** até identificação, autorização e provas reais. LivePix, assinaturas, seletivas públicas, menores e recrutamento não autorizados. FREE/PRO/ELITE e PROSPECT/ACADEMY PLAYER/ROSTER permanecem separados; aprovação competitiva independe de pagamento, sem promessa de benefícios/operação inexistentes.

O pacote traz fontes, bundle incremental (requer base 9d64d992), artefato offline, logs, catálogo, integridade, manifest e hashes verificados. PR #22 draft sem merge: https://github.com/sallumm/fortnite-competitive-platform/pull/22. Ao concluir, aguardar instruções do titular; nenhuma próxima etapa foi iniciada.
