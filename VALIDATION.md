# Validação realizada — 10/10/2026

## Resultados executados

| Verificação | Resultado | Limite |
| --- | --- | --- |
| `npm test` / Vitest | 20 testes passaram em 4 arquivos | Execução local, não substitui homologação hospedada |
| GitHub Actions | Testes e build aprovados no commit `10a4b8f` | [Execução](https://github.com/sallumm/fortnite-competitive-platform/actions/runs/38021456684); sem serviços hospedados configurados |
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

## Não executado

- Inspeção visual em desktop e mobile, screenshots e testes de navegadores reais: não havia ferramenta de controle de navegador disponível para QA neste ambiente.
- Auditoria WCAG 2.2 AA, contraste integral, leitores de tela ou Lighthouse/Core Web Vitals. Sem nota de desempenho inventada.
- Cadastro/login/e-mail/recuperação contra Supabase hospedado ou execução da função de exclusão no serviço real.
- Publicação no Cloudflare, análise de headers em uma URL real, domínio ou DNS.
- Revisão jurídica completa de LGPD, marcas, monetização e políticas Epic.

O MVP foi validado no nível de código, DOM e banco local, e precisa de configuração e homologação antes de operação pública.
