# Inventário funcional · kyrven

Estado verificado em 11/10/2026 sobre a ponta cumulativa até PR16 e esta integração. “Implementado” indica código e persistência/contratos existentes; não significa infraestrutura externa configurada. As evidências detalhadas estão nos testes e documentos específicos de cada módulo.

| Recurso | Estado | Persistência / integração | Limite ou dependência |
| --- | --- | --- | --- |
| Landing, temas, movimento e navegação | Implementado | Preferências locais, rotas lazy, busca rápida | Inspeção automatizada não garante todos os dispositivos |
| Cadastro, login, recuperação e onboarding | Implementado; serviço externo pendente | Supabase Auth, profiles; retorno à intenção original | SMTP, callbacks e duas contas reais exigem staging |
| Meu Dia e síntese de desenvolvimento | Implementado e integrado | Estudo/Road, agenda, rotina, metas e resultados reais | Sem pontuação universal de habilidade |
| Academy e trilhas | Implementado; cobertura editorial parcial | Currículo, pré-requisitos explicativos, exercícios por ID | Estudos antigos preservados; validade explícita; acesso avançado livre |
| Estudo, notas e avaliações | Implementado | Registros versionados privados e exportação | Familiaridade/conclusão não demonstra performance |
| Road to Competitive | Implementado e integrado | Jornada/eventos, pausas, etapas, proposta confirmada e relatório | 30 dias flexíveis; sem garantia competitiva |
| Training Center e construtor | Implementado | Rotinas, etapas repetidas, personalizadas, blocos, arraste/teclado, undo | Mapa não é iniciado dentro do jogo |
| Biblioteca e pesquisa | Implementado; revisão periódica necessária | Fontes, instruções, métricas, filtros, favoritos e links Academy | Não há gameplay verificado nesta etapa |
| Skill Maxing assistido/manual | Implementado e integrado | Preferências, janelas, contexto de estudo/meta, propostas e snapshots | Regras editoriais explicáveis, não fórmula científica |
| Calendário e recorrências | Implementado | Séries/exceções, fuso, conflitos, prévia, confirmação e ICS | Sem push com site fechado |
| Player de sessão | Implementado | Timer por timestamps, pausa/retomada, resultados e snapshot | Conclusão manual; recuperação depende de dados salvos/navegador |
| Histórico, benchmarks e relatórios | Implementado e integrado | Resultados por protocolo, versão/configuração; estudo no mesmo período | Dados autodeclarados; não comparar contextos incompatíveis |
| Metas, habilidades, diário e VOD | Implementado | Objetivos privados, dificuldades, VOD manual contextual | Sem análise automática de vídeo nem diagnóstico médico |
| XP e conquistas | Implementado | RPC atômica, idempotência e limites existentes | Participação registrada não equivale a domínio |
| Meta Center e guias de mapa | Implementado; cobertura atual parcial | Contextos/revisões/fontes/mídia, vínculos de treino | Fontes ausentes/vencidas não sustentam atualidade |
| Meta Training e atualização opcional | Implementado | Contexto congelado, avisos, revisão proposta | Não altera rotina pessoal sem confirmação |
| Competitivo, preparação e notícias | Implementado; atualização editorial manual | Favoritos, regulamentos, fases, checklist, calendário e fontes | Sem promessa de elegibilidade ou feed em tempo real |
| Equipes, duplas e trios | Implementado; validação hospedada pendente | Consentimento/autorização, objetivos e sessões compartilhados | Sem contato aberto/matchmaking; demo não simula aceite real |
| kyrven coach | Implementado; generativo depende de configuração | Contexto mínimo consentido, servidor, limites, ações tipadas confirmadas | Sem chave: assistência claramente baseada em regras |
| Fortnite Knowledge | Implementado; generativo opcional | Recuperação pública datada, citações, histórico privado | Se não há evidência atual, informa ausência; separado do Coach |
| Painéis editoriais e revisão | Implementado e integrado | Papéis administrativos/RLS, revisão de Academy/Meta/Knowledge | Dados externos requerem aprovação e mídia autorizada |
| Diagnóstico de vínculos editoriais | Implementado nesta entrega | Metadados do catálogo; links aos editores existentes | Não testa URLs externas ou mapas no jogo |
| Exportação e exclusão | Implementado | Dono explícito, RPC/serviço existente, dados locais separados | Exclusão Auth/storage real requer staging e configuração |
| Comunidade | Dependente de configuração | Link administrativo existente | Nenhum convite/contato foi enviado |
| Publicação e monitoramento | Pendente por decisão do usuário | Scripts e checklist preservados | Não houve deploy, contratação ou configuração secreta |

Nenhuma funcionalidade avançada foi removida. Nenhuma tabela duplicada de progresso, treino, calendário ou recomendação foi criada. Conteúdos insuficientes devem aparecer como lacunas, e não como registros fabricados.
