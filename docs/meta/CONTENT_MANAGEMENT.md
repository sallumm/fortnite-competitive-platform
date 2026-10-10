# Meta Center e gestão editorial

Implementação de 10/10/2026 sobre `feat/meta-intelligence` (PR #10, `e8d4a05`). Os PRs #1–#10 estavam abertos, sem merge. Este incremento não supõe que `main` contenha essas entregas: seu PR é independente e empilhado sobre #10. Preserva autenticação, treino, calendário, XP, artigos e migrations 001–015.

## Recursos implementados

- Acesso público “Meta”, seções agrupadas, busca e ordenação; filtros combináveis de temporada, patch, modo, construção, experiência, tipo de partida, equipe, região e evento. Uma combinação sem contexto cadastrado fica vazia, sem substituir a modalidade.
- Páginas detalhadas por revisão `/competitive/meta/:id` e por slug contextual `/competitive/meta/:contextId/:slug`. Fontes, datas, limitações, blocos de texto, características, mídia, estratégia e vínculos com treino. Histórico de revisões continua disponível; a retirada bloqueia a página pública.
- `Admin → Gerenciar Meta`: formulários para temporadas, patches, modos, formatos, contextos e fontes. Itens, locais, guias de drop, estratégias, análises, artigos e vídeos utilizam a mesma identidade de assunto contextual.
- Editor com título, slug, resumo, descrição, categorias, tags, autor público, contexto, evidência, disponibilidade, revisão, objetivo, nível, pré-requisitos, blocos de texto, características, fontes, capa/galeria, vídeos/timestamps e vínculos públicos.
- Prévia, salvar rascunho, enviar à revisão, confirmar publicação, confirmar retirada, buscar pendências, histórico de editores e recuperar uma versão como novo rascunho. Versões do rascunho e da publicação têm controle otimista; conflitos não sobrescrevem o trabalho de outro editor.
- Upload administrativo real pelo endpoint `meta-media`, Supabase Storage privado, PNG normalizado, prévia, alt, fonte, crédito, registro publicável de direitos, substituição por nova associação e remoção de arquivos nunca publicados e não associados a rascunhos.
- Vídeos YouTube incorporados somente após consentimento por sessão/componente; outros VODs permanecem links HTTPS. Timestamps não carregam o provedor antes de consentir. Não há downloads de arquivos de terceiros ou iframes arbitrários.

## Modelo e persistência

Migration incremental **016**:

| Entidade                     | Uso                                                        | Acesso                                                      |
| ---------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| `meta_seasons`               | Registro de temporadas; versões referenciam seu título     | Público para leitura, somente admin para criação            |
| `meta_drafts`                | Estado atual do rascunho e versão otimista                 | Somente admin, escrita por RPC                              |
| `meta_draft_history`         | Snapshots, estados, datas e identidade real do editor      | Somente admin; append pela RPC                              |
| `meta_editions`              | Corpo estruturado público associado a uma revisão imutável | Leitura pública condicionada à publicação; escrita pela RPC |
| `meta_assets`                | Metadata de imagem validada; estado de remoção             | Privado até publicação, escrita pelo servidor               |
| `meta_media_audit`           | Autor real de upload e reserva de remoção                  | Somente admin; escrita pelo servidor/RPC                    |
| `private.meta_editor_limits` | Contagem por editor/janela de uma hora                     | Interno, retenção de dois dias                              |

O catálogo factual anterior (`meta_entries`, `meta_sources`, contextos etc.) continua append-only. Correções de fontes/registros de modalidade usam novos identificadores; mudanças de conteúdo usam novas revisões da identidade de assunto. Não existe edição destrutiva do histórico de conhecimento. Artigos do Meta são conteúdo editorial estruturado nesta área, e podem vincular exercícios e artigos da Academy; o CMS anterior de notícias/aulas continua disponível.

`save_meta_draft` verifica admin, orçamento, campos, datas, fontes e arquivos; salva rascunho e snapshot na mesma transação. Rascunhos privados podem conter textos, vídeos ou fontes ainda incompletos; envio à revisão e publicação exigem todos os campos e fontes necessários. `publish_meta_draft` exige revisão, versão esperada e base de publicação atual; serializa o cálculo da cadeia, adiciona revisão/edição/vínculos e atualiza o rascunho na mesma transação. Uma relação inexistente ou incompatível reverte toda a publicação. `restore_meta_draft` restaura como rascunho e exige nova revisão/publicação. A retirada gera uma revisão arquivada, sem apagar conhecimento factual antigo. Esses registros históricos básicos continuam públicos para transparência; a página detalhada e os anexos anteriores à retirada deixam de ser disponibilizados.

Datas são instantes com offset; `datetime-local` é convertido explicitamente pelo navegador. Patches sem data de lançamento não são automaticamente classificados como atuais. Nenhuma pesquisa, sessão, VOD privado ou perfil do jogador é enviado ao editor público.

## Segurança e mídia

O frontend utiliza somente a conexão Supabase já existente com chave pública. O endpoint verifica o JWT com `Auth.getUser`, consulta `is_admin` usando esse JWT e aplica quota antes de usar credenciais de servidor. As chaves `SUPABASE_SERVICE_ROLE_KEY` nunca entram no bundle.

120 operações editoriais por editor/hora, aplicadas no banco a salvamento, publicação, restauração, cadastros de contexto e quota/reserva de mídia. Operações compostas podem consumir mais de uma unidade. Falhas não geram logs com conteúdo ou tokens. O gateway/ambiente também deve aplicar proteção de tráfego antes da função; a quota lógica não substitui proteção contra tráfego hostil em larga escala.

Imagens recebidas pelo painel: PNG/JPEG/WebP até 3 MB, até 4096 px por eixo e 8 milhões de pixels. O navegador decodifica e normaliza em PNG, removendo metadata. O servidor limita o corpo **mesmo sem Content-Length**, exige PNG, valida assinatura, limites, chunks e CRC e recusa conteúdo posterior ao IEND. O servidor não representa uma avaliação de direitos nem um antivírus/decodificador completo: a autorização é uma declaração editorial sujeita a revisão humana. HTML/SVG executável não é aceito. Nome UUID com pasta do administrador; sem overwrite de arquivo existente.

O bucket `meta-images` é privado. Políticas SELECT vinculam imagens a edições visíveis; políticas **restritivas** impedem que permissões amplas de outros buckets habilitem upload, overwrite ou remoção pelo cliente. Escrita binária somente pela função. URLs assinadas duram cinco minutos, renovadas enquanto a imagem está aberta; uma retirada não revoga imediatamente URLs já emitidas. Sem prometer revogação instantânea ou transformação de imagens paga.

A reserva de remoção adquire lock na mídia e marca `deleting`; a validação de associações adquire lock compatível e recusa mídias reservadas. Arquivos já publicados são conservados no histórico. Substituir significa enviar arquivo novo e mudar a associação. Uma falha na gravação de metadata após upload remove o objeto; falha na remoção do objeto libera sua reserva. Erros entre Storage e banco exigem conciliação operacional porque não há transação distribuída.

Blocos são textos/títulos renderizados pelo React, sem HTML/Markdown executável. O schema recusa campos arbitrários de HTML. Não há `dangerouslySetInnerHTML`. URLs não são interpoladas como código. Incorporação é construída de um ID YouTube validado, sempre em `youtube-nocookie.com`, sem autoplay e com iframe restrito. O modo de privacidade aprimorada não significa ausência de processamento de dados pelo YouTube.

## Limitações verificadas

- Nenhum Supabase remoto de staging foi disponibilizado: não foi aplicada a migration remota, nem implantada a função, nem realizado upload no serviço real. Há testes PostgreSQL de policies/RPCs (PGlite), handler HTTP com dependências controladas e formulários React. Isso não equivale a validar Auth/Storage/Edge integrados em produção.
- Não foram adicionadas imagens Fortnite ou mapas cartográficos sem licença clara. A navegação de locais é textual e aceita imagens autorizadas posteriormente. Nenhum vídeo foi assistido ou teve autorização inferida de sua disponibilidade pública neste incremento.
- Incorporação pode ser desabilitada pelo criador/região; abrir no provedor permanece disponível. Não há matchmaking, atualização automática de loot, resultados ao vivo, IA nova ou coleta por scraping.
- Registros usam campos finitos e limites explícitos. Consultas são paginadas com teto de 10 mil linhas; histórico do painel exibe as 100 revisões mais recentes. Volumes maiores precisam de filtros/paginação no servidor e paginação de histórico na interface.
- `Meta` mantém as informações verificadas anteriormente; seu cadastro de itens não é inventário completo. Construção de novos contextos é responsabilidade editorial, sem inventar que toda combinação exista.
- SPA permanece SPA. O sitemap genérico exige `VITE_SITE_URL`; páginas editoriais publicadas no banco precisam de um processo de sitemap/prerender conectado ao banco. Não foi inventada indexação SSR.

## Ativação em staging e checklist

1. Integrar a cadeia de PRs na ordem correta ou testar a branch cumulativa. Aplicar migrations 001–016 apenas após backup e revisão; 016 não modifica migrations antigas.
2. Conferir `is_admin`, RLS e grants com conta comum/admin. Não atribuir admin pelo cliente. Testar que rascunhos, histórico de atores e mídia não publicada não aparecem com chave pública.
3. Confirmar criação privada do bucket `meta-images`, limites, MIME e todas as políticas existentes de `storage.objects`.
4. Implantar `meta-media` com `ALLOWED_ORIGIN` igual à origem real. `SUPABASE_URL`, chave pública e `SUPABASE_SERVICE_ROLE_KEY` ficam no ambiente da Edge Function. `verify_jwt=false` está acompanhado de verificação explícita de usuário real e papel administrativo dentro da função.
5. Executar com duas contas o fluxo: criar temporada → modo → patch → contexto → fonte → item → upload original autorizado → revisão → confirmar publicação → ler deslogado → editar → confirmar nova publicação → retirar → recuperar como rascunho. Cadastrar vídeo, guia de drop e artigo com exercício compatível.
6. Verificar erros de rede/console, upload inválido/oversized, abuso de quota, concorrência de editores e falhas entre objeto e registro. Conciliar órfãos/arquivos reservados em caso de falha operacional, sem remover arquivos publicados.
7. Revisar direitos de cada arquivo, aviso de produto não oficial, público adolescente e consentimento de vídeos. Não publicar IP de terceiros com base apenas em “está na internet”.
8. Ativar domínio/SEO/cache/monitoramento e backups somente após esses fluxos. Nenhum serviço pago, deploy público ou migração remota foi ativado nesta entrega.
