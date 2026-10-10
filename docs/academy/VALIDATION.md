# Verificação

- Testes PostgreSQL/PGlite carregam migrations 001–019: autenticação, RLS entre contas, escrita direta proibida, captura de versão pelo servidor, perguntas inválidas, publicação de trilha e limite de eventos.
- Testes de domínio conferem referências reais de trilhas e avaliações, limites de resposta e ausência de atribuição automática de domínio.
- Playwright executa o fluxo de demonstração: primeiro estudo → avaliação → anotação → conclusão → recarregar → abrir VOD avançado diretamente → criar rotina → agendar → executar → concluir manualmente → relatórios → retornar à Academy.
- O cenário é executado em desktop, tablet e mobile com auditoria axe de violações sérias/críticas, erros JavaScript e overflow horizontal. As capturas são evidência de demonstração, não autenticação ou persistência remota.
- O teste completo do produto inclui os fluxos anteriores de calendário, treinador, Meta, biblioteca e treinamento.

Resultados locais: `npm test` — 207 testes em 35 arquivos; suíte Playwright completa — 45 testes em desktop, tablet e mobile; `npm run build` — aprovado. Capturas desktop/mobile foram inspecionadas. O CI do commit final é registrado no Pull Request. Não houve implantação, teste dentro do Fortnite, análise audiovisual de novos vídeos ou teste de Supabase remoto. Build sem `VITE_SITE_URL` omite sitemap; a pré-renderização editorial permanece opcional e desativada.
