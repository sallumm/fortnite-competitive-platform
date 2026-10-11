# kyrven esports — configuração e revisão antes de operar

Este roteiro registra dependências do código, não configuração executada. A Etapa E não aplica migrations a Supabase hospedado, abre recrutamento, concede bolsas reais, ativa cobrança ou publica o site. Executar a configuração concreta somente na fase manual autorizada, em staging privado com dados sintéticos e responsáveis definidos.

## 1. Banco e autenticação

- Não regenerar migrations históricas. `seed-sql.mjs` e `training-seed.mjs` não têm modo `--check` e escrevem no histórico; a presença de uma flag não os torna somente leitura. Para mastery/research/meta, usar somente o modo `--check` para validação.
- Confirmar projeto Supabase, backup recuperável e histórico remoto de migrations. Comparar 001–024 com o handoff; aplicar incrementalmente 025–028 em staging, sem reset de banco existente.
- Conferir schemas expostos pelo PostgREST: `private` não deve ser exposto. Verificar RLS, grants e assinatura de todas as RPCs na instalação real, inclusive wrappers de lifecycle da migration 028.
- Configurar Auth, URLs de callback/recuperação, SMTP e limites. Usar contas distintas de candidato, outro candidato, staff designado, staff não designado e administrador provisionado por operador autorizado. Nunca conceder admin por formulário ou cliente.
- Verificar separação de sessões, refresh, expiração, logout, onboarding, redirecionamento seguro e proteção das seis rotas privadas de esports. A demonstração não pode produzir candidaturas, tentativas ou cargos reais.
- Validar os módulos anteriores com essas contas: Academy, Skill Maxing, agenda, resultados, equipes, Coach/Knowledge, storage e exclusão de conta. Testes PGlite não reproduzem Auth, gateway, storage ou funções hospedadas.

## 2. Gates fechados e revisão operacional

`private.esports_launch_gate.reviewed`, `minors_reviewed` e `roster_reviewed` começam falsos; `public.esports_settings.recruitment_enabled` também. Os gates privados não têm RPC de liberação pelo navegador. Manter todos fechados até revisão independente das condições da operação. Não há comando de ativação neste roteiro.

Antes de qualquer seletiva, definir equipe real de atendimento/avaliação, critérios públicos, períodos, modalidade/formato, prazos, política versionada, canal oficial e responsáveis. Não inventar elenco, parceiros, títulos, patrocinadores ou disponibilidade de feedback. Staff deve ter designação específica e cargo com validade limitada; revisar revogação, retirada da candidatura e decisões de não seleção.

Revisar termos de candidatura, privacidade, consentimentos aplicáveis, proteção de adolescentes, representação/autorização, finalidade, minimização, retenção e atendimento com profissional competente. Textos existentes são preliminares e não comprovam conformidade. Faixa etária autodeclarada e referência manual de autorização não equivalem a verificação de idade/representação. Não coletar documentos pelo formulário atual nem abrir acesso de adolescentes antes de definir processo adequado.

## 3. Avaliações e banco editorial

O banco de provas começa vazio. Preparar questões originais verificadas, fontes, contexto/versão, dificuldade, peso, revisão e explicação. Não apresentar fixtures de teste como conteúdo oficial. Publicar definições somente após revisão de todas as categorias da distribuição.

Validar em staging: aceite das regras, início idempotente, seleção no servidor e snapshot, navegação por teclado, salvamento confirmado, falha/reconexão, conflito de versão, recuperação, prazo do servidor, encerramento, envio repetido e tentativa adicional justificada. Candidato e conta distinta não podem consultar banco/gabarito, seed, notas internas ou respostas de outra pessoa. Staff não designado não pode avaliar. Correção discursiva exige pontuação válida em cada questão; compartilhar resultado apenas após revisão humana.

O sistema não é uma solução antifraude completa e não monitora abas ou programas. Respostas ainda não confirmadas ficam apenas na memória e se perdem ao fechar/recarregar. Consulta administrativa limitada a 500 questões e 100 tentativas recentes; ampliar paginação antes de operações maiores.

## 4. Bolsas e desenvolvimento

Confirmar avaliação concluída, revisão prática, oferta, termos/benefícios versionados, período, disponibilidade humana e aceite explícito. Exercitar recusa, extensão, revogação, expiração e autorização pertinente. Os benefícios `scholarship` são separados de assinaturas; `pro_access` não está disponível e é recusado.

Validar metas, progresso autodeclarado, calendário de prazos, materiais internos, feedback compartilhado e notas privadas. Staff consulta o programa designado, sem acesso a treinos pessoais, diário ou conversas com IA. Links às ferramentas existentes não inserem atividades automaticamente na agenda.

Academy Roster possui gate e decisão humana; a formalização do elenco profissional e publicação de jogadores ainda não estão implementadas. Não anunciar contratação ou bolsa garantida.

## 5. Exportação, exclusão e retenção

Validar exportação por proprietário, retirada e revogação imediata de acessos, solicitação de exclusão, execução administrativa explícita e cascatas ao excluir conta. Conferir remoção de auditoria vinculada e preservação das entidades pessoais fora do domínio esports quando cabível.

Definir atendimento, prazos, política de backups e restauração, retenção, logs mínimos e execução periódica da purga autorizada. Não há cron remoto configurado; solicitação de exclusão não prova execução final. Validar efeitos em Auth/storage/functions/equipes, que não são reproduzidos integralmente por PGlite.

## 6. Configuração transversal e fases futuras

Configurar variáveis públicas existentes, domínio, origens/callbacks, headers/CSP, rotas e SEO somente quando autorizado. Segredos ficam no servidor; nenhuma service role em `VITE_*`. Provider requer orçamento, consentimento, quotas e revisão; presença de código não comprova disponibilidade real. Medir desempenho em dispositivos representativos e validar acessibilidade com teclado/leitor de tela além do axe.

LivePix não está implementado/ativado. A fase comercial futura considera mensal/trimestral/anual, titular adulto responsável, confirmação segura no servidor e liberação idempotente; contratos e suporte da API serão verificados nessa fase. Não usar bolsa ou cargo como pagamento confirmado.

Sequência pendente: revisão jurídica → Prompt 19 (configuração manual/APIs e staging) → Prompt 20 (hardening) → Prompt 21 (auditoria independente somente de leitura e plano de correções). Publicação e merges exigem autorização própria.
