import type { Reference } from "./domain.ts";
const epic =
  "https://dev.epicgames.com/documentation/fortnite/fortnite-glossary";
const community = "https://fortnite.fandom.com/wiki/Community_Terminology";
const endgame =
  "https://dignitas.gg/articles/how-to-actually-win-endgames-in-fortnite";
const rules =
  "https://www.fortnite.com/competitive/rules-guidelines/rules-library";
// Curated explanations. Community vocabulary is not an official rules source.
export const knowledge = [
  [
    "aim",
    "Aim",
    "Precisão de mira. Diferencie acerto de shotgun de rastrear continuamente um alvo.",
    epic,
  ],
  [
    "tracking",
    "Tracking",
    "Acompanhar um alvo em movimento com a mira; compare sempre o mesmo cenário.",
    epic,
  ],
  [
    "shotgun",
    "Shotgun accuracy",
    "Precisão com shotgun: posicionamento da mira, janela de exposição e execução do disparo. Avalie acertos em condições iguais.",
    epic,
  ],
  [
    "piece",
    "Piece Control",
    "Controle das construções que limitam opções do adversário. É específico do modo com construção.",
    community,
  ],
  [
    "box fight",
    "Box Fights",
    "Confrontos em espaços construídos com disputa de paredes, edições e exposição protegida; específico de Build.",
    community,
  ],
  [
    "realistic",
    "Realistics",
    "Cenários de combate que procuram aproximar situações de partida. O resultado do mapa não equivale ao de um torneio.",
    community,
  ],
  [
    "freebuild",
    "Freebuild",
    "Prática livre de construção e edição, sem adversário; priorize uma sequência observável em Build.",
    community,
  ],
  [
    "rot",
    "Rotations",
    "Deslocamento para posições futuras da zona, considerando cobertura, recursos e risco.",
    endgame,
  ],
  [
    "deadside",
    "Deadside",
    "Lado da zona com menor concentração estimada de jogadores. É uma leitura situacional, sem rota sempre segura.",
    community,
  ],
  [
    "surge",
    "Surge",
    "Storm Surge é uma mecânica competitiva ligada a dano e população remanescente. Limiares e regras precisam de verificação atual.",
    rules,
  ],
  [
    "refresh",
    "Refresh",
    "Obtenção de recursos e loot de jogadores eliminados; avalie o risco antes de buscar uma luta.",
    community,
  ],
  [
    "tarp",
    "Tarping",
    "Construção de um túnel de proteção durante o deslocamento; específico de Build.",
    community,
  ],
  [
    "endgame",
    "Endgame",
    "Fase final da partida: posição, recursos, deslocamento e decisões sob pressão. Revise um momento concreto no VOD.",
    endgame,
  ],
  [
    "vod",
    "VOD Review",
    "Revisão de gravação: escolha um momento, descreva a decisão, suas opções e uma alternativa testável.",
    epic,
  ],
  [
    "cash cup",
    "Cash Cups",
    "Competições com premiação cujos requisitos e formatos variam. Consulte as regras oficiais do evento.",
    rules,
  ],
  [
    "fncs",
    "FNCS",
    "Fortnite Championship Series. Formato, elegibilidade e calendário dependem das regras vigentes.",
    rules,
  ],
  [
    "ranked",
    "Ranked",
    "Modo ranqueado do Fortnite; o XP do kyrven não representa o ranque do jogo.",
    "https://www.fortnite.com/competitive/discover-competitive/fortnite-ranked-play-explained",
  ],
  [
    "zero build",
    "Zero Build",
    "Modalidade sem construção. Priorize cobertura, movimentação, mira e decisões; piece control e tarping não se aplicam da mesma forma.",
    epic,
  ],
] as const;
export function retrieve(message: string) {
  const text = message.toLowerCase();
  const selected = knowledge.filter((k) => text.includes(k[0])).slice(0, 4);
  return {
    definitions: selected.map((k) => `${k[1]}: ${k[2]}`),
    references: selected.map(
      (k) =>
        ({
          id: "glossary:" + k[0],
          title:
            k[1] +
            " · " +
            (k[3] === community
              ? "terminologia comunitária"
              : k[3] === endgame
                ? "Dignitas · orientação editorial"
                : "Epic Games"),
          url: k[3],
          verified_at: "2026-10-10",
        }) satisfies Reference,
    ),
  };
}
