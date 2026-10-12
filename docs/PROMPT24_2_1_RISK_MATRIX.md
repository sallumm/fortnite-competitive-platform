# Matriz de riscos — 24.2.1

| Risco | Estado/evidência | Residual/próxima decisão |
|---|---|---|
| A242-01 | Correção local; before 1/1 para 2/2 ações; after 2/2; espera/timeout/rollback | Volume/latência hosted não medidos; aplicação não autorizada |
| A242-02 | Correção local; ambas as ordens prune/reserva, fail-closed | Nenhum job habilitado; multi-chave/isolamento diverso requer revisão |
| A242-03 | Dois sentidos e variante FK; revoke/end/extend/roster/review/goal/progress e múltiplas bolsas | Bulk purge, authorization adolescente, ciclo/assessment, exclusão física e outros isolamentos não certificados |
| A242-04 | Cinco falhas fictícias, logs/artefatos sem marcador | Atualização de Playwright ou override de config/reporter/debug exige nova revisão |
| Retirada/erasure | Idempotência, ownership/AAL1 negativos; bolsas/grants revogados | Não equivale a purge físico ou revogação imediata JWT |
| Fonte dinâmica | Drift de corpo/owner/definer/path aborta upgrade | Revalidar catálogo/ACLs antes de aplicação; MD5 não é assinatura |
| ACLs | Doze funções hosted e grants public relevantes reproduzidos | Todos os defaults e menor privilégio histórico são tarefa separada |
| Quotas/retenção | 120/60, última vaga concorrente, rollback, isolamento, cascade | Relógio e histórico pré-instalação; prazo físico de retenção pendente |
| Auth/JWT/MFA/SMTP/CAPTCHA | Pendente hosted; mocks/Chromium explicitamente locais | Autorização própria, TTL, replay, A/B e Access |
| KYR-022/039/040 / OBS23-002 | Pendências anteriores preservadas | Suite aprovada não encerra histórico por inferência |
| Backup/restauração/instalação | Não executados | Nova auditoria independente e autorização específica |
| Merge/deploy/recrutamento/comercial | Não autorizados, não ativados | Permanecem fechados |

Parecer: bloqueadores reproduzidos têm correções verificáveis no escopo local. Não declarar aptidão hospedada ou ausência universal de deadlock. Relatório de entrega associa matriz ao SHA final e à CI exata.
