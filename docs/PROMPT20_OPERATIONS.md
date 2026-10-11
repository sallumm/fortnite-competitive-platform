# KYRVEN — operação segura após Prompt 20

Data de referência: 2026-10-11. Este é um procedimento proposto, não uma configuração executada. Não existem hospedagem, staging ou projeto Supabase, conforme confirmação do usuário. Todas as etapas remotas requerem uma missão posterior autorizada. Não executar comandos contra produção a partir deste documento sem identificar ambiente, responsável e plano de recuperação.

## Responsáveis e gates

O titular adulto autorizado deve identificar operador/controlador, responsável técnico, contato de privacidade, responsável por incidentes, responsável editorial e avaliadores. Registrar nome funcional/canal em documento privado, não no repositório público. Manter cadastro público, recrutamento, menores, comércio e IA com cobrança fechados até revisão dos respectivos gates. Não preencher a matriz com “concluído” apenas porque uma variável foi criada.

O manual separado do Prompt 19 não foi encontrado. Os documentos KYRVEN_HANDOFF.md, PRODUCTION-READINESS.md e esports/MANUAL_SETUP.md foram considerados, mas não substituem a conferência do manual ausente. Antes da integração, confrontar esse manual com este procedimento e resolver divergências.

## Ambiente e migration 029

1. Em missão autorizada, criar ambiente isolado com usuários sintéticos e Postgres/Supabase suportados. Registrar projeto/ref e versão do banco sem publicar credenciais.
2. Comparar histórico aplicado com migrations 001–028 e manifesto scripts/migrations-001-028.sha256.json. Não executar seeds históricos novamente. Os geradores agora emitem SQL para revisão; novas mudanças editoriais exigem migration incremental.
3. Executar o catálogo local: `node scripts/security-database-inventory.mjs`. O resultado esperado atual é 94 tabelas com RLS, 131 políticas e 143 funções; todas as SECURITY DEFINER têm search_path vazio. Isso não comprova a lógica de cada política nem replica Auth/Storage hospedados.
4. Revisar 202610110029_security_hardening.sql antes de aplicar com fluxo de migrations em staging. Ela é transacional, preserva dados e assertivamente procura as assinaturas/corpos esperados das RPCs antigas. Divergência deve abortar a implantação; não remover a assertiva para prosseguir.
5. Confirmar schema private fora dos schemas expostos da Data API. Não ampliar grants. Verificar os auxiliares private permitidos apenas quando exigidos pelas políticas/constraints.
6. Reexecutar cenários anon, conta A/B, admin AAL1/AAL2, staff AAL1/AAL2 e claims ausentes. Consultar também REST/RPC reais; não simular AAL2 com user_metadata.
7. Sem rollback destrutivo automático: conservar serviço fechado diante de falha, investigar e preparar correção incremental. A exclusão da migration aplicada ou restauração sobre produção não é procedimento de rollback aceitável.

## Auth, MFA, SMTP e sessões

No painel Auth, configurar URL canônica e redirects exatos por ambiente; sem curingas amplos. Habilitar confirmação de email, SMTP próprio autorizado e CAPTCHA Turnstile. Configurar limites de autenticação compatíveis com o plano; testar cadastro/login/reset com token ausente, inválido, expirado e válido. Mensagem de recuperação deve permanecer genérica. Confirmar os limites e respostas reais do provedor antes de abrir cadastro. O código transmite captchaToken; somente a configuração de servidor torna a verificação Auth obrigatória. [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)

Administração exige TOTP verificado e sessão AAL2 no banco. Provisionar o primeiro papel por operador confiável usando identificador de conta conferido; nunca por campo editável pelo navegador. O caminho /security permite enrollment antes de obter acesso privilegiado. Cadastrar segundo fator quando suportado e guardar material de recuperação offline protegido. Não colocar QR/semente TOTP em ticket, log ou Git. Testar retirada de fator, refresh, nova sessão AAL1 e rejeição do acesso administrativo. A proteção backend de AAL2 aqui é para papéis privilegiados; MFA opcional de usuário comum não cria política global AAL2 para todos os dados pessoais. [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa)

