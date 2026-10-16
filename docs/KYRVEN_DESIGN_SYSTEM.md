# Sistema visual kyrven

Fonte de tokens: `src/reinvention.css`, carregada depois do CSS histórico. Camada de migração explícita: estilos antigos ainda fornecem geometria de controles complexos; não foram removidos sem verificação.

Temas: Grafite (padrão), Papel, Maré e preferência Sistema. Tokens semânticos de superfícies, texto, acento e feedback. Nenhum filtro de inversão. Preferência persistida localmente, sem migration ou mudança em perfil remoto. `public/theme-init.js` aplica a escolha antes da renderização React. Falha no storage mantém configuração em memória.

Tipografia: UI Segoe UI/system-ui; editorial Georgia/Times New Roman. Cabeçalhos operacionais 29–42 px, editorial 46–84 px, corpo 14–16 px. Escala de espaço existente 4/8/12/16/24/32, complementada por seções editoriais. Raios 3/6/10 px. Elevação reservada a modais. Divisórias substituem caixas em cabeçalhos, métricas e índices.

Motion: feedback 120 ms, transição 200 ms, momentos 300 ms. Cabeçalhos não sobem a cada visita; cards informativos não flutuam ao hover. Preferência do dispositivo sempre respeitada; controle de intensidade existente preservado. Densidade compacta reduz espaçamento de linhas e tabelas, sem reduzir os alvos de toque.

Navegação: shell existente e paleta de comandos preservados; acesso direto a Skill Maxing e Road, dock mobile com Hoje/Treinar/Agenda/Estudar/Mais. Aparência acessível no header e perfil. Modais nativos preservam foco/teclado. Formulários e botões mantêm handlers e estados disabled.

Composição: landing como índice editorial; dashboard orientado à próxima sessão; Training Center com resumo de ação/avaliação/continuidade; academy com início editorial; calendário preserva drag/drop e ações; administração prioriza densidade e separação. Cobertura individual e limitações na matriz de rotas. Conformidade WCAG não presumida: testes e inspeção registrados no relatório final.
