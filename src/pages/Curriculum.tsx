import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import {
  curriculumLessons,
  searchLessons,
  levelNames,
  phaseNames,
} from "../lib/curriculum";
import { useSEO } from "../lib/seo";
import { isStale } from "../lib/logic";
import { Heading, Badge, Empty } from "../components/ui";
export default function Curriculum() {
  const s = useStore();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [mode, setMode] = useState("all");
  const [phase, setPhase] = useState("all");
  const [experience, setExperience] = useState("all");
  useSEO(
    "Fortnite: fundamentos e prática avançada",
    "Aulas originais por nível editorial, modalidade e fase, com pré-requisitos flexíveis, fontes e atividades de avaliação.",
  );
  const lessons = curriculumLessons(s.catalog.articles);
  const list = searchLessons(s.catalog.articles, {
    query,
    level,
    mode,
    phase,
    experience,
  });
  return (
    <>
      <Link className="text-link" to="/academy">
        Voltar à Academy
      </Link>
      <Heading
        eyebrow="PERCURSO DE ESTUDO"
        title="Do primeiro contato à decisão competitiva."
        description="Escolha o que precisa compreender, pratique com intenção e revise. Os níveis são uma organização editorial; não são ranks oficiais ou uma medida universal de habilidade."
      />
      <div className="panel">
        <h2>Comece pelo seu contexto.</h2>
        <p>
          Os pré-requisitos sugerem uma sequência. Se você já conhece as bases,
          pode abrir qualquer aula diretamente. Construção Zero tem um percurso
          próprio e fundamentos compartilhados.
        </p>
        <p className="muted">
          A cobertura ainda é parcial. Não há análise audiovisual de vídeos nem
          testes dentro do Fortnite nesta curadoria. Informações dependentes de
          temporada precisam de nova verificação.
        </p>
        <Link className="text-link" to="/academy/research?view=sources">
          Consultar ciência, evidências e limites
        </Link>
      </div>
      <div className="filters panel curriculum-filters">
        <label>
          Buscar aula
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex.: mats, rotação, Reload"
          />
        </label>
        <label>
          Nível de estudo
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="all">Todos</option>
            {levelNames.map((n, i) => (
              <option key={i} value={i}>
                {i} · {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Modalidade de estudo
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="all">Todas</option>
            <option value="build">Construção</option>
            <option value="zero">Construção Zero</option>
          </select>
        </label>
        <label>
          Experiência
          <select
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
          >
            <option value="all">Todas</option>
            <option value="br">Battle Royale</option>
            <option value="reload">Reload / Trocação Reload</option>
          </select>
        </label>
        <label>
          Fase estudada
          <select value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="all">Todas</option>
            {Object.entries(phaseNames).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p role="status">
        {list.length} aulas encontradas · {lessons.length} aulas curriculares
        disponíveis
      </p>
      <div className="curriculum-index">
        {list.map((a) => (
          <article className="panel" key={a.id}>
            <span className="eyebrow">
              NÍVEL {a.curriculum!.level} · {levelNames[a.curriculum!.level]}
            </span>
            <h2>
              <Link to={`/academy/${a.slug}`}>{a.title}</Link>
            </h2>
            <p>{a.summary}</p>
            <div className="row">
              <Badge>{phaseNames[a.curriculum!.phase]}</Badge>
              <Badge>
                {a.curriculum!.modes.length === 2
                  ? "Fundamento compartilhado"
                  : a.curriculum!.modes[0] === "build"
                    ? "Construção"
                    : "Construção Zero"}
              </Badge>
            </div>
            {isStale(a.verified_at, a.valid_until) && (
              <p className="alert">
                Revisão pendente. Confira as fontes antes de aplicar regras ou
                parâmetros.
              </p>
            )}
            <details>
              <summary>O que vou aprender?</summary>
              <ul>
                {a.curriculum!.objectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </details>
            <Link className="text-link" to={`/academy/${a.slug}`}>
              Estudar e avaliar a prática
            </Link>
          </article>
        ))}
      </div>
      {!list.length && (
        <Empty title="Nenhuma aula neste recorte">
          Ajuste os filtros. Uma área sem aula não significa que a habilidade
          seja irrelevante ou que você já a domine.
        </Empty>
      )}
    </>
  );
}
