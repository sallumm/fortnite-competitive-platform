# Especificação do catálogo

`meta_entries.subject_key` identifica o item/conceito ao longo dos patches. `context_id` resolve versão, modo, formato, contexto de jogo, região e evento. `(context_id, subject_key, revision)` identifica uma edição. `previous_id` encadeia edições do mesmo recorte.

Campos implementados: nome (`title`, preserva nome oficial na língua da fonte), categoria extensível, descrição factual, natureza de evidência, disponibilidade, estado editorial, fontes, verificação, início de validade, revisão devida, limitações e nota de alteração. Não há estatísticas numéricas fabricadas. Nomes ingleses são mantidos quando a tradução oficial brasileira não foi comprovada. Termos comunitários não verificados não recebem alias inventado.

Disponibilidade é separada da confiança: `available`, `vaulted`, `announced`, `unknown`. Um ajuste oficialmente confirmado pode ter disponibilidade atual desconhecida. `confirmed` exige fonte oficial acessível; `under_analysis` indica interpretação/relato em avaliação; `unconfirmed`, insuficiência; `stale`, versão/prazo incompatível; `archived`, histórico deliberadamente retirado da recomendação atual.

Imagens, alias, vídeos autorizados e atributos específicos opcionais estão planejados, não implementados. Nenhuma imagem de mapa foi copiada e nenhum arquivo de vídeo foi redistribuído. Links apontam às fontes originais; vídeos sem conteúdo acessível ficam no registro de lacunas, excluídos das afirmações aprovadas.

A próxima extensão de atributos deverá usar schema específico por categoria, fonte por atributo e revisão do mesmo objeto, sem converter a descrição livre em estatística computável.
