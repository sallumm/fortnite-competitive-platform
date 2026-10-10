import type {
  Catalog,
  PlayerData,
  Exercise,
  Article,
  Tournament,
} from "./types";
import { trainingCatalog } from "./training-catalog";
import { competitiveSeed } from "./competitive-seed";
const verified = "2026-10-10T03:00:00Z";
export const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const exercises: Exercise[] = [
  {
    id: uid(1),
    title: "Tracking com intenção",
    creator: "donwozi",
    map_code: "8022-6842-4965",
    category: "aim",
    mode: "both",
    level: "beginner",
    description: "Acompanhe alvos em movimento sem antecipar o disparo.",
    instructions:
      "No SKAAVOK Aim Trainer, escolha um cenário de tracking. Use a mesma arma e configuração em cada tentativa. Faça blocos curtos e registre a precisão exibida, se disponível. Priorize manter a mira no alvo, sem perseguir velocidade.",
    metric: "Precisão (%) — mesmo cenário e arma",
    source_url: "https://www.fortnite.com/@donwozi/8022-6842-4965",
    verified_at: verified,
    published: true,
  },
  {
    id: uid(2),
    title: "Edits, resets e precisão",
    creator: "raider464",
    map_code: "2424-4344-7824",
    category: "mechanics",
    mode: "build",
    level: "intermediate",
    description:
      "Uma sequência consistente vale mais que uma tentativa apressada.",
    instructions:
      "No Mechanics Training V5, selecione um exercício de editing. Repita a mesma sequência, incluindo resets. Registre o número de execuções sem erro em dez tentativas. Aumente o ritmo somente quando conseguir repetir com controle.",
    metric: "Execuções corretas em 10 tentativas",
    source_url: "https://www.fortnite.com/@raider464/2424-4344-7824",
    verified_at: verified,
    published: true,
  },
  {
    id: uid(3),
    title: "Piece control e peeks",
    creator: "jivantv",
    map_code: "7037-5244-5527",
    category: "piece",
    mode: "build",
    level: "intermediate",
    description: "Controle espaço antes de se expor ao oponente.",
    instructions:
      "No How To Piece Control Map, escolha um cenário de controle de peças. Observe quais estruturas limitam a saída do adversário. Execute a tomada de espaço e um peek protegido. Registre quantas de dez tentativas terminaram sem exposição desnecessária.",
    metric: "Tentativas controladas em 10 — autoavaliação",
    source_url: "https://www.fortnite.com/@jivantv/7037-5244-5527",
    verified_at: verified,
    published: true,
  },
  {
    id: uid(4),
    title: "Rotações sob pressão",
    creator: "jivantv",
    map_code: "5473-5965-0108",
    category: "competitive",
    mode: "build",
    level: "advanced",
    description: "Pratique o processo de decisão durante o avanço da zona.",
    instructions:
      "No Forever Zone Wars, jogue um bloco de rodadas. Antes de mover, observe cobertura, recursos e direção da zona. Ao terminar, anote uma decisão que funcionou e uma que expôs você. A simulação não reproduz integralmente um torneio real.",
    metric: "Rotações com cobertura em 10 — autoavaliação",
    source_url: "https://www.fortnite.com/@jivantv/5473-5965-0108",
    verified_at: verified,
    published: true,
  },
  {
    id: uid(5),
    title: "Freebuild com objetivo",
    creator: "reisshub",
    map_code: "4175-6046-6184",
    category: "mechanics",
    mode: "build",
    level: "beginner",
    description: "Treine uma sequência curta de construção e edição.",
    instructions:
      "No Training Hub V2, escolha a área de freebuild. Defina uma sequência pequena com construção, edição e reset. Repita com precisão. No controle, ajuste o ritmo aos seus binds; no teclado e mouse, observe deslocamentos desnecessários. Não altere sensibilidade a cada erro.",
    metric: "Sequências sem erro em 10",
    source_url: "https://www.fortnite.com/@reisshub/4175-6046-6184",
    verified_at: verified,
    published: true,
  },
  {
    id: uid(6),
    title: "Revisão de uma decisão",
    creator: "Método editorial",
    map_code: null,
    category: "vod",
    mode: "both",
    level: "beginner",
    description: "Transforme uma eliminação em uma hipótese de treino.",
    instructions:
      "Reveja uma gravação própria. Pause antes da eliminação. Liste as informações disponíveis naquele momento, duas alternativas e a decisão tomada. Identifique um erro observável, sem avaliar apenas o resultado. Escolha um exercício para testar a alternativa.",
    metric: "Decisões revisadas — quantidade",
    source_url: "https://www.fortnite.com/competitive",
    verified_at: verified,
    published: true,
  },
  {
    id: uid(7),
    title: "Cobertura e disengage",
    creator: "Método editorial",
    map_code: null,
    category: "decisions",
    mode: "zero",
    level: "beginner",
    description: "Avalie caminhos entre coberturas em Construção Zero.",
    instructions:
      "Em uma gravação própria de Zero Build, pause antes de três deslocamentos. Identifique a próxima cobertura, uma rota alternativa e um caminho de recuo. Considere mobilidade e recursos disponíveis na versão atual. Não registre esses resultados como desempenho de mapa de mira.",
    metric: "Decisões com alternativa em 3 — autoavaliação",
    source_url: "https://www.fortnite.com/competitive",
    verified_at: verified,
    published: true,
  },
  {
    id: uid(8),
    title: "Shotgun: mira antes do tiro",
    creator: "raider464",
    map_code: "2424-4344-7824",
    category: "aim",
    mode: "both",
    level: "intermediate",
    description: "Pratique posicionar a mira e confirmar o alvo.",
    instructions:
      "Escolha um exercício de mira compatível no Mechanics Training V5. Use a mesma arma, distância e cenário entre sessões. Registre acertos em dez tentativas. O foco é a relação entre precisão e exposição; números deste exercício não são comparáveis aos de tracking.",
    metric: "Acertos em 10 — mesmo cenário",
    source_url: "https://www.fortnite.com/@raider464/2424-4344-7824",
    verified_at: verified,
    published: true,
  },
];
const articles: Article[] = [
  {
    id: uid(101),
    slug: "fncs-solo-outubro-2026",
    title: "FNCS Solo entra no calendário de outubro",
    kind: "news",
    category: "fncs",
    summary:
      "A Epic anunciou uma competição Solo regional após o Campeonato Global de 2026.",
    body: "O anúncio oficial de 29 de maio de 2026 incluiu um torneio FNCS Solo independente em outubro. Esta notícia registra o anúncio, não resultados ou elegibilidade individual.\n\nA programação regional consultada em 10 de outubro lista Fast Track e classificatórias nessa data. Os horários extraídos não tinham fuso explícito: confira a aba Competir no jogo e o calendário oficial antes de organizar sua participação.\n\nHá regulamento específico para FNCS Solo 2026. Critérios, fases e pontuação devem ser conferidos nessa versão, sem transplantar regras dos Majors em Duplas.",
    author: "Redação",
    source_url:
      "https://www.fortnite.com/news/fncs-schedule-and-competitive-updates?lang=pt-BR",
    verified_at: verified,
    published_at: verified,
    valid_until: "2026-10-12T03:00:00Z",
    published: true,
  },
  {
    id: uid(102),
    slug: "revisar-sem-culpar-resultado",
    title: "VOD review: encontre a decisão antes do erro",
    kind: "analysis",
    category: "vod",
    summary:
      "Uma estrutura prática para transformar gravações próprias em exercícios.",
    body: "Objetivo: formular uma hipótese que você consiga testar no próximo treino. Nível: todos.\n\n1. Escolha uma luta ou rotação curta, em uma gravação sua.\n2. Pause antes de conhecer o resultado. Quais informações estavam disponíveis?\n3. Anote duas alternativas possíveis e o custo de cada uma.\n4. Identifique uma ação observável: exposição, recurso gasto ou rota sem cobertura.\n5. Transforme a observação em uma tarefa. Por exemplo: praticar dez peeks com menor exposição.\n\nEsta é uma proposta editorial de organização. Uma decisão boa pode terminar mal, e um resultado positivo pode esconder uma decisão arriscada. Não é um método validado especificamente em Fortnite.",
    author: "Redação",
    source_url: "https://www.fortnite.com/competitive",
    verified_at: verified,
    published_at: verified,
    valid_until: null,
    published: true,
  },
  {
    id: uid(103),
    slug: "pratica-e-recuperacao",
    title: "Prática distribuída, sono e limites da evidência",
    kind: "lesson",
    category: "wellbeing",
    summary: "Organize sessões sustentáveis sem promessas de ganho garantido.",
    body: "Objetivo: construir uma rotina que caiba na sua vida. Nível: todos.\n\nUm estudo em MOBA investigou a relação entre distribuição da prática e desempenho. Esse contexto não demonstra um efeito idêntico em Fortnite. Pesquisas laboratoriais sobre sono e aprendizagem motora também não determinam uma duração ideal de treino neste jogo.\n\nUse as rotinas de 30, 45 ou 60 minutos como pontos de partida ajustáveis. Faça pausas se perceber fadiga, desconforto ou perda de atenção. Preserve sono, escola, trabalho e atividades físicas. Descansar não remove XP nem conquistas.\n\nA plataforma oferece informação educativa, não diagnóstico ou prescrição de saúde. Em caso de dor persistente ou alteração do sono, procure orientação profissional. Referência adicional: https://pubmed.ncbi.nlm.nih.gov/12123620/",
    author: "Redação",
    source_url: "https://pubmed.ncbi.nlm.nih.gov/36240151/",
    verified_at: verified,
    published_at: verified,
    valid_until: null,
    published: true,
  },
  {
    id: uid(104),
    slug: "fundamentos-peek",
    title: "O que observar em um right-hand peek",
    kind: "lesson",
    category: "piece",
    summary: "Controle a exposição antes de buscar velocidade.",
    body: "Objetivo: observar como posição e câmera afetam a exposição. Nível: iniciante e intermediário.\n\nNo Fortnite em terceira pessoa, a posição relativa entre câmera, cobertura e adversário influencia o quanto você precisa se expor. Compare dois ângulos e observe o que o adversário consegue ver. Não trate um right-hand peek como proteção absoluta.\n\nEm Construção, combine posicionamento com edição e reset. Em Zero Build, compare coberturas existentes e alternativas de recuo. Registre tentativas com o mesmo cenário e observe a consistência.\n\nPrática sugerida: Piece control e peeks. A ilha oficial de Jivan contém cenários para controle de peças; o procedimento desta aula é uma proposta editorial, sem promessa de ganhos.",
    author: "Redação",
    source_url: "https://www.fortnite.com/@jivantv/7037-5244-5527",
    verified_at: verified,
    published_at: verified,
    valid_until: null,
    published: true,
  },
];
const official =
  "https://www.fortnite.com/competitive/events/S36_FNCSMajor3_LCQ/schedule?lang=en-US&region=BR";
