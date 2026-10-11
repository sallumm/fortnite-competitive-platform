# Prompt 20 — inventário anterior à implementação

Registro: 2026-10-11. Branch `feat/security-hardening-reconstruction`, baseada em `eca9630d7f4c4a45a1b08f7331577ab1da39e427`. Fetch e listagem GitHub confirmaram novamente essa ponta cumulativa; main continua anterior. Nenhum merge/deploy autorizado.

Entradas: especificação integral KYRVEN_PROMPT20_ORIGINAL.md, diagnóstico de recuperação, auditoria 21.1 com 49 IDs, documentação cumulativa. O manual separado denominado Prompt 19 não foi encontrado no ZIP ou repositório; usam-se KYRVEN_HANDOFF.md, PRODUCTION-READINESS.md, esports/MANUAL_SETUP.md e PROMPT18_REPORT.md como evidência operacional preservada, sem afirmar equivalência com documento ausente.

## Fronteiras e correções planejadas

| Bloco | Inventário e critério verificável | Achados 21.1 |
|---|---|---|
| Autorização | Exigir AAL2 nos privilégios administrativos do banco, RPCs e Edge; preservar papéis pessoais e validação de outros usuários; enrollment/challenge acessível antes do privilégio | 004,011,034–036 |
| Banco | Migration incremental 029; RLS em private como defesa adicional; menor privilégio de funções sem quebrar constraints/team_member; testes CRUD entre contas e papel/claim ausente | 015,016 |
| CAPTCHA | Widget recuperável, Auth captchaToken, gateway de candidatura com Siteverify no servidor; quota antes de chamada externa e prova curta, atômica, vinculada ao usuário/ciclo; fechar RPC direto | 005,018,037 |
| Edge/IA | Limites de stream para resposta do provedor e DELETE mídia, tratamento de erros; configuração explícita knowledge; preservar consentimentos e grounding existentes | 017,019,020,048 |
| Privacidade | Limpar rascunhos em logout/troca de conta; registrar versões de aceite no servidor; exportação/exclusão dos novos registros; manter recrutamento e menores bloqueados até revisão | 008,009,021,038,047 |
| Frontend | CSP compatível com imagens privadas assinadas, vídeo autorizado e Turnstile; MFA acessível; ausência de HSTS prematuro | 012–014,035 |
| Pagamentos futuros | Contrato servidor, estados simulados idempotentes, reembolso no mesmo timestamp, expiração, reconciliação e associação confiável; nenhuma ativação ou API real | 025,026 |
| Operação/CI | Actions fixadas, atualizações automatizadas, verificação de segredos, validações e documentação sem deploy; preservar migrations e seeds | 030–033,045,046 |
| Entrega | Runbooks Cloudflare/Supabase/SMTP/backup/restauração/incidentes/privacidade, matriz 49, testes e limitações, draft PR | 001–003,006–010,028–029,031,043–044,049 |

## Modelo de ameaças e compatibilidade

Atacantes: usuário anônimo, conta autenticada maliciosa, primeira etapa de conta administrativa comprometida, conteúdo recuperado não confiável, eventos financeiros forjados/duplicados e erro operacional. Ativos: identidade, dados pessoais de treino, candidaturas/provas/gabaritos, concessões comerciais, segredos, disponibilidade e histórico auditável. Prioridade: autorização no banco/servidor e redução de consumo antes de terceiros. UI nunca estabelece permissão.

Preservar isolamento de contas, políticas de conteúdos publicados, papéis esports separados de planos, validação de equipe/constraints, onboarding, modo demonstração e migrations 001–028 byte a byte. Não preencher achados de produto (roster profissional, conteúdo/editorial, paginação global) com correções especulativas: classificar escopo e risco explicitamente.

## Verificação e checkpoints

Reproduzir controles ausentes com testes locais. O arquivo original do teste MFA perdido não existe: reconstruir a condição equivalente e distinguir UPDATE RLS com zero linhas de violação WITH CHECK. Provar estado inalterado e controle AAL2 positivo, sem simplesmente esperar exceção.

Executar testes unitários/PGlite, tipos/build, audit, verificação de segredos e navegador quando disponível. PGlite não equivale ao Supabase Auth/Storage/Edge hospedado. Cada bloco validado recebe commit e push. Revisão independente de fronteira antes do patch e revisão de bypass/regressão depois, conforme skill fix-finding.

Hospedagem, staging e projeto Supabase não existem, confirmado pelo usuário. Não há permissão para criá-los, aplicar migrations remotas, configurar DNS/Cloudflare, ativar recrutamento/pagamentos ou usar dados pessoais reais. Configurações e testes externos permanecem pendentes e impedem declaração de prontidão de produção.
