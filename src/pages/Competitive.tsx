import { CompetitivePreferences } from "../components/CompetitivePreferences";
import { currentEvent, recentArticles } from "../lib/competitive";
import { dateInZone } from "../lib/calendar";
import { CompetitionPreparation } from "../components/CompetitionPreparation";
import { TournamentPhases } from "../components/TournamentPhases";
import { CoachAccess } from "../components/CoachAccess";
import { useSEO } from "../lib/seo";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarPlus,
  Download,
  Heart,
  Search,
  Trophy,
} from "lucide-react";
import { useStore } from "../lib/store";
import {
  dateLabel,
  download,
  eventStatus,
  isStale,
  timeLabel,
  tournamentICS,
} from "../lib/logic";
import type { Tournament } from "../lib/types";
import { labels } from "../lib/types";
import { Badge, Empty, Heading, Modal, Source } from "../components/ui";
import { Calendar } from "../components/Calendar";
const statuses: Record<string, string> = {
  scheduled: "Programado",
  finished: "Finalizado",
  live: "Em andamento",
  postponed: "Adiado",
  cancelled: "Cancelado",
};
export default function Competitive() {
  const s = useStore();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");
  const [mode, setMode] = useState("all");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState("overview");
  const [preferred, setPreferred] = useState<string[]>(["BR"]);
  const [prep, setPrep] = useState<Tournament | null>(null);
  const [phaseKey, setPhaseKey] = useState<string | undefined>();
  const selected = s.catalog.tournaments.find((t) => t.slug === slug);
  const bookmarked = (id: string) =>
    s.data.bookmarks.find((b) => b.kind === "tournament" && b.target_id === id);
  const toggle = (id: string) =>
    s.run(async () => {
      if (!s.data.profile) {
        navigate("/auth");
        return;
      }
      const b = bookmarked(id);
      if (b) await s.remove("bookmarks", b.id);
      else
        await s.save("bookmarks", {
          id: crypto.randomUUID(),
          user_id: s.data.profile.id,
          kind: "tournament",
          target_id: id,
        });
    });
  const prepare = (t: Tournament) => {
    if (!s.data.profile) {
      navigate("/auth");
      return;
    }
    setPrep(t);
    setPhaseKey(undefined);
  };
  const card = (t: Tournament) => (
    <article className="tournament-card panel" key={t.id}>
      <div className="event-art">
        <Trophy size={34} />
        <span>{t.category}</span>
        <small>
          {t.region} / {t.format}
        </small>
      </div>
      <div className="tournament-content">
        <div className="row between">
          <Badge tone={eventStatus(t) === "live" ? "green" : "neutral"}>
            {t.confirmation === "unconfirmed"
              ? "Não confirmado"
              : statuses[eventStatus(t)]}
          </Badge>
          <button
            className="icon-button"
            aria-label={`Favoritar ${t.title}`}
            disabled={s.busy}
            onClick={() => toggle(t.id)}
          >
            <Heart
              size={16}
              fill={bookmarked(t.id) ? "currentColor" : "none"}
            />
          </button>
        </div>
        <Link to={"/competitive/" + t.slug}>
          <h3>{t.title}</h3>
        </Link>
        <p>
          {dateLabel(t.start_date)} · {labels[t.mode]}
        </p>
        <span className="small-text muted">
          {t.starts_at
            ? timeLabel(
                t.starts_at,
                s.data.profile?.timezone ||
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
              )
            : "Horário: consulte a fonte oficial"}
        </span>
        <Source
          url={t.source_url}
          date={t.verified_at}
          stale={isStale(t.verified_at, t.valid_until)}
        />
      </div>
    </article>
  );

  useSEO(
    selected?.title || "Central competitiva",
    selected?.description || "Campeonatos com fonte, data e contexto.",
  );
  if (slug && !selected)
    return <Empty title="Campeonato não encontrado" to="/competitive" />;
  const prepModal = prep && (
    <Modal
      title="Preparar um treino para este evento"
      onClose={() => setPrep(null)}
    >
      <CompetitionPreparation event={prep} phaseKey={phaseKey} />
    </Modal>
  );
  if (selected)
    return (
      <>
        <Link to="/competitive" className="text-link">
          <ArrowLeft size={16} />
          Central competitiva
        </Link>
        <CoachAccess
          question={`Como funciona o formato de ${selected.title}?`}
          tournamentId={selected.id}
          label="Preparar com o Coach"
        />
        <Heading
          eyebrow={`${selected.category} / ${selected.region}`}
          title={selected.title}
          description={selected.description}
          action={<Badge>{statuses[eventStatus(selected)]}</Badge>}
        />
        <div className="detail-grid">
          <article className="panel article-body">
            <div className="event-art large">
              <Trophy size={60} />
              <span>{selected.category}</span>
              <small>
                {selected.format} / {selected.region}
              </small>
            </div>
            <div className="event-facts">
              <div>
                <small>Data</small>
                <strong>
                  {dateLabel(selected.start_date)}
                  {selected.end_date !== selected.start_date
                    ? " a " + dateLabel(selected.end_date)
                    : ""}
                </strong>
              </div>
              <div>
                <small>Horário</small>
                <strong>
                  {selected.starts_at
                    ? timeLabel(
                        selected.starts_at,
                        s.data.profile?.timezone ||
                          Intl.DateTimeFormat().resolvedOptions().timeZone,
                      )
                    : "Sem fuso confirmado"}
                </strong>
              </div>
              <div>
                <small>Modalidade</small>
                <strong>{labels[selected.mode]}</strong>
              </div>
              <div>
                <small>Formato</small>
                <strong>{selected.format}</strong>
              </div>
            </div>
            <h2>Regras e participação</h2>
            <p>{selected.rules}</p>
            <a
              className="text-link"
              href="https://www.fortnite.com/competitive/rules-guidelines/rules-library"
              target="_blank"
              rel="noopener noreferrer"
            >
              Biblioteca oficial de regulamentos
              <ArrowUpRight size={16} />
            </a>
            <h2>Premiação</h2>
            <p>{selected.prize}</p>
            <TournamentPhases
              event={selected}
              timezone={
                s.data.profile?.timezone ||
                Intl.DateTimeFormat().resolvedOptions().timeZone
              }
              onAdd={(key) => {
                prepare(selected);
                setPhaseKey(key);
              }}
            />
            <h2>Resultados e classificação</h2>
            {selected.result_summary ? (
              <>
                <p>{selected.result_summary}</p>
                <Source
                  url={selected.result_source_url!}
                  date={selected.result_verified_at!}
                />
              </>
            ) : (
              <p>
                Não há resultados verificados cadastrados para este evento.
                Consulte a fonte oficial.
              </p>
            )}
            <Source
              url={selected.source_url}
              date={selected.verified_at}
              stale={isStale(selected.verified_at, selected.valid_until)}
            />
            {isStale(selected.verified_at, selected.valid_until) && (
              <div className="alert">
                Este registro precisa de revisão. Confirme datas e regras na
                fonte original antes de se planejar.
              </div>
            )}
          </article>
          <aside id="preparar" className="panel detail-aside">
            <span className="eyebrow">DO CONTEXTO À PRÁTICA</span>
            <h3>Prepare sua próxima sessão.</h3>
            <p>
              Conecte o campeonato ao seu planejamento sem sobrecarregar sua
              semana.
            </p>
            <button
              className="button primary full"
              onClick={() => prepare(selected)}
            >
              <CalendarPlus size={16} />
              Preparar para competição
            </button>
            <button
              className="button full"
              disabled={s.busy}
              onClick={() => toggle(selected.id)}
            >
              <Heart size={16} />
              {bookmarked(selected.id)
                ? "Remover favorito"
                : "Salvar campeonato"}
            </button>
            <button
              className="button full"
              onClick={() =>
                download(
                  tournamentICS(selected),
                  selected.slug + ".ics",
                  "text/calendar",
                )
              }
            >
              <Download size={16} />
              Exportar calendário
            </button>
            <p className="muted small-text">
              {selected.starts_at
                ? "Horário exportado em UTC, convertido pelo seu calendário."
                : "Sem horário confirmado: a exportação cria um evento de dia inteiro."}
            </p>
            <a
              className="text-link"
              href={selected.source_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver programação oficial
              <ArrowUpRight size={16} />
            </a>
            <Link to="/academy" className="text-link">
              Estudar fundamentos
              <ArrowRight size={16} />
            </Link>
          </aside>
        </div>
        {prepModal}
      </>
    );
  const list = s.catalog.tournaments.filter(
    (t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) &&
      (region === "all" || t.region === region) &&
      (mode === "all" || t.mode === mode) &&
      (category === "all" || t.category === category) &&
      (view !== "preferred" || preferred.includes(t.region)),
  );
  return (
    <>
      <CoachAccess
        question="Qual campeonato salvei para esta semana?"
        label="Consultar favoritos com o Coach"
      />
      <Heading
        eyebrow="CENTRAL COMPETITIVA"
        title="Entenda o cenário. Prepare seu jogo."
        description="Campeonatos, contexto e fontes. Tudo conectado ao seu desenvolvimento."
        action={
          <a
            className="button"
            href="https://www.fortnite.com/competitive"
            target="_blank"
            rel="noopener noreferrer"
          >
            Portal oficial
            <ArrowUpRight size={16} />
          </a>
        }
      />
      <div className="competitive-hero panel">
        <div>
          <Badge tone="green">FNCS · CONTEXTO 2026</Badge>
          <h2>
            O cenário muda.
            <br />
            Seu plano acompanha.
          </h2>
          <p>
            Consulte os eventos registrados, confira regulamentos e transforme
            preparação em uma sessão com objetivo.
          </p>
          <Link className="button primary" to="/app/planner">
            Organizar minha preparação
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="competitive-symbol" aria-hidden="true">
          <Trophy size={120} />
          <span>
            COMPETE
            <br />
            WITH INTENT
          </span>
        </div>
      </div>
      <div className="alert">
        Curadoria manual. A lista não cobre todos os torneios e não oferece
        atualização em tempo real. Cada evento mostra fonte e data de
        verificação.
      </div>
      <CompetitivePreferences onChange={setPreferred} />
      {view === "overview" && (
        <section className="competitive-intelligence">
          <div className="two-grid">
            <div className="panel">
              <span className="eyebrow">PRÓXIMAS SESSÕES VERIFICADAS</span>
              {s.catalog.tournaments
                .filter((t) => currentEvent(t))
                .flatMap((t) =>
                  (t.phases || [])
                    .filter(
                      (p) =>
                        p.status === "scheduled" &&
                        p.date >= new Date().toISOString().slice(0, 10) &&
                        !isStale(p.verified_at, p.valid_until),
                    )
                    .map((p) => ({ t, p })),
                )
                .sort((a, b) => a.p.date.localeCompare(b.p.date))
                .slice(0, 4)
                .map(({ t, p }) => (
                  <Link
                    className="list-row"
                    key={t.id + p.key}
                    to={"/competitive/" + t.slug}
                  >
                    <div>
                      <strong>
                        {p.title} · {t.region}
                      </strong>
                      <small>
                        {dateLabel(p.date)} ·{" "}
                        {p.starts_at
                          ? "horário confirmado"
                          : "sem horário confirmado"}
                      </small>
                    </div>
                  </Link>
                ))}
            </div>
            <div className="panel">
              <span className="eyebrow">EM ANDAMENTO</span>
              {s.catalog.tournaments.filter((t) => eventStatus(t) === "live")
                .length ? (
                s.catalog.tournaments
                  .filter((t) => eventStatus(t) === "live")
                  .map(card)
              ) : (
                <p>
                  Nenhuma sessão em andamento foi confirmada nos registros
                  disponíveis.
                </p>
              )}
              <Link
                to="/competitive"
                onClick={() => setView("favorites")}
                className="text-link"
              >
                Conferir meus favoritos
              </Link>
            </div>
          </div>
          <h2>Resultados e organizações · fontes identificadas</h2>
          <div className="two-grid">
            {recentArticles(s.catalog.articles)
              .filter(
                (a) => a.topic === "results" || a.topic === "organizations",
              )
              .slice(0, 2)
              .map((a) => (
                <Link key={a.id} to={"/news/" + a.slug} className="panel">
                  <Badge>Comunicado da organização</Badge>
                  <h3>{a.title}</h3>
                  <p>{a.summary}</p>
                  <small>
                    {dateLabel(a.published_at)} · verificado{" "}
                    {dateLabel(a.verified_at)}
                  </small>
                </Link>
              ))}
          </div>
        </section>
      )}
      <div className="tabs page-tabs">
        {[
          ["overview", "Visão geral"],
          ["calendar", "Calendário"],
          ["favorites", "Salvos"],
          ["preferred", "Minhas regiões"],
        ].map(([v, l]) => (
          <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
            {l}
          </button>
        ))}
      </div>
      <div className="filters panel">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Buscar campeonatos"
            value={query}
            placeholder="Buscar campeonato…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Região"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="all">Todas as regiões</option>
          {Array.from(new Set(s.catalog.tournaments.map((t) => t.region))).map(
            (r) => (
              <option key={r}>{r}</option>
            ),
          )}
        </select>
        <select
          aria-label="Modalidade"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="all">Todas as modalidades</option>
          <option value="build">Construção</option>
          <option value="zero">Zero Build</option>
        </select>
        <select
          aria-label="Tipo de competição"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Todos os tipos</option>
          {Array.from(
            new Set(s.catalog.tournaments.map((t) => t.category)),
          ).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      {view === "calendar" ? (
        <Calendar
          items={list.flatMap((t) =>
            t.phases?.length
              ? t.phases.map((p) => ({
                  id: t.id + "-" + p.key,
                  date: p.starts_at
                    ? dateInZone(
                        p.starts_at,
                        s.data.profile?.timezone ||
                          Intl.DateTimeFormat().resolvedOptions().timeZone,
                      )
                    : p.date,
                  title: t.title + " · " + p.title,
                  tone: "purple",
                  onClick: () => navigate("/competitive/" + t.slug),
                }))
              : [
                  {
                    id: t.id,
                    date: t.starts_at
                      ? dateInZone(
                          t.starts_at,
                          s.data.profile?.timezone ||
                            Intl.DateTimeFormat().resolvedOptions().timeZone,
                        )
                      : t.start_date,
                    title: t.title,
                    tone: "purple",
                    onClick: () => navigate("/competitive/" + t.slug),
                  },
                ],
          )}
        />
      ) : (
        <>
          <div className="section-title outside">
            <h2>
              {view === "favorites"
                ? "Seus campeonatos salvos"
                : "Eventos registrados"}
            </h2>
            <small className="muted">
              Horários desconhecidos não são convertidos
            </small>
          </div>
          <div className="three-grid">
            {list
              .filter((t) => view !== "favorites" || bookmarked(t.id))
              .map(card)}
          </div>
          {!list.filter((t) => view !== "favorites" || bookmarked(t.id))
            .length && (
            <Empty title="Nenhum campeonato nesta seleção">
              Ajuste os filtros ou salve um evento.
            </Empty>
          )}
        </>
      )}
      <div className="section-title outside">
        <h2>Contexto para o próximo passo</h2>
        <Link to="/news">
          Notícias e análises
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="two-grid">
        {s.catalog.articles
          .filter((a) => a.kind !== "lesson")
          .sort((a, b) => b.published_at.localeCompare(a.published_at))
          .slice(0, 4)
          .map((a) => (
            <Link
              className="panel editorial-mini"
              to={"/news/" + a.slug}
              key={a.id}
            >
              <Badge>
                {a.kind === "news" ? "Notícia" : "Análise editorial"}
              </Badge>
              <h3>{a.title}</h3>
              <p>{a.summary}</p>
              <span className="text-link">
                Ler contexto
                <ArrowRight size={16} />
              </span>
            </Link>
          ))}
      </div>
      {prepModal}
    </>
  );
}
