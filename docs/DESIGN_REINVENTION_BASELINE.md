# kyrven — baseline C0

Data: 2026-10-12. Base exata: f230845cb50057a92d8c779df367127a70a433f4. Branch: feat/kyrven-complete-design-reinvention.

Verificação ao vivo por git ls-remote, gh pr list e gh run list. PR #23 aberta, draft, sem merge; origem feat/rpc-quotas-auth-readiness permanece no SHA aprovado. Runs 38204046887 e 38204040977: completed/success. Os 400 Vitest e 81 Playwright são evidências históricas informadas na PR, não reexecuções locais.

Genealogia: main → cadeia de produto → docs/kyrven-handoff (#18) → feat/ultimate-brand-transformation (#19) → feat/security-hardening-reconstruction (#20) → feat/post-audit-hardening (#21) → feat/staging-foundation (#22) → feat/rpc-quotas-auth-readiness (#23) → redesign. Todas as PRs 19–23 abertas e draft. Nenhuma branch remota mais nova identificada na listagem.

Parecer 24.2.4: autorização da base fornecida pelo proprietário e documento da missão; arquivo de auditoria independente não anexado nem encontrado no repositório. Não alegamos nova auditoria de segurança. Migration 031 permanece bloqueada para instalação; nenhuma operação hospedada autorizada.

Stack confirmada: React 19, React Router 7, Vite 7, TypeScript 5, Motion 14, Lucide, Recharts, Vitest, Playwright. npm ci --ignore-scripts: 204 pacotes, auditoria de instalação sem vulnerabilidades. Sem novas dependências.

Marca anterior: src/components/brand/Brand.tsx, src/brand.css, public/favicon.svg, public/brand/{symbol.svg,apple-touch-icon.png,icon-192.png,icon-512.png,social.png}, public/manifest.webmanifest, index.html. Histórico preservado no Git.

Problemas observados: cabeçalho em caixa repetido; excesso de cantos arredondados; navegação com 20 destinos e sem Skill Maxing direto; múltiplos CTAs antes da tarefa diária; landing extensa e repetitiva; apenas dois temas; ausência de bootstrap de tema.

Riscos: administração e Auth reais dependem de ambiente autorizado; demo local não comprova RLS/MFA. Banco, pagamentos, infra e autenticação backend fora do escopo. Restrições Windows exigem execução de ferramentas de build fora do sandbox quando subprocessos recebem EPERM.
