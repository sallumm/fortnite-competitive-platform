# KYRVEN — relatório de implementação do Prompt 20

Data: 2026-10-11. Branch: `feat/security-hardening-reconstruction`. Base cumulativa verificada: `eca9630d7f4c4a45a1b08f7331577ab1da39e427`, branch `feat/ultimate-brand-transformation`. O hardening foi reconstruído e preservado em checkpoints remotos. Não há autorização de produção: hospedagem, staging e projeto Supabase ainda não existem.

## Procedência e escopo

Foram considerados o diagnóstico de recuperação, KYRVEN_MASTER_SECURITY_PRODUCT_AUDIT_ATUALIZADO.md (auditoria 21.1, 49 achados), KYRVEN_PROMPT20_ORIGINAL.md integral e documentação operacional cumulativa. Fetch e consulta GitHub revalidaram a versão antes das alterações. A main permanece anterior à versão cumulativa; os PRs anteriores não foram integrados por esta missão.

O inventário docs/PROMPT20_INVENTORY.md foi commitado antes da implementação. O manual separado do Prompt 19 não foi localizado no ZIP, repositório ou arquivos kyrven de Downloads; foi solicitado o caminho ao usuário. KYRVEN_HANDOFF.md, PRODUCTION-READINESS.md, esports/MANUAL_SETUP.md e PROMPT18_REPORT.md foram lidos como evidência preservada. A conferência do manual ausente permanece pendente; não se declara equivalência documental.

A implementação antiga de Prompt 20 não foi recuperada nem copiada de branch inexistente. Os defeitos descritos na auditoria foram reavaliados contra a base existente, reconstruindo somente controles ausentes/incompletos. Trabalho limitado à branch, com dados sintéticos e sem operações remotas no Supabase, deploy, DNS, pagamentos, recrutamento, merge ou testes invasivos.

## Checkpoints preservados no GitHub

| Commit | Bloco |
|---|---|
| 5fda173896d48dea9ecd978f279bd122ff3d00f6 | Inventário e fronteiras antes das alterações |
| f7dca3351d0df0daeede5332b40a83c0242b6e3e | Limites de stream de IA/mídia e gateway Knowledge |
| 2b0f963221dd564d6d20c57ad16de09cce855106 | MFA backend/UI, CAPTCHA servidor, migration 029, CSP e limpeza local |
| 0ef7a61a755c228f98645f096372efee04461b55 | Aceite versionado, reautenticação verificada, contratos financeiros e CI |
| 46a1a9f3e0a1d0da8348f7ad913ae67a91a3faa1 | Correção de CAPTCHA no login, proteção de seeds e catálogo completo |

Commits documentais posteriores agregam esta entrega. A branch remota é a fonte cumulativa; o manifesto de entrega registra a ponta final. A publicação dos commits foi feita pelo conector GitHub e verificada por fetch, devido à indisponibilidade do gerenciador de credenciais Git local. Não houve force push nem reescrita de histórico remoto.

## Modelo de ameaças e acesso

Prioridades: conta comum maliciosa, sessão administrativa AAL1 comprometida, ID de terceiro forjado, bot autenticado, arquivo/corpo excessivo, instrução hostil em conteúdo recuperado, webhook falso e erro operacional. Ativos: identidade, dados de treino, avaliações/gabaritos, notas de avaliadores, cargos/benefícios, credenciais e disponibilidade.

| Categoria | Fronteira mantida ou reforçada |
|---|---|
| Perfil, treino, agenda, histórico, relatórios e aceite | Proprietário autenticado; RLS e RPCs conferem auth.uid |
| Recursos de equipe | Participação/compartilhamento explícito; helpers necessários preservados |
| Conteúdo publicado | Leitura pública por política; rascunhos/admin permanecem restritos |
| Candidaturas, provas, respostas e decisões | Schema private, papéis/atribuição, RPCs e auditoria; sem exposição pública dos gabaritos |
| Administração/editorial/IA | Papel servidor e AAL2; confirmação/publicação controladas |
| Segredos | Cofre servidor futuro, nunca VITE ou payload do browser |
| Pagamentos | Contrato servidor preparado, integração e ledger futuros; nenhuma concessão por cliente |

