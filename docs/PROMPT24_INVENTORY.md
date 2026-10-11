# Prompt 24 — inventário e escopo local

Base: 9d64d992e2193243098cd34282fe01607c8faa7f. GitHub Actions 38170299368 e 38170295439 concluídos com sucesso antes de criar esta branch. Branch: feat/staging-foundation; destino futuro da PR draft: feat/post-audit-hardening.

## Infraestrutura observada

| Recurso | Estado | Evidência / ação |
|---|---|---|
| Repositório cumulativo e CI | Configurado e verificado | HEAD remoto igual à base; ambas as execuções do HEAD aprovadas |
| Supabase hospedado | Bloqueado por ausência de infraestrutura | list_projects do conector retornou projects=[]; não consultar projeto de terceiro |
| Domínio e organização Cloudflare | Necessita ação do titular | Titular confirmou que ainda não os possui/definiu |
| Hospedagem / URL staging / produção | Não configurado | Nenhum projeto/URL identificado; criação e conexão necessitam autorização |
| Banco | Preparado no código | 30 migrations cumulativas; catálogo local esperado: 94 tabelas, 131 policies, 145 funções |
| Auth/MFA/SMTP/CAPTCHA | Preparado no código; validação real bloqueada | Fluxos e negativas locais; configurações hospedadas, e-mails e duas abas reais pendentes |
| Edge Functions | Preparado no código | delete-account, clutch-coach, meta-media, fortnite-knowledge, recruitment-submit; verify_jwt=false com auth.getUser nos handlers |
| Headers/CSP/SPA | Preparado no código | public/_headers e _redirects; entrega HTTP não verificada |
| SEO e staging | Necessita preparação local | robots permite páginas públicas; sitemap depende de VITE_SITE_URL; não há modo específico protegido contra indexação |
| Backup/restore/alertas | Bloqueado por ausência de infraestrutura | Nenhuma cópia, restauração ou canal operacional configurado |
| LivePix/recrutamento/planos | Não autorizado para operação | Preservar gates e distinção comercial/competitiva |

Plugins não são infraestrutura. Supabase, GitHub, Codex Security e Strix têm ferramentas expostas. A pesquisa de plugins de hosting não identificou conexão Cloudflare utilizável nesta sessão; nenhuma zona foi inspecionada. Não instalar/conectar serviços automaticamente.

## Inventário de alterações antes da implementação

1. Adicionar build de staging sem publicação, sem sitemap indexável e sem pré-renderização que consulte banco remoto.
2. Gerar robots Disallow, meta robots e X-Robots-Tag; cache no-store e fallback SPA específico no artefato de staging, mantendo o build existente.
3. Adicionar verificação local de variáveis públicas e vínculo ao project ref de staging, sem revelar valores nem afirmar conexão/Access verificados.
4. Testar falhas de isolamento de configuração, segredos, HTML/sitemap e ausência de infraestrutura; adicionar validação do artefato na CI, sem deploy.
5. Documentar inventário de secrets por função, implantação/recuperação por gates, validação HTTP/SDK real, backups, custos com fontes oficiais e checklist por modalidade.
6. Reavaliar KYR-022/038/039/040 preservando fórmulas e exportação; planejar a etapa de escala separadamente, sem alteração oportunista no provider.

Nenhuma migration nova necessária para este bloco. Preservar integralmente 001–030. Nenhum merge, deploy, DNS, compra, serviço pago, Auth remoto ou dado pessoal real autorizado.
