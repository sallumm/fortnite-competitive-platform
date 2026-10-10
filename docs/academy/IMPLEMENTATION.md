# Mastery Academy: estudo, avaliação e aplicação

A Academy continua os 19 artigos curriculares e a taxonomia de 54 competências existentes. Aulas permanecem em `articles`; não há um segundo cadastro de textos. O currículo mantém fontes, níveis 0–5, modalidades, objetivos, atividades e pré-requisitos validados no servidor.

## Implementado

- Home com ponto de partida flexível, retomada, sugestão, oito trilhas parciais, mapa navegável de pré-requisitos, estudo concluído, avaliações, favoritas, dificuldades e histórico.
- Cada aula curricular permite iniciar, declarar conclusão, registrar revisão, fazer avaliação opcional quando publicada e salvar anotação privada.
- Quatro avaliações conceituais originais: objetivo do Battle Royale, rotação contextual, defesa em Zero Build e hipóteses em VOD. Respostas exigem explicação; perguntas não medem desempenho motor.
- Versão, texto, currículo e perguntas são copiados pelo servidor ao registrar estudo. Alterações editoriais não reescrevem os registros anteriores. O histórico permite consultar e exportar a versão registrada.
- Atividades relacionadas criam uma rotina real, editável no construtor existente. A duração de cinco minutos é somente valor inicial editável, não recomendação científica. Agendamento, execução, conclusão manual, resultados e relatórios usam os fluxos existentes.
- Curadoria em `/admin/academy`: criar, editar, ordenar e publicar/arquivar trilhas. Em `/admin`, criar/editar aulas, fontes e pré-requisitos; editor de perguntas por campos, publicação e histórico editorial existentes.
- Exclusão específica dos dados de estudo e exportação JSON. Exclusão de conta remove registros via `auth.users` com cascade.
- Orientação de estudo por regras explicitamente identificada; o Coach existente continua acessível, sem nova transmissão de anotações ou progresso a provedores.

## Dados e segurança

Aplicar migrations 017, 018 e 019 **depois** de 001–016, primeiro em staging. Não foram aplicadas remotamente. Não é necessário configurar serviço pago ou uma chave de IA.

`academy_records` guarda eventos privados e snapshots imutáveis; `academy_notes` guarda anotação atual e favorita por aula; `academy_paths` organiza aulas existentes. Não há cascade da aula para seu histórico pessoal. Somente RPCs autenticados escrevem eventos e notas. `auth.uid()` define o proprietário; não existe parâmetro de outro usuário. RLS impede leitura cruzada, inclusive por administradores. O RPC consulta aula publicada e captura a fonte real no servidor. Avaliações rejeitam respostas ausentes ou fora das opções. Eventos são limitados a 120 por hora por conta, serializados; esse limite conta eventos ainda existentes, e exclusão do histórico o reinicia. Não representa controle de custos de IA.

Trilhas são administradas por `is_admin()`; o front-end não atribui funções. Publicação rejeita aulas ausentes ou não publicadas. O leitor filtra aulas retiradas posteriormente. Editar uma aula conserva o histórico editorial existente. O editor de currículo continua estruturado em JSON; não foi substituído por um CMS completo de blocos de mídia.

Demonstração local utiliza uma chave exclusiva. Registros de demonstração não são consultados para contas reais nem enviados ao Supabase. Estado local corrompido é descartado. Falha do banco configurado produz erro, sem substituição por progresso fictício.

## Limites e próximos incrementos

- Cobertura inicial parcial; não há 14 cursos completos, ranking de domínio, certificação nem nota universal.
- Não existe agendamento automático de revisão ou notificação com site fechado. O aluno pode revisar em qualquer momento.
- Não há novo CMS de mídias da Academy. A política e o player com consentimento do Meta continuam existentes, mas não são tratados como autorização automática para reutilizar imagens/vídeos nas aulas.
- Não há nova IA contextual específica de aula. Orientação por regras é identificada.
- Sem Supabase de staging configurado nesta sessão: autenticação real, operações administrativas via navegador e migrations remotas exigem validação de implantação. Testes de servidor usam PostgreSQL em PGlite; navegador usa a demonstração identificada.

## Checklist de ativação

1. Revisar backup e aplicar 017–019 em staging na ordem.
2. Entrar com duas contas e confirmar isolamento de histórico e notas.
3. Entrar com conta de curadoria; publicar uma aula e trilha, registrar estudo, revisar aula e conferir snapshot anterior.
4. Executar uma rotina derivada de aula, agendar, registrar resultado e verificar relatório.
5. Validar exportação, exclusão de estudo e exclusão de conta.
6. Conferir fontes, prazos e cobertura editorial antes de anunciar cursos completos.
