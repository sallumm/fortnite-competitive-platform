# Avaliações e kyrven development

## Implementação local

Migrations 26–28 acrescentam banco privado de questões objetivas/discursivas, definições de prova com distribuição por categoria/dificuldade, atribuições, tentativas, seleção no servidor ordenada por MD5(seed UUID + UUID da questão), snapshots congelados e histórico de revisão humana. O seed e o algoritmo ficam disponíveis somente à revisão autorizada. O candidato não recebe gabarito, explicação de correção ou notas internas, inclusive depois do envio. Pontuação e feedback só são compartilhados após decisão do avaliador.

O prazo é conferido no servidor. Um salvamento após o prazo conclui a tentativa com as respostas previamente confirmadas, sem aceitar uma resposta atrasada. Início repetido recupera tentativa ativa; envio repetido não duplica conclusão. Escritas de respostas usam versão esperada. Exceções técnicas permitem tentativas adicionais com motivo; não removem o histórico. A administração conclui tentativas cujo prazo venceu mesmo quando o candidato não volta. Provas não monitoram foco, outras abas, programas ou atividades privadas.

`/app/esports/trials` apresenta regras e informação técnica antes do aceite, navegação, progresso, tempo, salvamento manual confirmado, recuperação de respostas do servidor, preservação em memória durante falha de conexão e confirmação de envio. Respostas não confirmadas não sobrevivem ao fechamento/recarregamento. O aviso explica essa limitação e a interface impede fechamento do diálogo com alterações pendentes. Não há mecanismo antifraude completo.

`/admin/esports/assessments` permite autoria/revisão de questões, configuração equilibrada, atribuição, exceções e revisão de respostas enviadas. Não foram criadas perguntas fictícias ou atribuídas a uma fonte oficial: o banco começa vazio. Publicação depende de conteúdo editorial verificado e fontes reais. Limite local de consulta: 500 questões e 100 tentativas recentes; paginação ampliada deverá ser preparada antes de operação de grande escala.

Bolsa exige avaliação concluída, registro prático, oferta administrativa, condições e benefícios versionados, aceite explícito e período limitado. Benefícios existentes: espaço de desenvolvimento, materiais, ferramentas de planejamento, avaliações periódicas e feedback humano apenas quando uma disponibilidade concreta é informada. Recursos Pro comerciais não existem nesta versão e são recusados pelo servidor. Os grants têm origem `scholarship`; nenhuma assinatura, cobrança ou LivePix é criada/alterada. Expiração, revogação de cargo, retirada da candidatura ou revogação da autorização pertinente impedem acesso.

`/app/esports/development` e `/admin/esports/development` incluem ofertas, aceite/recusa, prazos, metas, atividades, calendário de prazos, recursos internos associados, progresso autodeclarado, avaliações compartilhadas, notas internas separadas e próximas etapas. Links levam às ferramentas pessoais existentes; não há inserção automática na agenda. Um avaliador designado consulta somente dados do programa, sem permissão para treinos pessoais, diário, conversas com IA ou relatórios privados.

Academy Roster exige decisão administrativa expressa e liberação manual separada de requisitos/formalização, falsa por padrão. Não publica dados pessoais. Entrada no elenco profissional e anúncio público de jogadores dependem de fluxo próprio de formalização/autorização, ainda não implementado. Resultados nunca promovem automaticamente.

Exportação específica de esports inclui dados próprios compartilháveis. Solicitação de exclusão revoga acessos e aguarda execução administrativa explícita. Purga de retenção elimina candidaturas com prazo expirado sem bolsa/cargo competitivo ativo. Cascatas de exclusão da conta limpam registros e auditoria vinculada. Operação precisa agendar retenção, validar backups e definir atendimento; não há cron remoto configurado.

## Validação da etapa D

Build aprovado. 27 testes locais em três arquivos: 7 recrutamento + 14 avaliações/desenvolvimento em PostgreSQL/PGlite + 6 fluxos DOM simulados. Os testes DOM exercitam aceite, navegação, falha de conexão, preservação de rascunho, confirmação e recuperação de respostas salvas; não substituem integração Auth/Supabase em staging. Seis testes Playwright verificam páginas públicas em desktop/tablet/mobile, temas, axe e proteção das seis rotas privadas novas. Regressão completa será registrada na etapa E.

Nenhuma migration remota aplicada. Nenhuma conta, equipe ou bolsa real criada. Nenhum lançamento, pagamento ou merge.