Exclusão requer confirmação explícita, autenticação recente (15 minutos) derivada de AMR validada e AAL2 para conta privilegiada. Refresh não conta como reautenticação. Testar conta com sessão antiga em outro dispositivo: um login recente diferente não deve tornar a sessão antiga recente. Logout limpa rascunhos locais e invalida escritores atrasados; verificar revogação no Auth hospedado, inclusive alcance global e duração restante de access tokens. [Campos JWT](https://supabase.com/docs/guides/auth/jwt-fields)

Recuperação administrativa: conter acesso, comprovar identidade por canal previamente estabelecido, revisar audit trail e fatores, revogar sessões com titular autorizado, reenrolar fator e exigir nova AAL2. Não “resolver” perda do fator removendo a exigência de MFA. Notificações de alteração crítica dependem de SMTP/recursos do provedor e precisam de teste.

## Turnstile e candidatura

Criar widgets separados de staging e produção, com allowlist exata de hostnames. VITE_TURNSTILE_SITE_KEY é pública; TURNSTILE_SECRET_KEY é segredo da Edge e do provedor Auth conforme configuração. Não publicar secret no Vite. Chaves de teste só em ambiente de teste; production-check recusa chave pública de teste.

O fluxo recruitment-submit exige usuário verificado, reserva quota persistente de 10 chamadas/10 minutos por conta antes de Siteverify, limita corpo a 24.000 bytes, valida hostname e action recruitment, emite ticket de 2 minutos vinculado a usuário/ciclo e submete via JWT desse usuário. A service_role é usada apenas para emitir prova após verificação. O RPC antigo sem prova fica bloqueado. Na expiração/erro, oferecer novo desafio; não reutilizar token nem fazer loop de retries. Não enviar IP ao Siteverify neste código. [Validação Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)

Manter recruitment_enabled e gate de lançamento fechados até avaliação operacional/jurídica. Testes positivos locais abrem esses gates somente no banco descartável. Não aplicar os fixtures em ambiente real.

## Secrets, Edge Functions e Storage

Frontend: somente URL Supabase, chave anon/publishable, site URL e site key pública esperadas pelo .env.example. Chaves privilegiadas Supabase, IA, Turnstile e futuras LivePix ficam no cofre do provedor por ambiente; acesso mínimo, inventário de responsável/data/uso, rotação após suspeita e nunca em logs. Variáveis VITE_* são públicas por definição. Não colocar tokens em URLs, exemplos, screenshots ou corpos de erro.

Conferir as variáveis consumidas por cada index.ts antes do deploy autorizado. Configurar allowed origin exata; a ausência de Origin em clientes não browser não substitui autenticação. CORS não é autorização. Gateway verify_jwt=false nas funções que verificam auth.getUser deliberadamente requer validar essa checagem em cada caminho; nunca remover auth.getUser por falha de compatibilidade. Validar respostas 401/403/413/429/503, preflight e ausência de detalhes internos.

Storage de mídia editorial continua privado, com PNG limitado a 3 MiB, validação do servidor e URLs temporárias. Testar byte real/MIME, nome, metadata, expiração, outro usuário, AAL1/AAL2 e cleanup. VOD por link não significa upload arbitrário. Backup de objetos é separado. O endpoint DELETE agora limita leitura a 1 KiB antes de parse.

## Cloudflare Free e cobertura real

A documentação consultada em 2026-10-11 oferece regras personalizadas e uma regra de rate limiting no Free; o conjunto gerenciado gratuito é limitado. Não pressupor attack score, detecção avançada de uploads, AI Security ou funcionalidades Enterprise no Free. Conferir a elegibilidade no painel antes de usar recursos. [Disponibilidade WAF](https://developers.cloudflare.com/waf/), [regras personalizadas](https://developers.cloudflare.com/waf/custom-rules/)

Após autorização específica: adicionar zona e revisar registros existentes; não substituir registros MX/TXT indiscriminadamente. Proxiar apenas o hostname de frontend elegível. Escolher HTTPS Full (strict) somente com certificado válido no origin; testar renovação e redirects. Conferir regras gerenciadas gratuitas e observar Security Events antes de bloqueios adicionais.

Proposta conservadora: restringir métodos inesperados apenas em rotas comprovadamente estáticas; negar caminhos de segredos inexistentes como /.env; reservar regra de rate limiting para endpoint realmente proxied e demonstradamente abusado. Calibrar limiar com tráfego legítimo, manter rollback da regra e testar redes compartilhadas. Não aplicar bloqueio geográfico ou desafio indiscriminado a navegação, APIs, callbacks ou acessibilidade.

Cobertura:

| Destino | Proteção esperada |
|---|---|
| Hostname proxied do frontend | CDN/TLS/DDoS/WAF conforme configuração efetiva |
| projeto.supabase.co Auth, REST, RPC, Storage, Edge | Proteções Supabase, JWT, RLS, quotas e validação próprias; não herda WAF do frontend |
| Siteverify, IA e futura API LivePix | Chamadas servidor, timeouts, limites e credenciais próprias |
| Assets privados e callbacks | Cache privado/sem cache adequado; nunca regra “cache everything” indiscriminada |

Não configurar proxy alternativo do backend para fingir cobertura. Bot Fight Mode, caso elegível, exige teste de integrações antes de habilitar. Logs gratuitos podem ter amostragem/retenção limitada; não os tratar como ledger completo.

## Hospedagem, CSP e domínio

Selecionar hospedagem posteriormente. public/_headers precisa ser suportado ou convertido no formato do host. Confirmar em respostas HTTP reais CSP, nosniff, Referrer-Policy, Permissions-Policy e proteção de frame. Testar imagens assinadas Supabase, vídeo youtube-nocookie e Turnstile. LivePix e IA não precisam de script no browser enquanto integração é servidor. Não liberar script-src * ou unsafe-eval para corrigir integração.

Não armazenar respostas autenticadas em cache público. Revisar service worker/CDN caso venham a ser adicionados. Confirmar HTTP→HTTPS e certificados de todos os subdomínios antes de propor HSTS gradual; preload/includeSubDomains ficam pendentes de aprovação específica. Configurar VITE_SITE_URL real antes de gerar sitemap e verificar URLs/robots/preview. `npm run check:production` deve falhar enquanto configuração obrigatória estiver ausente; esse resultado não deve ser contornado com placeholders.

## Backup e restauração

O plano Free não deve ser tratado como se oferecesse os mesmos backups gerenciados dos planos pagos. Backup do banco contém metadados de Storage, não os bytes dos objetos. [Supabase backups](https://supabase.com/docs/guides/platform/backups)

Plano proposto ao titular: exportação lógica diária do banco por ferramenta oficial compatível com a versão; exportação separada dos objetos e manifesto com hash/tamanho/chave/bucket. Proteger backups com criptografia autenticada e chave em local separado, ACL mínima e cópia fora da conta principal. Sugestão inicial sujeita a análise de necessidade: 7 diários e 4 semanais, revisão periódica de retenção e obrigações legais; não presumir prazo universal.

Antes de dados reais, restaurar em ambiente isolado autorizado e sem envio de emails/webhooks/IA. Conferir contagens, relacionamentos, grants/RLS, login sintético, objetos e hashes, links temporários e exclusão. Registrar data, duração, RPO/RTO medidos e falhas. Meta inicial proposta: RPO 24h/RTO 24h, não SLA comprovado. Nunca restaurar por cima de produção automaticamente.

## Privacidade, adolescentes e conteúdo

Perfis/treinos/históricos são pessoais; membros de equipe só acessam recursos deliberadamente compartilhados; candidaturas/respostas e notas administrativas ficam em private com RPCs por papel e atribuição; questões/gabaritos não são catálogo público. Conteúdo editorial publicado é público; rascunhos e configurações de IA são administrativos. Segredos e futuros dados financeiros não pertencem ao navegador.

A LGPD exige análise de finalidade, necessidade, direitos e base legal; o melhor interesse deve orientar tratamento de crianças/adolescentes. O ECA Digital prevê privacidade protetiva desde a concepção. Isso exige avaliação jurídica e de riscos adequada à kyrven, sem afirmar conformidade por checkbox. [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm), [ECA Digital, arts. 7–8](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm)

Registrar termos/privacy versão 2026-10-11-prelaunch é evidência técnica de aceite, não consentimento parental nem contrato final. Usuários já onboarded não recebem reaceite automático. Definir procedimento de nova versão antes de lançamento. Manter coleta mínima e não adicionar documento/biometria por iniciativa técnica. Autodeclaração não prova idade.

Definir canal de exportação/exclusão, verificação proporcional de identidade, prazos legais por revisão jurídica, retenção de candidaturas e expiração das autorizações; testar a rotina já prevista antes de agendar purgas. Mudança de aba da prova não é prova de fraude. Revisão humana de avaliações e recursos é obrigatória operacionalmente. Definir moderação, denúncias e escalonamento para riscos de menores; revisar licenças comerciais de marcas e mídias. Nada disso está operacionalmente certificado.

## Monitoramento, IA e incidentes

Usar primeiro audit trail SQL existente, logs do provedor e CI. Propor revisão diária inicial de falhas Auth, 401/403/429/5xx, latência Edge, quota IA, publicação administrativa, mudanças de papel e backup. Não logar prompt completo, resposta privada, token, senha, semente TOTP ou payload financeiro. Preferir timestamp, correlation id aleatório, rota, status, duração e contador agregado. Nenhum coletor de IP foi adicionado; coleta futura exige finalidade/retenção/transparência.

Alertas propostos, a calibrar em staging: aumento sustentado de 5xx/429, orçamento IA perto do teto, backup ausente por 24h, mudança privilegiada inesperada, webhook em retry persistente. Responsável e canal de plantão precisam existir; nenhuma notificação real está configurada. IA mantém limites de entrada/saída/tempo, quotas e grounding; agora limita stream antes de alocação. Orçamento do provedor e alerta de gasto são controles distintos da quota SQL. Conteúdo recuperado continua dado não confiável, sem ferramentas para alterar registros; publicação administrativa exige confirmação.

Incidente: identificar escopo com evidência mínima preservada; conter funcionalidade afetada mantendo dados; revogar/rotacionar credencial comprometida por operador autorizado; revisar sessões/papéis e audit trail; corrigir e validar em ambiente isolado; recuperar por procedimento aprovado; registrar cronologia, impacto, causa e ações. Comunicação a titulares/autoridades deve ser avaliada pelo responsável jurídico segundo fatos e regras vigentes, sem prazo inventado neste runbook. Não apagar logs/dados ou restaurar banco automaticamente. Em falha de pagamentos, suspender nova concessão até reconciliação, preservando direitos contratuais existentes.

## GitHub e próxima liberação

Manter PR draft e sem merge. Titular deve habilitar proteção da branch correta, revisão obrigatória, checks test-build/browser, MFA da conta, alertas de dependências e secret scanning quando disponíveis. Dependabot no branch de trabalho não comprova ativação no branch padrão. CI usa token read-only, Actions por SHA, npm ci --ignore-scripts, audit, tipos/build, testes e scan de padrões. Não há workflow de deploy. Não executar pull_request_target com código não confiável e secrets.

Uma liberação futura exige auditoria independente, manual Prompt 19 confrontado, backup restaurável, evidência hospedada de Auth/MFA/RLS/Storage/CAPTCHA/headers e aceite do titular para os riscos. Nenhum sucesso local autoriza abrir recrutamento, comércio ou produção.
