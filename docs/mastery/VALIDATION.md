# Verificação e publicação

## Evidências locais

- `npm test`: 179 testes passaram em 28 arquivos. Dez novos testes cobrem conteúdo/IDs/fontes, schema, grafo, modalidade, recuperação pública limitada, RLS, rascunho/publicação, revisão auditada e integridade de dependências no servidor. PGlite aplica migrations 001–013 de forma sequencial.
- `npm run build`: passou, incluindo TypeScript frontend/Coach e build Vite. Corpus local separado: `mastery-catalog` 72,90 kB (18,36 kB gzip); chunk principal 414,84 kB (129,66 kB gzip). Não são medidas Lighthouse ou de dispositivos físicos.
- Geradores `mastery-seed.mjs --check` e `research-seed.mjs --check`: correspondência com os registros canônicos; `git diff --check` sem erros.
- Smoke do build de produção com Chromium: `/academy/curriculum` → aula de mats em desktop (1366×900) e mobile (393×851), sem erros JS, respostas HTTP ≥400 ou overflow horizontal. Capturas reais inspecionadas; não se afirma revisão de todas as combinações de temas/dispositivos.
- Playwright: cenário novo de currículo testa busca/filtro Zero Build, abertura direta do nível 5, fontes, link para exercício real, reload da aula, axe (sem violações graves/críticas em `main`), ausência de erro JS e overflow. Execução integral final registrada abaixo.

## Correções encontradas durante o trabalho

O gerador SQL foi corrigido para manter `tags` como `text[]`, conforme o banco existente. O teste de revisão usa `content_revision_history`, não uma tabela inexistente. O carregamento local passou de import dinâmico direto de JSON a módulo adaptador compatível com o navegador/Vite. O teste E2E foi limitado à região da aula para distinguir o link de atividade do item VOD Review na sidebar. Nenhuma dessas falhas ficou ignorada no resultado final.

## Limitações

Não houve uso de Supabase remoto, autenticação de contas reais, execução de migration em ambiente externo, dispositivo físico, gameplay, processamento audiovisual, homologação concorrente multiconexão ou medição Lighthouse. O CMS foi validado no banco local com papéis distintos; testes de navegador usam catálogo público local/demonstração. Conteúdo editorial é revisão manual, não monitoramento automático.

`VITE_SITE_URL` ausente: sitemap omitido; pré-renderização editorial opcional não ativada. Avisos de comentários de Zod e chunk Supabase vazio não impediram o build local. Sem configuração real, não declarar indexação ou integração remota verificadas.

## Checklist antes de disponibilizar

1. Resolver a sequência de PRs: esta branch parte de `feat/training-research`, não da main anterior. Não houve merge automático.
2. Fazer backup e aplicar 012–013 em staging após 001–011. Confirmar preservação dos artigos editados e dos registros privados.
3. Verificar um editor e duas contas de jogador: rascunho invisível, publicação visível, revisão auditada e escritas rejeitadas para jogador.
4. Verificar dependências, alteração de modalidade e publicação com duas conexões reais.
5. Revisar fontes e prazo, retirar parâmetros não confirmados, homologar aulas/atividades nas modalidades atuais.
6. Definir origem de produção e conferir sitemap/pré-renderização; testar deep links Cloudflare Pages e cache.
7. Homologar recuperação do catálogo e mensagens de falha com Supabase/configuração real antes de publicar para usuários.

Nenhum serviço pago ativado, deploy realizado ou migration remota aplicada.

## Execução integral final

`PLAYWRIGHT_EXECUTABLE_PATH=/tmp/chromium npm run test:e2e -- --workers=1 --output=/tmp/mastery-full-e2e`: **36 cenários passaram em 4,1 minutos**, numa execução completa. Desktop, tablet e mobile. Inclui os 33 cenários anteriores de planejamento/execução/recuperação/relatórios/Coach, rotinas mistas e atividades repetidas, além dos 3 novos cenários curriculares. Nenhuma falha foi omitida no resultado final.
