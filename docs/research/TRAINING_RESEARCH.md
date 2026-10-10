# Pesquisa de treinamento competitivo — Clutchfolio 6.0

Data de corte: 10/10/2026. Versão editorial: `2026-10-10.1`.

Esta é uma investigação editorial orientada à implementação, não uma revisão sistemática original, uma pesquisa com participantes ou uma validação experimental do Clutchfolio. As fontes, conclusões e limites estão no [registro de evidências](EVIDENCE_REGISTER.md). Não foram inventadas entrevistas, transcrições ou sessões observadas.

## Estado do projeto e integração

A inspeção encontrou os PRs #1–#7 abertos em sequência. A base deste trabalho é `feat/performance-intelligence`, commit `2a1d914226db4f276ef3daa4d9ef95727c8a07a2`, que contém cumulativamente os recursos anteriores e migrations 001–009. Não se presumiu que estivessem incorporados em `main`; nenhum PR foi mesclado. O novo PR é independente quanto ao diff, mas depende dessa sequência.

Foram inspecionados catálogo, Training Builder, sessão, snapshots, resultados, calendário, relatórios, Coach, painel editorial, validação, seeds, RLS e testes. Já existiam um construtor completo, IDs de etapas repetidas, exercícios personalizados, retomada de sessão, revisões de resultados e XP protegido contra duplicação. O problema abordado aqui é a ausência de uma taxonomia detalhada ligada à procedência e aos limites da prática. Não há substituição dessas funcionalidades.

## Processo de busca e leitura

Buscas em português e inglês combinaram nomes de criadores/profissionais, prática/scrims/VOD/rotations, motor learning, distributed practice, contextual interference, feedback, perceptual-cognitive training, expertise, fatigue, sleep e ergonomics. Foram priorizados Epic/Fortnite, entrevistas publicadas pela própria organização, páginas dos autores/criadores, PubMed/PMC e editoras científicas. Metadados indexados foram mantidos separados de resumos e textos de páginas. Não houve coleta automatizada periódica ou acesso a conteúdo pago.

O registro inclui as referências solicitadas, inclusive o PMID 42174296, confirmado pelo artigo no PMC. Captchas e páginas vazias impediram algumas leituras completas. O vídeo `sk3yKXim6IY` não forneceu conteúdo verificável; nenhuma conclusão foi atribuída a ele. Nenhum vídeo foi assistido audiovisualmente. A descrição pública do material de Veno foi lida, mas a aula não foi acessada. Os mapas foram conferidos em páginas oficiais de publicação, sem execução dentro do Fortnite.

Critérios de inclusão: origem identificável, pertinência a uma pergunta de treinamento, nível de acesso declarado e possibilidade de escrever uma conclusão limitada. Critérios de exclusão para recomendações: vídeos inacessíveis, afirmações promocionais de superioridade, códigos sem listagem verificável e resultados de outros jogos apresentados como regras universais. Não se fez triagem dupla, avaliação formal de risco de viés nem busca exaustiva em bases pagas; isso limita a abrangência.

## O que a prática profissional permite inferir

A entrevista com Khanada é o material mais direto desta coleta sobre organização de treino: relato individual, não uma amostra representativa. Seus comentários ajudam a formular perguntas sobre finalidade da prática e revisão, mas não sustentam uma carga horária prescrita. As listagens de Reisshub, Raider464 e JivanTV confirmam tipos de atividades disponíveis, não os resultados de usá-las.

A cobertura regional é desigual e deve permanecer explícita:

| Recorte | Material consultado | Inferência permitida | Lacuna |
| --- | --- | --- | --- |
| América do Norte | Entrevista de Khanada e página Vital Scrims | Relato de prática e existência de organização comunitária | Não observamos uma semana completa, nem entrevistamos vários jogadores |
| Brasil | Persa Training em português e anúncio de rotina associada a NUTI | Recursos anunciados e vocabulário editorial local | Não há sessão observada nem descrição suficiente para reconstruir a rotina de NUTI |
| Europa | Descrição de análise de Veno por DestinysJesus; recapitulação oficial FNCS | Existência do material de análise e resultado do evento | Aula não assistida; nenhum protocolo semanal europeu validado |

