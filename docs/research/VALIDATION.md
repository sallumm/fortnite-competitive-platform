# Evidências de validação — pesquisa de treinamento

Executadas em 10/10/2026, sobre a implementação deste PR. Nenhum resultado de Lighthouse, teste dentro do Fortnite ou homologação remota é declarado.

| Verificação | Resultado observado |
| --- | --- |
| `npm test` | **169 testes passaram em 26 arquivos**; 14 novos testes de corpus, validação, UI editorial e PostgreSQL |
| `npm run build` | **Passou**: TypeScript frontend e Coach, Vite de produção |
| `npm audit --audit-level=high` | **0 vulnerabilidades reportadas**; não equivale a auditoria de segurança completa |
| `node scripts/research-seed.mjs --check` | **Passou**: migration e índice mínimo correspondem ao corpus |
| `git diff --check` | **Passou** |
| Playwright / Chromium real | **33 cenários verificados**, distribuídos em desktop 1366×900, tablet 768×1024 e perfil Pixel 7 |
| Smoke de produção via Vite preview | Desktop e mobile: pesquisa → filtro → biblioteca → detalhe; sem pageerror, respostas HTTP ≥400 ou overflow horizontal |

A execução local principal do navegador completou 31 cenários antes de o runner ser interrompido durante o trabalho de configuração. Os dois restantes (Training Maxing e Research no perfil mobile) foram reexecutados isoladamente e passaram, em 21,2 segundos. Não se apresenta esse agregado como uma única execução ininterrupta. O CI do PR oferece uma execução nova da suíte inteira.

Comandos de navegador:

```bash
PLAYWRIGHT_EXECUTABLE_PATH=/tmp/chromium npm run test:e2e -- --workers=1 --output=/tmp/clutch-research-e2e
PLAYWRIGHT_EXECUTABLE_PATH=/tmp/chromium npm run test:e2e -- e2e/training-maxing.spec.ts e2e/training-research.spec.ts --project=mobile --workers=1 --output=/tmp/clutch-research-mobile-final
```

O smoke adicional executou `vite preview` e Playwright no mesmo processo supervisor, necessário porque cada chamada do executor tem rede local isolada. Uma tentativa inicial em chamadas separadas recebeu conexão recusada; não era um erro de carregamento da aplicação. Na execução correta, os dois tamanhos passaram.

## Novas verificações

- IDs e protocolos anteriores preservados; todas as extensões de pesquisa passam no schema.
- Filtros sem dependência de acentos; Construção Zero exclui competências de construção.
- Referências inexistentes/inacessíveis, IDs duplicados, modalidade incompatível, campos extras, datas inválidas e retirada sem despublicação são rejeitados.
- Conteúdo vencido ou legado sem contexto aparece como pendente.
- Trilhas não omitem silenciosamente exercícios ausentes/despublicados.
- Recuperação futura retorna somente dados públicos delimitados, sem instruções executáveis ou contexto privado.
- Papéis anon/authenticated não escrevem no corpus; jogador comum não altera a revisão; administrador grava e gera auditoria real.
- Migration preserva procedimento editado anteriormente, sem atribuir revisão indevida.
- Formulário editorial impede publicar exercício retirado e permite salvar após despublicar.
- Navegador percorre glossário, filtro, fontes e trilha; nenhuma rotina existe antes da confirmação; salvar e recarregar preserva etapas e duração.
- Axe no conteúdo principal da metodologia não encontrou violações no escopo executado. Suíte anterior mantém verificações de temas, teclado, movimento reduzido, administração restrita e fluxos de treino/relatório.

Capturas reais da metodologia em desktop/tablet e do detalhe em mobile foram inspecionadas. O navegador é emulado em resoluções/perfis; não são testes em aparelhos físicos. A cobertura automatizada não substitui avaliação completa com leitor de tela ou usabilidade com jogadores.

## Bundle e limites de ambiente

Corpus completo em chunk separado: aproximadamente **40,18 kB / 11,70 kB gzip**. Chunk principal: **414,33 kB / 129,51 kB gzip**; validação compartilhada: **88,90 kB / 25,37 kB gzip**. Esses valores são tamanhos de arquivos do build, não tempos de carregamento ou pontuação de performance. A divisão de Zod permite cache separado, sem reduzir por si só o total de bytes necessários.

O build foi executado sem configuração real de Supabase e domínio. Sitemap foi omitido por ausência de `VITE_SITE_URL`; pré-renderização editorial opcional estava desligada. Permanecem avisos de anotações de dependência Zod e chunk Supabase vazio nesse modo sem configuração. Não há nova dependência.

Banco: PGlite com migrations reais e papéis simulados, sem alteração de Supabase remoto. Histórico, isolamento, sessão, XP e outras garantias existentes continuam cobertos pela suíte anterior. Cadastro/login remoto, SMTP, Edge Functions, regras operacionais e publicação precisam do checklist em [IMPLEMENTATION.md](IMPLEMENTATION.md).
