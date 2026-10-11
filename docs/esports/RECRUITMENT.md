# kyrven esports — recrutamento

Etapa C do Prompt 18, branch `feat/ultimate-brand-transformation`, base documental `4f6fa65` descendente da ponta funcional `3e47eb1`.

A migration 25 adiciona ciclos, candidaturas, consentimentos versionados, eventos compartilháveis, avaliações internas, responsabilidades delegadas, cargos temporários e auditoria. As primeiras 24 migrations permanecem intactas. Todas as escritas passam por RPC autenticada com validação no servidor; leitura de candidaturas tem RLS por proprietário/avaliador. Notas, autorizações e auditoria são privadas.

A liberação em `private.esports_launch_gate` começa falsa e não pode ser alterada por RPC do navegador. Nem um administrador consegue abrir uma seletiva antes da revisão manual. Uma liberação operacional não é uma certificação jurídica. Proteção de adolescentes tem bloqueio separado e autorização individual verificada, vinculada ao ciclo/política e com expiração. O formulário não coleta documentos, endereço, senha ou data de nascimento completa. A faixa etária é declarada, não uma verificação de idade; a operação real precisa definir como verificar idade/representação adequadamente antes da abertura.

As páginas públicas `/esports` e `/be-kyrven`, espaço `/app/esports` e administração `/admin/esports` usam Supabase real. Demonstração não produz candidaturas ou cargos. Não existem elenco, patrocinadores ou conquistas fictícias. Discord é apenas um link configurável para canal oficial; nenhuma integração ou solicitação de credenciais do jogador.

Validação local da etapa: build aprovado, 7 testes PostgreSQL/PGlite aprovados (migrations completas, RLS e RPCs), 6 testes Playwright aprovados em desktop/tablet/mobile incluindo axe em dois temas, bloqueio público e rotas privadas. Nenhuma migration foi aplicada ao Supabase remoto. Testes ponta a ponta com Auth, SMTP e usuários reais em staging continuam necessários.

Provas, bolsas, metas e decisões de Academy Roster foram acrescentadas na etapa D; consulte ASSESSMENTS_DEVELOPMENT.md. Formalização de elenco profissional permanece pendente. LivePix e qualquer cobrança continuam fora desta implementação. A validação cumulativa atual está no [relatório do Prompt 18](../PROMPT18_REPORT.md).
