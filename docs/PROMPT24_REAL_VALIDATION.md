# Prompt 24 — evidências reais ainda necessárias

Este roteiro usa SDK/HTTP reais somente depois de projeto/URL inequivocamente identificados, configuração autorizada e staging restrito. Não foi executado nesta missão: projects=[] e nenhuma URL. Não substituir JWT real por claims forjadas em ambiente hospedado. Fixtures e contas A/B exclusivamente sintéticas; endereço de e-mail do tester é informação operacional privada, fora dos logs/Git.

## Registro de evidência

Registrar SHA/artefato, ref e ambiente, versões CLI/SDK/PostgreSQL, cenário, timestamp, HTTP status/contagem/duração, resultado esperado/observado e limite. Não registrar Authorization, apikey, cookies, tokens CAPTCHA, seed/QR TOTP, URLs assinadas, senha, prompt/conteúdo privado ou payloads de contas. Redigir falhas com correlation id aleatório; preservar trace apenas após sanitização de rede/storage. Não enviar credenciais para scanners.

## Auth, duas contas e duas abas

| Cenário real | Prova positiva | Prova negativa/integridade |
|---|---|---|
| Login/cadastro fechado | Convite/conta teste autorizada, e-mail confirmado | Conta não confirmada/CAPTCHA ausente inválido expirado/repetido; sem abertura pública |
| Recovery | Link único recebido por conta teste, destino HTTPS exato | Token expirado/reutilizado, redirects fora da allowlist; mensagem genérica |
| TOTP/AAL | Enrollment e challenge com SDK, token emitido em AAL2 | Usuário comum AAL2 sem cargo, cargo+AAL1; sem privilégios por user_metadata |
| Artigos/editorial | Admin AAL2 INSERT/UPDATE/DELETE, save/publish draft | AAL1/downgrade/cargo removido; verificar linha/versão intacta, UPDATE bloqueado pode retornar zero |
| Perda/remoção de fator | Caminho de recuperação autorizado, nova AAL1 | Refresh/remover fator não mantém acesso privilegiado; perda não suspende exigência MFA |
| Logout/revogação | Local/global/remoto e expiração real | Testar vida residual de access JWT; revogação refresh não equivale a revogação instantânea de todos os access tokens |
| A→B e duas abas | Dois contexts autenticados/duas páginas mesmo storage, ordens Auth/storage | Perfil/respostas de A, rascunho, autosave 500ms e checkpoint tardio não reaparecem em B |
| Token rotation | Mesmo usuário/AAL conserva edição | Downgrade AAL2→AAL1 limpa caches privilegiados e backend recusa |
| Isolamento RLS | A lê/escreve dados de A | B não lê, altera, exporta ou conta dados de A; REST/RPC diretos e queries adversariais limitadas |
| Exclusão/export | Exportação própria completa; remoção teste com reauth recente | Sessão antiga/outro usuário/papel AAL1 bloqueados; Storage/órfãos e revogação observados |

Abrir abas reais no mesmo navegador para BroadcastChannel/storage e contexts separados para isolamento A/B. Controlar atrasos por proxy/route do próprio ensaio sem enfraquecer servidor. Capturar contadores e eventos sanitizados; não armazenar tokens no relatório. KYR-038 permanece parcial até essa prova. KYR-034 não ganha uma causa histórica apenas porque a regressão hospedada passa.