const tournaments: Tournament[] = [
  {
    id: uid(201),
    slug: "fncs-solo-fast-track-br-10-out",
    title: "FNCS Solos Fast Track",
    category: "FNCS",
    mode: "build",
    region: "BR",
    format: "Solo",
    start_date: "2026-10-10",
    end_date: "2026-10-10",
    starts_at: null,
    ends_at: null,
    status: "scheduled",
    description:
      "Evento listado na programação oficial regional em 10 de outubro. Horário sem fuso confirmado nesta consulta.",
    rules:
      "Consulte o regulamento oficial FNCS Solo 2026. A plataforma não confirma sua elegibilidade, pontuação ou classificação.",
    prize: "Não transcrita; consulte o regulamento.",
    source_url: official,
    verified_at: verified,
    valid_until: "2026-10-11T03:00:00Z",
    published: true,
  },
  {
    id: uid(202),
    slug: "fncs-solo-qualifiers-br-10-out",
    title: "FNCS Solos Qualifiers",
    category: "FNCS",
    mode: "build",
    region: "BR",
    format: "Solo",
    start_date: "2026-10-10",
    end_date: "2026-10-10",
    starts_at: null,
    ends_at: null,
    status: "scheduled",
    description:
      "Classificatórias listadas no calendário oficial da região BR. Consulte o horário no jogo.",
    rules:
      "Há regulamento específico. Verifique fases, critérios, restrições etárias e consentimento do responsável quando aplicável na fonte oficial.",
    prize: "Não transcrita; consulte o regulamento.",
    source_url: official,
    verified_at: verified,
    valid_until: "2026-10-11T03:00:00Z",
    published: true,
  },
  {
    id: uid(203),
    slug: "ranked-duos-zero-br-10-out",
    title: "Duos Ranked Cup · Zero Build",
    category: "Ranked Cup",
    mode: "zero",
    region: "BR",
    format: "Dupla",
    start_date: "2026-10-10",
    end_date: "2026-10-10",
    starts_at: null,
    ends_at: null,
    status: "scheduled",
    description:
      "Evento Zero Build listado na programação regional consultada. Dados editoriais, sem sincronização automática.",
    rules:
      "Confira o regulamento do evento, as restrições de plataforma e os requisitos na aba Competir.",
    prize: "Não confirmada nesta consulta.",
    source_url: official,
    verified_at: verified,
    valid_until: "2026-10-11T03:00:00Z",
    published: true,
  },
  {
    id: uid(204),
    slug: "global-2026",
    title: "FNCS Global Championship 2026",
    category: "FNCS",
    mode: "build",
    region: "GLOBAL",
    format: "Dupla",
    start_date: "2026-09-26",
    end_date: "2026-09-27",
    starts_at: null,
    ends_at: null,
    status: "finished",
    description:
      "Evento em Antuérpia, Bélgica, nas datas anunciadas pela Epic. Resultados ainda não cadastrados nesta plataforma.",
    rules:
      "O anúncio informa 50 Duplas e 12 partidas ao longo de dois dias. Consulte regras e resultados na fonte oficial.",
    prize: "US$ 2.000.000 anunciados pela Epic.",
    source_url:
      "https://www.fortnite.com/competitive/fncs-2026-overview?lang=pt-BR&region=BR",
    verified_at: verified,
    valid_until: "2026-10-11T03:00:00Z",
    published: true,
  },
];
export const seed: Catalog = {
  exercises: [
    ...exercises.map((e) =>
      e.id === uid(5)
        ? {
            ...e,
            skills: ["aim", "editing", "piece control"],
            competitive_goal:
              "Revisar execução com opções consistentes antes de treinos de construção.",
            map_type: "Hub de exercícios",
            requirements: "Fortnite Criativo; registrar cenário e opções.",
          }
        : e.id === uid(2)
          ? {
              ...e,
              skills: ["editing", "resets"],
              competitive_goal: "Consistência em sequências de edição.",
              map_type: "Hub de mecânicas",
              requirements: "Fortnite Criativo; manter a mesma sequência.",
            }
          : e,
    ),
    ...competitiveSeed.exercises.filter(
      (e) => !exercises.some((x) => x.map_code === e.map_code),
    ),
    ...trainingCatalog,
  ],
  articles: [...articles, ...competitiveSeed.articles],
  tournaments: [
    ...tournaments.map((t) =>
      t.id === uid(204)
        ? {
            ...t,
            result_summary:
              "SwizzY e Pixie conquistaram o Global 2026, segundo comunicado da Team Vitality publicado em 28 de setembro. Fonte: organização participante; classificação completa e pontos não cadastrados.",
            result_source_url:
              "https://vitality.gg/en-eu/blogs/presse/havok-by-vitality-remporte-le-fortnite-global-championship-2026",
            result_verified_at: verified,
          }
        : t,
    ),
    ...competitiveSeed.tournaments,
  ],
};
export function emptyPlayer(): PlayerData {
  return {
    profile: null,
    plans: [],
    schedules: [],
    sessions: [],
    goals: [],
    xp: [],
    bookmarks: [],
    series: [],
    exceptions: [],
    journals: [],
    skillReviews: [],
    planningPreferences: [],
    weeklyReports: [],
    vodReviews: [],
    goalRevisions: [],
    readiness: [],
  };
}
export function demoPlayer(): PlayerData {
  return {
    ...emptyPlayer(),
    profile: {
      id: "demo",
      display_name: "Jogador",
      mode: "build",
      level: "intermediate",
      objective: "mechanics",
      minutes: 30,
      input: "kbm",
      timezone: "America/Sao_Paulo",
      onboarded: false,
      reminder_enabled: true,
    },
  };
}
