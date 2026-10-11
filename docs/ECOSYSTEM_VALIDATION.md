# Validação e preparação · ecossistema kyrven

## Cobertura executável

Novos testes: `development.test.ts`, `ecosystem-database.test.ts`, `learning-lifecycle.test.tsx`, `navigation.test.ts` e `e2e/ecosystem.spec.ts`; ampliação de `auth-adapter.test.tsx`, `export-data.test.ts` e adequação da contagem por modalidade em `academy-study.spec.ts`/catálogo verificado em `intelligence.test.ts`.

- Integração por IDs, versões, prazos, modalidade, objetivos, falta de resultados comparáveis e rejeição de contexto de outra conta.
- Postgres local: migrations 001–024, RLS, dois proprietários, anônimo, escrita editorial negada, estudo → rotina → agenda → sessão → resultado → relatório, XP duplicado rejeitado e snapshots preservados.
- Corridas de carregamento, resposta antiga após troca de conta/logout, intenção privada versus redirecionamento inseguro, catálogo com 1.001 linhas e filtros de proprietário.
- Navegador real: onboarding em demonstração, aula, biblioteca, rascunho sem escrita automática, salvamento, agenda confirmada, pausa/reload, conclusão manual, histórico/relatório, tema claro, WCAG axe e ausência de overflow. Zero Build preserva intenção e rejeita exercício incompatível; conteúdo avançado permanece livre.
- Suíte anterior continua cobrindo Coach, Knowledge, meta, equipes, administração, calendário, recorrência, editor, relatórios, exportação e exclusão local.

Os testes de navegador usam a demonstração identificada, não criam contas falsas nem simulam uma resposta generativa em produção. Os testes de adaptador usam mocks somente no runner. O navegador usa Chromium real; screenshots são evidências do runner, não renders criados por IA. O axe encontrou contraste insuficiente em badges claros; o token foi corrigido e a verificação repetida.

## Checklist de staging e publicação futura

Não publicar nesta etapa. Antes de considerar publicação:

- [ ] Integrar PRs empilhadas em ordem; conferir conflitos sem descartar migrations ou dados.
- [ ] Backup testado e migrations 001–024 aplicadas no projeto Supabase correto.
- [ ] Duas contas reais: Auth, recuperação, callbacks/redirects, logout, isolamento RLS e sessão expirada.
- [ ] Papéis administrativos sem escalada de privilégio; publicação/revisão e permissões de mídia/storage reais.
- [ ] Convites de dupla/trio com aceite e revogação; nenhum acesso privado sem consentimento.
- [ ] Criar/editar/repetir/agendar/executar/retomar treino e comparar registros no Supabase hospedado.
- [ ] Exportar e excluir conta, estudo, Road, equipes e históricos no ambiente hospedado.
- [ ] Configurar apenas variáveis públicas permitidas no frontend; segredos de provider/service role no servidor.
- [ ] Configurar provider somente com consentimento/custos/quotas e testar falha, limites e confirmação de ações.
- [ ] Verificar fontes atuais, regulamentos, validade e horários; arquivar o que venceu, sem fabricar atualizações.
- [ ] Definir domínio/VITE_SITE_URL, sitemap e pré-renderização editorial opcional; validar Cloudflare fallback/headers.
- [ ] Políticas legais, proteção de adolescentes, comunidade, contato de suporte e direitos de mídia revisados.
- [ ] Monitoramento de erros com dados mínimos, alertas de custos e recuperação de backup.
- [ ] Medir desempenho/Lighthouse em staging e dispositivos reais; não há resultado Lighthouse declarado.

Nenhum item desta lista foi marcado como concluído por mera presença de código. Consulte também `PRODUCTION-READINESS.md`, que conserva o relatório histórico da etapa anterior.

## Resultados locais registrados

- `npm test`: **299 testes / 50 arquivos aprovados** (suite cumulativa, incluindo Postgres local).
- `npm run build`: aprovado; TypeScript, frontend e funções verificados. Bundle de entrada: aproximadamente **420,09 kB / 131,16 kB gzip**; gráficos continuam em chunk separado. Não é uma medição Lighthouse.
- `npm audit --json`: **0 vulnerabilidades conhecidas**; não constitui garantia de segurança completa.
- Novos cenários de ecossistema: **6/6 aprovados** em desktop, tablet e mobile, com axe e recarga.
- Primeira execução completa: **71/72 aprovados**. O teste offline desktop detectou requisições HMR do Vite enquanto o código era editado e a rede estava desligada. Não foi removida a asserção de console/rede; a suíte foi repetida com código estável. O resultado final e os jobs de CI são registrados no Pull Request desta entrega.
- `npm run check:production`: bloqueou corretamente por ausência de `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_SITE_URL`. Nenhum segredo ou serviço hospedado foi configurado para contornar o bloqueio.
- Sitemap não gerado sem URL pública; pré-renderização editorial opcional desativada neste ambiente.

Capturas de Dashboard claro em desktop e mobile foram inspecionadas; os testes também exercitam tablet, tema escuro e movimento reduzido. Isto não equivale a testes manuais de todas as páginas em cada combinação de dispositivo e tema.

O primeiro CI de PR também revelou dois timeouts de navegação em `performance-ui.test.tsx` (espera padrão de 1 segundo por rotas lazy), enquanto o CI de push do mesmo commit aprovou os 299 testes. A espera desta suíte DOM passou a 5 segundos, limitada e orientada à condição real, sem sleeps, remoção de asserções ou retries. A verificação final é feita no commit atualizado.
