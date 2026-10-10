# Arquitetura e operação

Base auditada: commit `7075503`, PR #9 em `feat/fortnite-mastery`; PRs #1–#9 continuam encadeados e não integrados em main no momento da inspeção. Nova branch `feat/meta-intelligence` preserva essa base. Não modifica migrations 001–013 ou banco remoto.

Migration 014 adiciona sete tabelas públicas (`meta_versions`, `meta_modes`, `meta_formats`, `meta_sources`, `meta_contexts`, `meta_entries`, `meta_links`) e uma auditoria administrativa. Versionamento de temporada/patch fica numa tabela, sem criar entidades vazias para cada conceito. Itens, locais, mecânicas, estratégias e análises compartilham registros tipados; categorias são extensíveis. Referências ao treinamento reutilizam tabelas atuais.

Todos os registros do novo corpus são editoriais públicos: **não há rascunho privado** nessas tabelas. Apenas administradores podem inserir. UPDATE/DELETE não são concedidos e triggers bloqueiam alteração mesmo para escrita privilegiada normal. Correções geram nova edição; contextos/fontes corrigidos ganham novos IDs. Uma edição arquivada preserva a anterior. Não fazer migrations de correção via UPDATE.

O servidor valida cadeia, fonte acessível, fonte oficial para confirmação, revisão devida, valores finitos, verificações não futuras e compatibilidade de links. Um trigger de statement serializa inserções de revisões para evitar dois editores publicarem o mesmo próximo número; validação única oferece uma segunda barreira. A função de lock tem `SECURITY DEFINER`, search_path vazio e EXECUTE revogado: não altera dados nem autoriza inserção, que segue RLS. Teste multi-conexão ainda exige staging PostgreSQL.

Auditoria complementar foi necessária porque a tabela editorial anterior usa `record_id uuid`; o novo corpus usa chaves textuais. Registra apenas ator, chave e data; não copia dados pessoais ou chats. Leitura restrita a admin. Não há service-role no frontend.

`/competitive/meta` é lazy, com acesso da central competitiva e painel editorial. Fallback local/demo é corpus público identificado; configuração Supabase lê as tabelas reais e apresenta erro quando faltam migrations, sem trocar silenciosamente por seed. Consultas paginadas evitam truncamento padrão e interrompem corpus acima de 10 mil linhas por tabela em vez de renderizar subconjunto enganoso. Busca por servidor para maior escala permanece pendente.

O editor prepara revisão JSON validada, publica somente após clique explícito e informa resultado real. Contextos, fontes e novos vínculos são administrados por migrations/processo editorial; não há formulário dedicado completo para todas as entidades. Datas de consulta usam tempo real; prazo é uma política editorial de sete dias, não garantia de atualização automática.

## Preparação

- Revisar corpus e fontes; não extrapolar os dados para outros modos/eventos.
- Aplicar 014 e 015 em staging após 001–013; testar RLS/role admin e backup.
- `node scripts/meta-seed.mjs --check`, `npm test`, `npm run build`, `npm run test:e2e`.
- Confirmar erros quando banco estiver indisponível e revisão simultânea.
- Configurar `VITE_SITE_URL` para sitemap; preservar SPA redirects e segredos servidor.
- Integrar PR na ordem da pilha, sem substituir main por uma versão parcial.