Catálogo reproduzível completo: `scripts/security-database-inventory.mjs`, evidência `prompt20-database-catalog.json`. Em PGlite, 94 tabelas, 131 políticas e 143 funções após 001–029; nenhuma tabela sem RLS e nenhuma SECURITY DEFINER sem search_path vazio. RLS habilitado não prova por si só autorização correta: os testes de papéis/contas complementam a inspeção. Auth/Storage de Supabase não são emulados integralmente por esse catálogo.

## Correções implementadas

**MFA e autorização.** private.aal2 lê a claim confiável da requisição PostgREST. public.is_admin e public.esports_is_admin exigem papel e AAL2. Caminhos alternativos de esports_staff foram tratados em oito funções específicas; o helper genérico de papel de outro usuário permanece apropriado para atribuição, sem exigir o MFA do avaliador errado. security_status informa somente o próprio estado/papel necessário ao enrollment. A tela /security suporta cadastro TOTP, challenge, seleção entre fatores verificados e remoção com confirmação/refresh. Não basta ocultar botão; a negativa é no banco/Edge. A exigência backend AAL2 cobre privilégios administrativos, não todas as consultas pessoais de usuário comum com MFA opcional.

**CAPTCHA.** Auth envia captchaToken em login, signup e recuperação. Turnstile trata expiração, timeout e falha de carregamento, descartando Promise rejeitada para permitir retry. recruitment-submit valida auth.getUser, reserva quota persistente antes de Siteverify, limita payload, valida hostname/action e usa prova curta, vinculada e de consumo atômico. Chamada direta ao antigo esports_submit sem ticket não contorna a defesa. service_role apenas emite ticket após verificação; submissão usa JWT do usuário. Configuração de chaves/segredo e Auth CAPTCHA continua externa.

**Banco e privilégios.** RLS adicional em private; revogação de EXECUTE herdado e grants diretos, preservando team_member e três validadores necessários. Papéis, cargos esports e planos continuam separados. Nenhum usuário recebe privilégios por editar estado no browser. Não foram alteradas migrations 001–028.

**Edge, Storage e IA.** boundedText impõe limite por bytes reais de stream antes de acumulação completa, rejeita UTF-8 inválido/excesso e cancela leitura. Resposta do provedor limitada a 40.000 bytes; DELETE mídia limitado a 1 KiB antes de parse. Autorização, PNG de 3 MiB, URLs temporárias, quotas e limites de upload existentes preservados. Gateway Knowledge explicitado com validação própria de usuário. Mantidos grounding, tratamento de conhecimento como dado não confiável, ausência de ferramentas administrativas, quotas, entrada limitada, max_output_tokens, timeout e store:false. Isso reduz riscos de injection e consumo, sem prometer prevenção absoluta.

**Privacidade.** Logout e troca de conta limpam dados locais pessoais; geração invalida gravações atrasadas do TrainingBuilder. Aceite de termos/privacy possui versões exatas e timestamp servidor, leitura própria, escrita via RPC controlado, exportação e cascade de exclusão. Onboarding exige confirmação; links apontam aos documentos existentes. Versão prelaunch não substitui revisão jurídica nem consentimento parental e não força novo aceite de usuários já onboarded.

**Operação sensível.** Exclusão de conta usa Auth.getUser, claims criptograficamente verificadas, sub compatível e AMR da sessão para autenticação recente. Refresh e MFA isolado não fingem login primário recente. Admin requer AAL2. Não foi executada exclusão em serviço real.

**Frontend/CSP.** Foram mantidas validações/URLs e renderização React existentes; QR usa img, sem inserir HTML arbitrário. CSP permite integrações específicas de Turnstile, mídia Supabase e vídeo sem cookies. Não foi adicionado script genérico para IA/LivePix. HSTS não foi ativado sem hospedagem/TLS verificados.

**Supply chain.** Actions fixadas por SHA integral, token read-only, sem workflow de deploy. Dependabot preparado, npm ci --ignore-scripts, scan de padrões de segredos, manifesto de migrations e catálogo de banco no CI. Comando lint faz TypeScript e checks de segurança; não se declara ESLint instalado. Cinco geradores de seed agora emitem SQL em stdout e nunca sobrescrevem migrations antigas. O teste verifica a integridade de todos os 28 arquivos após executar os geradores.

