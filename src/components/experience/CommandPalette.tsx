import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowUpRight } from "lucide-react";
import { Modal } from "../ui";
import { useStore } from "../../lib/store";
export function CommandPalette() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, []);
  const entries = [
    ...[
      ["Exercícios", "/library"],
      ["Competitivo", "/competitive"],
      ["kyrven academy", "/academy"],
      ["Notícias", "/news"],
      ["Ajuda", "/help"],
      ["Fortnite Knowledge", "/knowledge"],
    ].map(([title, url]) => ({ title, url, kind: "Explorar" })),
    ...(s.data.profile
      ? [
          ["Road to Competitive", "/app/road"],
          ["Meu Dia", "/app"],
          ["Planejador", "/app/planner"],
          ["Training Center", "/app/training"],
          ["Criar meu plano de evolução", "/app/evolution-plan"],
          ["Meta Training Center", "/app/meta-training"],
          ["Minhas equipes", "/app/teams"],
          ["kyrven coach", "/app/coach"],
          ["Minha Evolução", "/app/evolution"],
          ["Relatórios", "/app/reports"],
          ["VOD Review", "/app/vod"],
          ["Perfil", "/app/profile"],
        ].map(([title, url]) => ({ title, url, kind: "Meu espaço" }))
      : []),
    ...s.catalog.exercises.map((e) => ({
      title: e.title,
      url: "/library/" + e.id,
      kind: "Exercício",
    })),
  ];
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const results = entries
    .filter((e) => normalize(e.title).includes(normalize(query.trim())))
    .slice(0, 12);
  return (
    <>
      <button
        className="button small search-trigger"
        aria-label="Buscar na plataforma"
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
      >
        <Search size={17} />
        <span>Buscar</span>
        <kbd>Ctrl K</kbd>
      </button>
      {open && (
        <Modal
          title="Buscar na plataforma"
          onClose={() => setOpen(false)}
          variant="drawer"
        >
          <label>
            O que você procura?
            <input
              autoFocus
              type="search"
              placeholder="Página ou exercício…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <p className="muted small-text" aria-live="polite">
            {results.length} opções. Use Tab para navegar e Enter para abrir.
          </p>
          <div className="command-results">
            {results.map((item, i) => (
              <Link
                key={item.title + i}
                to={item.url}
                onClick={() => setOpen(false)}
              >
                <span>
                  <small>{item.kind}</small>
                  {item.title}
                </span>
                <ArrowUpRight size={17} />
              </Link>
            ))}
          </div>
          {!results.length && (
            <p>Nenhum recurso encontrado. Tente outro termo.</p>
          )}
        </Modal>
      )}
    </>
  );
}
