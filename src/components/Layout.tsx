import { Suspense, useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  MessageSquare,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Compass,
  GraduationCap,
  Home,
  Layers,
  LogOut,
  Menu,
  Moon,
  Shield,
  Sun,
  Target,
  Trophy,
  User,
  Users,
  HelpCircle,
  X,
  ChevronRight,
} from "lucide-react";
import { useStore } from "../lib/store";
import { supabase } from "../lib/client";
const nav = [
  ["/app", "Meu Dia", Home],
  ["/app/coach", "Clutch Coach", MessageSquare],
  ["/app/planner", "Planejador", CalendarDays],
  ["/library", "Exercícios", Target],
  ["/competitive", "Competitivo", Trophy],
  ["/news", "Notícias e análises", Compass],
  ["/academy", "Academy", GraduationCap],
  ["/app/skills", "Minhas Habilidades", Target],
  ["/app/week", "Minha Semana", CalendarDays],
  ["/app/reports", "Minha evolução", BarChart3],
  ["/app/progression", "Progressão", Layers],
  ["/help", "Central de ajuda", HelpCircle],
  ["/community", "Comunidade", Users],
] as const;
function RouteFocus() {
  const location = useLocation();
  useEffect(() => {
    // This effect commits only after the lazy page inside Suspense is ready.
    document.getElementById("main")?.focus({ preventScroll: true });
    if (location.hash) {
      try {
        document
          .getElementById(decodeURIComponent(location.hash.slice(1)))
          ?.scrollIntoView({ block: "start" });
      } catch {
        /* Ignore malformed fragments. */
      }
    }
  }, [location.pathname, location.hash]);
  return null;
}
export function Layout() {
  const store = useStore();
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("clutchfolio-theme") === "light"
        ? "light"
        : "dark";
    } catch {
      return "dark";
    }
  });
  const menu = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const landing = location.pathname === "/";
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("clutchfolio-theme", theme);
    } catch {
      /* Theme remains usable without storage. */
    }
  }, [theme]);
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
    const match = nav.find((n) => n[0] === location.pathname);
    if (
      !/^\/(library|competitive|news|academy)(\/|$)/.test(location.pathname)
    ) {
      document.title = `${match?.[1] || "Evolução competitiva"} — Clutchfolio`;
    }
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = /^\/(app|admin|auth|onboarding)/.test(location.pathname)
      ? "noindex,nofollow"
      : "index,follow";
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menu.current?.querySelector<HTMLElement>("a,button")?.focus();
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(
        menu.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled])",
        ) || [],
      );
      const first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keyboard);
    };
  }, [open]);
  const themeButton = (
    <button
      className="icon-button"
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
  const auth = (
    <Link
      to={store.session || store.demo ? "/app" : "/auth"}
      className="button primary small"
    >
      {store.session || store.demo ? "Meu painel" : "Começar grátis"}
      <ArrowUpRight size={15} />
    </Link>
  );
  return (
    <>
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      {landing ? (
        <header className="public-header">
          <Link to="/" className="brand">
            <span className="brand-mark">C</span>clutchfolio
            <span className="beta">BETA</span>
          </Link>
          <nav aria-label="Menu público">
            <Link to="/competitive">Competitivo</Link>
            <Link to="/library">Treinamento</Link>
            <Link to="/academy">Academy</Link>
            <Link to="/news">Notícias</Link>
          </nav>
          <div className="row">
            {themeButton}
            {auth}
          </div>
        </header>
      ) : (
        <>
          <aside
            id="main-navigation"
            ref={menu}
            className={`sidebar ${open ? "open" : ""}`}
          >
            <Link to="/" className="brand">
              <span className="brand-mark">C</span>clutchfolio
            </Link>
            <span className="sidebar-label">SEU PRÓXIMO NÍVEL</span>
            <nav aria-label="Navegação principal">
              {nav.map(([to, title, Icon], index) => (
                <div key={to}>
                  {(index === 0 ||
                    index === 3 ||
                    index === 7 ||
                    index === 11) && (
                    <span className="nav-group">
                      {index === 0
                        ? "Meu espaço"
                        : index === 3
                          ? "Explorar"
                          : index === 7
                            ? "Minha evolução"
                            : "Ajuda"}
                    </span>
                  )}
                  <NavLink end to={to} key={to}>
                    <Icon size={18} />
                    {title}
                  </NavLink>
                </div>
              ))}
              {store.admin && (
                <NavLink to="/admin">
                  <Shield size={18} />
                  Administração
                </NavLink>
              )}
            </nav>
            <div className="sidebar-bottom">
              <div className="sidebar-tip">
                <BookOpen size={18} />
                <p>
                  Pratique com intenção.
                  <br />
                  <strong>Descanse sem perder progresso.</strong>
                </p>
              </div>
              <NavLink to="/app/profile">
                <span className="avatar">
                  {store.data.profile?.display_name.slice(0, 1) || (
                    <User size={17} />
                  )}
                </span>
                <div>
                  {store.data.profile?.display_name || "Visitante"}
                  <small>
                    {store.demo
                      ? "Demonstração local"
                      : store.session
                        ? "Conta gratuita"
                        : "Explorar a plataforma"}
                  </small>
                </div>
                <ChevronRight size={16} />
              </NavLink>
            </div>
          </aside>
          <button
            className={`menu-backdrop ${open ? "visible" : ""}`}
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          />
          <header className="app-header">
            <div className="row">
              <button
                ref={toggle}
                aria-controls="main-navigation"
                aria-expanded={open}
                className="icon-button mobile-menu"
                aria-label={open ? "Fechar menu" : "Abrir menu"}
                onClick={() => setOpen(!open)}
              >
                {open ? <X /> : <Menu />}
              </button>
              <span className="header-context">
                EVOLUÇÃO COMPETITIVA <span>/</span>{" "}
                <strong>
                  {nav.find((n) => n[0] === location.pathname)?.[1] ||
                    "Clutchfolio"}
                </strong>
              </span>
            </div>
            <div className="row">
              {themeButton}
              {auth}
              {(store.session || store.demo) && (
                <button
                  className="icon-button"
                  aria-label="Sair"
                  onClick={() =>
                    store.run(async () => {
                      if (supabase && store.session) {
                        const { error } = await supabase.auth.signOut();
                        if (error) throw error;
                      }
                      store.exitDemo();
                      navigate("/");
                    })
                  }
                >
                  <LogOut size={18} />
                </button>
              )}
            </div>
          </header>
        </>
      )}
      <main
        id="main"
        tabIndex={-1}
        className={landing ? "landing" : "workspace"}
      >
        {!online && (
          <div className="alert" role="status">
            Você está sem conexão. Alterações na conta precisam de conexão; os
            dados exibidos podem estar desatualizados.
          </div>
        )}
        {store.demo && (
          <div className="demo-banner">
            <span>
              <strong>Demonstração</strong> · Seus testes ficam apenas neste
              navegador, separados de contas reais.
            </span>
            <button
              onClick={() => {
                store.exitDemo();
                navigate("/");
              }}
            >
              Sair da demonstração
            </button>
          </div>
        )}
        {store.error && (
          <div role="alert" className="alert error">
            {store.error}
            <button
              onClick={() =>
                store.run(() => store.refresh(), "Dados atualizados.")
              }
            >
              Tentar novamente
            </button>
          </div>
        )}
        {store.notice && (
          <div role="status" className="toast">
            {store.notice}
          </div>
        )}
        <Suspense
          fallback={
            <div
              role="status"
              className="skeleton-page"
              aria-label="Carregando"
            >
              <p>Carregando esta página…</p>
            </div>
          }
        >
          <Outlet />
          <RouteFocus />
        </Suspense>
      </main>
      <footer className={landing ? "public-footer" : "app-footer"}>
        <div>
          <Link to="/" className="brand">
            clutchfolio
          </Link>
          <p>Treinamento, informação e evolução competitiva.</p>
        </div>
        <div>
          <Link to="/legal/privacy">Privacidade</Link>
          <Link to="/legal/terms">Termos</Link>
          <Link to="/community">Suporte</Link>
          <Link to="/help">Fontes e ajuda</Link>
        </div>
        <p className="disclaimer">
          Projeto independente, sem afiliação à Epic Games. Portions of the
          materials used are trademarks and/or copyrighted works of Epic Games,
          Inc. All rights reserved by Epic. This material is not official and is
          not endorsed by Epic.
        </p>
      </footer>
    </>
  );
}