**Pagamentos futuros.** billing.ts oferece contratos puros de estado, associação, preço/moeda, idempotência, ordenação, cancelamento, reembolso, expiração e OAuth state; 12 cenários simulados. Refund vence paid no mesmo timestamp. Não há adaptador LivePix, webhook público, ledger persistente ou plano ativo. O desenho de integração está em PROMPT20_PAYMENTS.md e é preparação conforme o Prompt 20, não alegação de comércio implementado.

## Migration 029 e compatibilidade

Única migration nova: `supabase/migrations/202610110029_security_hardening.sql`. Contém transação, helpers AAL2, ajustes assertivos de funções existentes, grants/RLS, quota/tickets CAPTCHA, wrapper de submissão e account_acceptances/trigger de onboarding. Dados anteriores são preservados. Aplicação sem o catálogo esperado aborta; não há DROP de dados nem down migration destrutiva.

A numeração 029 atende à sequência solicitada. A tentativa de consultar o CLI Supabase encontrou limitação de escrita fora do workspace em .supabase; o arquivo foi preparado manualmente e aplicado somente em PGlite. Não se afirma geração bem-sucedida pelo CLI nem aplicação remota. Migrations 001–028 conferidas com os blobs do checkpoint e manifesto SHA-256; .gitattributes fixa SQL/JSON em LF para evitar falsos diffs CRLF. Reversão operacional deve ser correção incremental após revisão; retirar AAL2 não é rollback aceitável.

## Testes e resultados reais

| Verificação | Resultado e limite |
|---|---|
| Vitest completo final | 63 arquivos, 369 testes aprovados; 68,50 s no ambiente local |
| Testes específicos de Auth CAPTCHA | 4 aprovados: login/signup/reset e ausência de token |
| Seed histórico | Geração dos cinco scripts sem alteração de nenhuma migration 001–028 |
| Catálogo PGlite | 94 tabelas, 131 políticas, 143 funções; checks estruturais aprovados |
| Build e TypeScript frontend/Edge/contratos | Aprovados; Zod emite avisos de anotação, chunk Supabase vazio é esperado sem env |
| npm audit | 0 vulnerabilidades conhecidas no resultado consultado; não prova ausência de vulnerabilidades |
| Scan estático | 377 arquivos rastreados no checkpoint de código, 28 migrations intactas, Actions imutáveis; limitado a padrões e árvore atual |
| Brand check | Aprovado |
| Production check sem env | Falha esperada: faltam VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SITE_URL e VITE_TURNSTILE_SITE_KEY |
| Playwright local | 81 cenários iniciados, avançou ao último sem falha reportada, mas não finalizou; interrompido, não contado como aprovado |
| GitHub CI 2b0f963 e 0ef7a61 | Jobs test-build e browser concluídos com success; evidência remota independente do shim Windows |
| CI da ponta final | Consultar manifesto/evidência CI da entrega; não confundir execução anterior com validação de novo SHA |