A recapitulação oficial da FNCS 2026 foi usada para conferir relevância competitiva atual, sem deduzir métodos de treino a partir da classificação. O seletor de região da página global não prova a região de cada jogador. Não foi produzido um ranking de treinadores ou uma rotina “dos melhores do mundo”.

## Tradução para o produto

O catálogo mantém Noção de Jogo como nome principal e preserva Freebuild, Piece Control, Box Fight, Realistic, Edit Course, Retake, Zone Wars, Scrims e Endgame. Definições, exemplos e relações são uma taxonomia editorial, não uma medição da frequência de uso dessas palavras pela comunidade brasileira. O vocabulário precisa de revisão futura com jogadores brasileiros; traduções automáticas de páginas da Epic não são autoridade linguística suficiente.

Fight sense é tratado como combinação de leitura de ameaça, escolha de confronto, exposição, recursos e alternativas, em vez de um único número. Endgame possui categoria própria. Construção Zero possui competências próprias de cobertura, terreno, deslocamento, mira, recursos e ameaças; não herda treinos de construção. A lista é extensível por IDs, sem substituir a enumeração histórica usada por relatórios e perfis.

Quatro atividades foram adicionadas para lacunas concretas: 1v1 com objetivo de troca, revisão de comunicação em dupla, scrims com debrief e aplicação de uma decisão em ranqueada. Apenas a primeira introduz uma nova ilha, com código conferido. As demais não inventam mapas, servidores, integrações ou matchmaking. As 27 atividades existentes recebem contexto de aprendizagem sem alteração de unidades ou versões de benchmarks.

## Síntese crítica da ciência

- **Aquisição, retenção e transferência:** são desfechos distintos. A revisão de habilidades esportivas expõe limites de tarefas fechadas e de testes curtos. O produto mantém resultados por cenário e pede verificação em partidas, sem converter horas em melhoria.
- **Prática distribuída:** a evidência observacional em LoL motiva estudar organização temporal; não prova uma dose ideal para Fortnite. O calendário oferece flexibilidade, sem um algoritmo que imponha horas.
- **Variabilidade:** a média de uma meta-análise não elimina diferenças entre laboratório, aplicação e idade. A progressão editorial começa por uma pergunta observável; não embaralha tarefas indiscriminadamente.
- **Feedback e atenção:** a reanálise sobre foco atencional mostra conflito na literatura; a revisão em crianças tem heterogeneidade. Não se impõe uma pista universal ou uma frequência perfeita de feedback.
- **Expertise e prática deliberada:** existe debate sobre a própria definição de prática. No produto, objetivos e revisão orientam a atividade; acumular horas não recebe o rótulo de explicação científica da expertise.
- **Percepção e decisão:** o trecho primário da revisão de esportes coletivos não valida automaticamente VOD Review em Fortnite. Pausar antes de uma decisão é uma proposta editorial testável, sem alegar efeito causal demonstrado.
- **Fadiga, sono, recuperação e exercício físico:** desfechos e populações variam. Registros de disposição não diagnosticam fadiga. Orientações gerais de saúde e ergonomia não viram prescrição clínica ou promessa de melhor mira.

## Próxima investigação necessária

Priorizar entrevistas autorizadas e sessões documentadas de jogadores BR, EU e NA com critérios comuns: objetivo, atividade, oposição, feedback, agenda e condição de comparação. Registrar timestamp e permissão quando houver vídeo, além de distinguir aquecimento e treino técnico. Antes de afirmar eficácia do método, planejar avaliação longitudinal consentida, desfechos definidos, retenção e transferência; um antes/depois sem controle não basta.
