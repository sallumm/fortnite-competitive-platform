# Validação realizada — 10/10/2026

## Resultados executados

| Verificação | Resultado | Limite |
| --- | --- | --- |
| `npm test` / Vitest | 44 testes passaram em 7 arquivos na evolução 2.0 | Execução local, não substitui homologação hospedada |
| GitHub Actions (MVP inicial) | Testes e build aprovados no commit `10a4b8f` | [Execução](https://github.com/sallumm/fortnite-competitive-platform/actions/runs/38021456684); sem serviços hospedados configurados |
| TypeScript em modo strict | Compilação aprovada; inclui verificação de imports/parâmetros não usados | Tipos não validam comportamento dos serviços externos |
| `npm run build` | Build Vite de produção concluído | Sem variáveis de um Supabase real; saída local em `dist` |
| `npm audit --omit=dev --json` | 0 vulnerabilidades conhecidas reportadas para produção | Consulta ao registro npm, não auditoria abrangente do aplicativo |
| Configuração Cloudflare | `_redirects`, `_headers`, robots e gerador de sitemap presentes | Não houve deploy; sitemap requer `VITE_SITE_URL` real |
| Pesquisa externa | Fontes e limitações registradas em `RESEARCH.md` | Sem testes de gameplay e sem dados completos do cenário |

## Cobertura dos testes

**Lógica (6):** adaptação Zero Build e durações de templates; separação de resultados por exercício; separação por definição de métrica; ranks e revisão vencida; exportação ICS dia inteiro/UTC e escape de texto; validação dos registros iniciais e rejeição de link não HTTPS.

**PostgreSQL/PGlite (8):** migrations executadas em PostgreSQL WASM com papéis e função `auth.uid()` de teste; isolamento de leitura/escrita entre usuários; chave estrangeira de proprietário da agenda; bloqueio de dados privados a visitantes; administração fora do perfil; publicação futura e rascunhos; validação de etapas e fontes; conclusão atômica, idempotência e teto de XP; cascades de exclusão.

As políticas RLS foram exercitadas como `anon` e `authenticated`, em contas diferentes. A infraestrutura Auth real não foi emulada como garantia de segurança: o stub fornece apenas o ID autenticado às consultas. PGlite não valida PostgREST, configurações de JWT, e-mail, implantação de Edge Functions ou concorrência de clientes em produção. A transação e os bloqueios estão implementados; teste concorrente hospedado continua pendente.

**Interface/DOM (4):** landing, alternância de tema e cadastro indisponível sem backend; onboarding completo, rotina inicial, sessão concluída e histórico/XP; edição, duplicação, agendamento e exclusão de rotina; filtro por modalidade e cópia de código. Testes com Testing Library e jsdom, sem browser real.

**Adaptador de Auth simulado (2):** carregamento de perfil de conta existente antes de decidir onboarding; redirecionamento de conta sem perfil, sem exposição da administração. O teste revelou uma corrida entre a consulta pública e a hidratação da identidade; a correção faz a rota privada aguardar o usuário correto.

## Cobertura adicional 2.0

**Lógica/recorrências (13):** weekdays; manutenção de hora local ao atravessar DST; gap e horário ambíguo; exceção movida de fora do intervalo; bordas em fusos diferentes; conflitos e eventos adjacentes; ICS com limites de bytes; normalização de dados legados; grupos de configuração/métrica; vínculo explícito de aderência; estimativas antigas; diário sem inferência de melhora; planos Zero Build e duração.

**Migração PostgreSQL/PGlite (8):** atualização de banco já preenchido; RLS das seis novas entidades; regras de fuso/weekday/proprietário; sessão vinculada, configuração inválida e diário após encerramento; gaps/cancelamentos; revisão transacional da série e rollback; preferências/relatórios privados; cascades.

**Interface/DOM (3):** criar recorrência, alterar uma ocorrência, executar com vínculo e configuração, registrar diário e gerar resumo semanal; avaliação qualitativa persistida após nova montagem; compromissos com confirmação de conflito e cancelamento. Os quatro fluxos anteriores e os dois testes do adaptador Auth também passaram.

A compilação strict e o build de produção passaram após integrar a evolução 2.0. Nenhuma dependência foi acrescentada. Leia [VALIDATION-V2.md](VALIDATION-V2.md) para regras, limitações e roteiro de homologação.

## Não executado

- Inspeção visual em desktop e mobile, screenshots e testes de navegadores reais: não havia ferramenta de controle de navegador disponível para QA neste ambiente.
- Auditoria WCAG 2.2 AA, contraste integral, leitores de tela ou Lighthouse/Core Web Vitals. Sem nota de desempenho inventada.
- Cadastro/login/e-mail/recuperação contra Supabase hospedado ou execução da função de exclusão no serviço real.
- Publicação no Cloudflare, análise de headers em uma URL real, domínio ou DNS.
- Revisão jurídica completa de LGPD, marcas, monetização e políticas Epic.

O MVP foi validado no nível de código, DOM e banco local, e precisa de configuração e homologação antes de operação pública.
