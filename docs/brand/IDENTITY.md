# kyrven — identidade e experiência

A assinatura pública usa minúsculas. O símbolo geométrico deriva de um k com duas direções de movimento, desenhado em SVG próprio. Sistema tipográfico usa fontes de sistema; não carrega fontes comerciais nem trackers. Assinaturas academy, esports e development compartilham símbolo e tipografia; a campanha usa `be kyrven.`.

Paleta: superfícies grafite, acento lima e violeta de apoio no escuro; superfícies claras e acento verde profundo no claro. `src/brand.css` concentra tokens de espaço, raio, elevação e movimento. O contraste deve ser validado por rota, não presumido pela paleta. Formulários e dados têm prioridade sobre ornamentação.

A navegação de desenvolvimento liga aprender, praticar, organizar e analisar. Landing explica esse ciclo, mantém a prévia interativa identificada e mostra organização em desenvolvimento. Nenhuma métrica de resultado de atleta foi criada.

Motion/LazyMotion e dnd-kit existentes continuam usados. Springs nos cartões/indicadores, transições bounded nas páginas, feedback de pressão CSS e preferência de movimento reduzido têm finalidades diferentes. Sem animações contínuas novas ou autoplay. Movimento essencial desliga transições; a preferência do sistema tem prioridade.

Referências primárias consultadas em 11/10/2026 UTC: [Team Liquid](https://teamliquid.com/pt-br), [Linear — refresh](https://linear.app/now/behind-the-latest-design-refresh), [Motion — accessibility](https://motion.dev/docs/react-accessibility). Inspiração: separação clara entre organização/roster, ações previsíveis e tokens consistentes. Não foram copiados layouts, símbolos, logotipos, textos ou estatísticas.

Compatibilidade: nome técnico do pacote, chaves `clutchfolio-*`, função `clutch-coach`, project_id, migrations, URLs/IDs editoriais e snapshots existentes permanecem estáveis. `brandCatalog` transforma somente textos editoriais de apresentação para catálogo público, conservando dados de administração e URLs. Migrations 001–024 permanecem byte a byte iguais. Relatórios históricos são documentação de etapas anteriores. `check:brand` verifica fontes visíveis e aceita as referências de compatibilidade explicitadas.

Assets: favicon SVG, símbolo SVG reutilizável, PNGs 180/192/512 e imagem social 1200×630. Manifest expressa instalação standalone, sem prometer sincronização offline ou service worker. SEO de produção depende de domínio real; confirmar URL absoluta da imagem no setup.

Validação A: check:brand aprovado; 2 testes de marca/compatibilidade aprovados; build aprovado. Validação B registrada no relatório de entrega após os testes de navegador. Capturas reais de landing e workspace são usadas na revisão visual.