Antes de habilitar login: confirmar allowlist de testers, redirects exatos, SMTP e modo de convite, confirmação e CAPTCHA server-side. Supabase SMTP padrão é limitado a destinatários autorizados da equipe, atualmente 2 mensagens/hora e sem SLA; custom SMTP é necessário para ensaios adequados com outros testers ([documentação](https://supabase.com/docs/guides/auth/auth-smtp)). Não desabilitar confirmação/CAPTCHA para contornar limites.

## RPC, funções e armazenamento

- REST de articles e RPCs editoriais: anonimato, conta sem cargo, AAL1, AAL2 legítimo e downgrade; leitura/escrita negativas verificam estado antes/depois.
- esports_assessment_page: 51+ questões/revisões, empates e filtros, tentativa específica autorizada, designação removida, offsets inválidos. Leitura não expira prova. esports_expire_assessments: somente cargo+AAL2+perfil existente, quota, lote, concorrência e idempotência. Não abrir recrutamento em staging compartilhado para executar fixture; usar ambiente de ensaio autorizado isolado.
- recruitment-submit: token ausente, hostname/action trocados, prova vinculada a B, expiração/consumo, chamada direta ao RPC antigo/emissor e quota antes de Siteverify. Enquanto gate fechado, candidatura legítima também deve ser recusada. Fluxo positivo completo exige autorização específica de ensaio com gate isolado; não habilitar seletiva pública.
- Todas as Edge: 401/403/413/429/503, métodos/preflight, origem divergente, limites de stream, timeout e JWT real. Não gerar carga invasiva; orçamento de chamadas pequeno e pré-aprovado.
- Storage: bucket privado, usuário/cargo/AAL, upload binário/MIME permitido pelo handler, excesso de tamanho, URL assinada expirada, remoção/órfão. Não publicar objeto pessoal. Comparar policies reais com catálogo; nem todas são simuladas localmente.

## Performance e escala

KYR-022 permanece parcial: bolsas, objetivos/revisões, ciclos e comentários precisam de contratos paginados. KYR-039/040 continuam abertos. `PROMPT23_5_SCALABILITY_PHASE.md` é a especificação obrigatória: agregações server-side com fórmulas integrais, cursor composto e janelas por consumidor, exportação completa/snapshot e invalidação de sessão. Não alterar o provider apenas com LIMIT nem remover teto sem substituto. Esta missão preserva todos os cálculos e não tenta acoplar essa refatoração à hospedagem.

Etapa de escala proposta, com commits próprios: (1) fixtures >10.000 por dono e comparação com referência integral; (2) contratos de XP/métricas/cursores e RLS; (3) consumers Dashboard/Evolution/Reports/performance/calendar; (4) exportação completa; (5) admin residual; (6) índices medidos em PostgreSQL identificado. Critérios: XP/estatísticas/progressão/exportação idênticos, A/B isolados, ausência de omissões/duplicações em snapshot definido, payloads por página e late responses descartadas. Migração incremental somente se necessária; não reescrever 001–030.

Medir baseline de requisições/payload, memória e tempos em dispositivo/rede conhecidos antes de definir SLO. Lighthouse privado por operador autenticado, desktop/mobile, 3 repetições e medianas; registrar versão, CPU/rede e sem extensões. Lighthouse não certifica WCAG nem substitui Core Web Vitals de campo. LCP/INP/CLS hospedados e EXPLAIN/concorrência ainda não medidos. Não instalar coleta invasiva para obter métricas.

## SEO, acessibilidade e lançamento

Staging: noindex HTTP+HTML, robots Disallow, sem sitemap, Access em todos os endereços. Verificar visitante anônimo antes de conteúdo. Favicons/OG/metadados existem no código; canonical em runtime usa origem atual, mas não autoriza indexar staging. Não registrar propriedade staging no Search Console como produção. Domínio real, canonical público, sitemap editorial, robots e Search Console ficam dependentes da futura produção autorizada.

Repetir teclado/foco/leitor de tela, ambos os temas e axe em desktop/tablet/mobile; conferir vídeo/Turnstile e CSP no host. Os 81 testes browser locais não medem entrega TLS/headers real nem comportamento Auth hospedado.

| Modalidade | Decisão / condição |
|---|---|
| Demonstração local sintética | GO após checks locais, sem representar backend conectado |
| Fundação de staging em código | GO para revisão da PR; arquivos não são infraestrutura |
| Criação de serviços / mudanças Auth/DNS | Aguardando identificação e autorização concreta |
| Staging autenticado restrito | NO-GO até Access, banco/Auth/HTTP reais, backup/restore e ensaios acima |
| Produção pública/autenticada | NO-GO: infraestrutura e riscos operacionais/privacidade/escala ainda pendentes |
| LivePix/assinaturas/cargos comerciais | Não autorizado; contratos puros não são cobrança operante |
| Recrutamento/menores/elenco | Não autorizado; gates e avaliação humana/legal permanecem pendentes |

FREE/PRO/ELITE são planos comerciais futuros; benefícios ainda não definidos. PROSPECT/ACADEMY PLAYER têm proposta de desenvolvimento em grupo/avaliações; ROSTER de acompanhamento individualizado. Aprovação competitiva independe de pagamento. Não prometer operação disponível, SLA ou benefício comercial inexistente.
