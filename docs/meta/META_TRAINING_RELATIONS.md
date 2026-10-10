# Relações com treinamento

`meta_links` relaciona edições a competências, exercícios, artigos ou torneios existentes. O servidor verifica presença pública e modalidade compatível. Não aceita IDs de VODs privados, resultados, perfis ou sessões. As 44 relações iniciais conectam, por exemplo, retirada de recurso à gestão de inventário, mudança de mapa ao estudo de early/rotação e adaptação profissional à análise de VOD.

São hipóteses editoriais de relevância, não prova de eficácia ou recomendação de mais horas. O Meta Center oferece links para as páginas existentes. Exercícios não são duplicados; benchmarks, versão das métricas e resultados continuam intactos.

Nova revisão editorial do mesmo recorte pode reutilizar vínculos da edição anterior até ganhar vínculos próprios. Arquivamento e vencimento permanecem visíveis. Retirada futura de um conteúdo relacionado não apaga o meta ou o histórico: a interface mostra indisponibilidade.

Comparação mostra diferenças de registros e um conjunto de relações a revisar. Ausência de dado não equivale a ausência de item no jogo. O sistema não altera planos do usuário nem marca uma habilidade como pior ou melhor por causa do patch.

`retrieveMeta` prepara recuperação pública limitada a quatro registros confirmados, não vencidos, do contexto exato. Conteúdo retornado é `reference-data-only`; não deve ser tratado como instrução. O helper ainda **não está ligado ao backend generativo do Clutch Coach**, e não consulta automaticamente a internet. Futura integração deve preservar consentimento, autenticação e limites existentes, exibir versão/fontes e recusar extrapolação de loot entre contextos.