[CI 2b0f963](https://github.com/sallumm/fortnite-competitive-platform/actions/runs/38125682964), [CI 0ef7a61](https://github.com/sallumm/fortnite-competitive-platform/actions/runs/38126252108).

PGlite aplica todas as migrations em banco descartável com contas sintéticas. Testes positivos e negativos incluem isolamento entre contas, admin/staff AAL1/AAL2, prova CAPTCHA de outro usuário/ciclo/expirada/repetida, quota antes do terceiro, issuer inacessível ao usuário, falhas de provider/stream, MFA multifator, aceites falsos/versão errada/escrita direta/isolamento/cascade, sessão antiga e contrato financeiro forjado. Testes existentes de treino, academia, equipes, avaliações, IA e editorial continuam passando.

A falha MFA histórica foi reproduzida de forma equivalente, pois o arquivo perdido não existe. PostgreSQL pode filtrar um UPDATE por USING e retornar zero linhas, sem exceção. O teste agora comprova zero linhas e dado intacto em AAL1, alteração autorizada AAL2 e casos realmente rejeitados. Não foi trocada uma negativa por sucesso permissivo. Fixtures privilegiadas receberam AAL2 explícita e fixtures onboarded fizeram aceite real via RPC; as negativas foram mantidas.

Um problema local de CRLF causou falhas de igualdade de seeds e foi corrigido restaurando bytes do Git e atributos de fim de linha. A nova prova de geração detectou import TS extensionless no gerador legado; o carregamento via Vite existente resolve o módulo sem nova dependência. Essas causas e correções não foram tratadas como “teste instável” nem tiveram asserts removidos.

O sandbox Windows impediu fs.realpath.native/temporários padrão. Um shim fora do repositório ajustou apenas resolução de caminho e diretório de ferramentas; assertions e código de produto não foram alterados por ele. O CI Linux usa comandos normais sem shim. A execução local do navegador não forneceu conclusão, por isso seu avanço não foi convertido em aprovação.

## Revisão independente e fontes

O fluxo Codex Security fix-finding fez investigação independente antes das alterações e revisão estática independente depois. A investigação identificou preservação de helpers/grants e caminhos alternativos staff. A revisão posterior encontrou ausência de captchaToken no login; o payload foi corrigido e quatro testes passaram. Nenhum outro bypass concreto foi reportado nessa revisão delimitada. Isso não é scan exaustivo certificado nem pentest de produção.

Documentação primária de Supabase, Turnstile, Cloudflare, LivePix, LGPD e ECA Digital foi consultada. Referências específicas e limites dos serviços estão nos manuais. O changelog Supabase foi consultado; não há versão de banco hospedado a validar. Nenhuma claim de serviço configurado deriva apenas da documentação.

## Cobertura dos 26 itens do Prompt 20

| Itens | Entrega / condição |
|---|---|
| 1–2 auditoria/modelo | Diagnóstico preservado, inventário anterior, ameaças e matriz 49 |
| 3–4 banco/dados | Catálogo integral, migrations, RLS/grants/RPCs e testes; remoto pendente |
| 5–6 contas/cargos | MFA backend, UI, CAPTCHA, reauth e testes; SMTP/recovery remoto pendente |
| 7 Cloudflare | Pesquisa Free e runbook; nenhuma alteração real |
| 8–9 Turnstile/abuso | Integração Auth/gateway, quotas servidor e negativos; chaves/limites Auth pendentes |
| 10–12 frontend/headers/Storage | Correções locais, controles anteriores e testes; headers/Storage reais pendentes |
| 13 LivePix | Contratos executáveis e arquitetura futura; sem comércio ativo |
| 14–15 administração/avaliações | AAL2 em caminhos privilegiados, controles anteriores preservados; operação humana pendente |
| 16 IA | Isolamento/grounding/limites existentes verificados e stream corrigido; orçamento externo pendente |
| 17–18 dependências/CI | Audit, lock existente, Actions SHA, scan e checks sem deploy |
| 19 backup | Runbook banco + objetos + restore isolado; execução real pendente |
| 20–21 logs/incidentes | Auditoria existente e procedimentos/alertas propostos; operador/monitoramento pendentes |
| 22 privacidade/menores | Aceite/exportação/exclusão/isolamento; idade, contratos e revisão jurídica pendentes |
| 23–24 testes/UX | 369 testes, revisão independente, retry/multifator e regressões; E2E Auth real pendente |
| 25–26 manual/entrega | Relatórios, matriz, runbooks, checkpoints e draft PR; merge/deploy não realizados |

## Riscos residuais e conclusão delimitada

**Alta antes de ativação:** ambiente Supabase não auditado, SMTP/recovery/MFA hospedados, inexistência de backup restaurado, operação/privacidade de menores, operador/canais/contratos, moderação, licenças, monitoramento e integração comercial completa. A main não integra o produto cumulativo e não pode ser considerada versão final.

**Média:** CAPTCHA/headers/Edge reais pendentes, orçamento IA externo, paginação/truncamento e históricos amplos em esports, rotina editorial, integração persistente de pagamentos. **Baixa:** performance real, domínio/sitemap, serviço Dependabot e cobertura limitada do scan de segredos; ESLint estilístico permanece ausente. **Informativa:** RPC administrativa de leitura expira tentativas como efeito colateral.

A matriz preserva os 49 IDs e diferencia correção local, parcial, dependência externa e produto aberto. O código de hardening está preparado para revisão, mas o conjunto de requisitos externos e a conferência do manual Prompt 19 impedem declarar encerramento operacional integral ou prontidão de produção. A próxima auditoria deve seguir PROMPT20_NEXT_AUDIT.md.
