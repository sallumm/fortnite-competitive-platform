# Evidências de validação do incremento editorial

Verificações locais em 10/10/2026, branch `feat/meta-content-management`. O relógio apresentado pelo executor Vitest difere do horário UTC do ambiente; não é usado para deduzir datas de pesquisa.

## Cobertura adicionada

- `tests/meta-editorial-database.test.ts`: migration cumulativa em PostgreSQL/PGlite; temporadas/modos/versões/contextos persistentes; rascunhos privados; papel admin; revisão obrigatória; publicação e retirada; restauração; cadeia imutável; fontes obrigatórias; links públicos e compatibilidade; rollback integral; conflito de rascunho/publicação; quotas; reserva de remoção; auditoria real de mídia. Fixture de Storage inclui uma policy legada ampla para comprovar as restrições do bucket Meta.
- `tests/meta-media.test.ts`: handler HTTP, arquivos PNG reais gerados no teste, CRC/chunks, SVG/corpo executável, limites com Content-Length ausente, origem, autenticação, quota, upload seguro, falha de metadata, remoção referenciada, URLs/provedores e schema estruturado.
- `tests/meta-editorial-ui.test.tsx`: formulário, texto com marcação exibida sem execução, prévia, revisão, confirmação explícita, publicação/retirada, recuperação de rascunho no remount e bloqueio de conta comum. Serviços simulados **somente no teste**; esse cenário não prova persistência remota.
- `e2e/meta-content.spec.ts`: Chrome em desktop/tablet/mobile; detalhes públicos, fontes/treino, filtros combinados, isolamento Zero Build, combinação de trio sem dados, histórico, ausência de overflow, axe A/AA grave/crítico e redirecionamento administrativo sem sessão.

## Resultados

A suíte local teve **203 testes aprovados em 33 arquivos** e build de produção aprovado. Resultados do CI são registrados no PR. A execução local da suíte de navegador teve **42 cenários aprovados (2,7 minutos)**. Testes abrangem também as funcionalidades anteriores. `npm run build` inclui TypeScript frontend e Edge Functions. `npm audit --audit-level=high` encontrou **zero vulnerabilidades**; isso não certifica segurança total da aplicação.

Não foram executados uploads no Supabase real, autenticação/admin remotos, teste de concorrência com duas conexões PostgreSQL reais ou validação de licenças particulares. As operações de banco foram executadas com roles distintas, em PGlite, e o HTTP/Storage real deve ser validado com a checklist de staging em `CONTENT_MANAGEMENT.md`.

Sem Lighthouse inventado. Capturas reais e inspeção visual do Meta foram realizadas no navegador; a interface administrativa foi exercitada em testes React, sem alegação de acesso remoto administrativo.
