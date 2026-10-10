# Validação funcional 2.0

Execute os comandos no projeto da branch `feat/personal-performance-2`. O ZIP antigo do MVP não contém estas mudanças.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run dev
```

Execute um comando por vez. Abra o endereço indicado pelo Vite e mantenha o terminal aberto. `npm.cmd` evita o bloqueio de `npm.ps1` no PowerShell sem mudar a política de execução.

## Roteiro para navegador

1. Abra “Explorar demonstração”; conclua o onboarding se necessário. Em “Meu Dia”, confira objetivo, nome, data/fuso e ausência de estatísticas fictícias.
2. Em “Planejador”, abra “Organizar minha semana”. Escolha focos, dias, horário e duração, gere a proposta e confira as explicações. Crie o plano; ajuste seus exercícios/minutos no editor existente.
3. Use “Agendar”, marque repetição semanal e escolha os dias. Confira que existe uma série e que mudar mês/semana/dia mostra as ocorrências adequadas. A persistência contém uma regra, não dezenas de eventos futuros.
4. Edite uma ocorrência. Altere título/horário; confirme que as seguintes mantêm a regra. Edite a série a partir de uma data posterior e confira o histórico anterior. Exceções/execuções futuras impedem uma revisão silenciosa; use edição individual.
5. Crie um compromisso pessoal no mesmo horário: confira o aviso de conflito e a confirmação explícita. Teste cancelamento, exclusão e marcação de compromisso concluído.
6. Inicie o treino por sua atividade agendada, conclua etapas e registre resultados com uma configuração identificada. Marque “Abrir diário opcional após concluir” e preencha só o que desejar. Confira vínculo no calendário, histórico e XP. Uma atividade concluída não inicia outra execução; uma interrupção permite tentar novamente.
7. Registre duas medições do mesmo exercício com a mesma métrica/configuração e uma terceira com outra configuração. Confira grupos separados em “Minha evolução”. Registros antigos sem configuração permanecem no histórico e não geram comparação automática.
8. Em “Minhas Habilidades”, salve um objetivo e uma avaliação qualitativa; confira histórico, exercícios relacionados e observações. No Zero Build, construção/edição/piece control estão indisponíveis como focos específicos.
9. Em “Minha Semana”, gere o resumo, consulte uma semana anterior, atualize e exporte TXT. Compare dados atuais com o snapshot salvo; a semana atual é parcial. Confirme ausência de inferência de melhora quando faltam duas medições compatíveis.
10. Recarregue a demonstração; confira persistência. Saia dela e confirme a separação das contas reais. Teste modo claro, teclado, zoom 200% e largura mobile; finalize QA visual antes de publicar.

## Limitações técnicas e operacionais

- Recorrência semanal por weekdays, sem recorrências mensais ou sincronização bidirecional externa. O ICS exporta somente o período visível; campeonatos também mantêm sua exportação própria na página pública.
- Regras são avaliadas em horários locais por fuso IANA. Gaps são omitidos/rejeitados e horários repetidos usam a primeira ocorrência; confirme essa política quando testar um fuso com DST. Bases IANA de runtime/provedor podem divergir após mudanças legislativas.
- Histórico de programação não é um log de auditoria de todas as edições. Sessões e diários permanecem após exclusão de plano/série; a programação removida deixa de compor relatórios recalculados. Snapshots semanais salvos continuam disponíveis.
- Relatórios são calculados por regras no cliente com os registros privados carregados. Não há execução de jobs em segundo plano ou IA generativa. A atualização do resumo salvo é explícita.
- Habilidades estão relacionadas ao catálogo por categorias editoriais, com cobertura inicial reduzida. Não há score de habilidade, índice de saúde ou prova de desempenho real.
- Equivalência de configuração é uma identificação textual autodeclarada. O produto não verifica sensibilidade, arma, cenário nem condições do teste automaticamente.
- Rascunhos do timer ainda ficam nesta sessão de navegador. Dados salvos no Supabase sincronizam entre dispositivos quando conectado; Auth/PostgREST real e concorrência hospedada ainda exigem homologação.
- A gravação de preferência e plano usa operações sequenciais: uma falha ao gravar o plano pode deixar as preferências salvas. A agenda só é criada após confirmação; não se declara atomicidade desse fluxo.
- Nenhum Supabase hospedado, SMTP, Edge Function ou Cloudflare foi configurado nesta etapa. Não foi realizado QA visual com navegador real, WCAG completo ou Lighthouse.

## Migração e contas reais — etapa posterior

Mantenha as migrations 001/002 intactas. Aplique apenas `202610100003_performance.sql` para atualizar um banco já existente. A migration adiciona tabelas/campos e substitui `finish_training` preservando regras de conclusão e XP. Faça backup antes de aplicar em dados reais. As alterações foram exercitadas em PostgreSQL WASM/PGlite com dados legados e papéis separados.

Na homologação Supabase, valide duas contas: nenhuma deve ler/modificar séries, exceções, diários, habilidades, preferências ou relatórios da outra. Teste a chamada do RPC com plano/agendamento de outra conta, reenvio da conclusão, retomada após interrupção, falhas de rede e login/logout entre dispositivos. Não use chaves administrativas no frontend.
