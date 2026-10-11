import * as m from "motion/react-m";
import { useMotionLevel } from "./experience/MotionSystem";
import { CommandPalette } from "./experience/CommandPalette";
import {
  PageTransition,
  NotificationToast,
  LoadingSkeleton,
} from "./experience/primitives";
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
const additionalTitles: Record<string, string> = {
  "/app/meta-training": "Meta Training Center",
  "/app/road": "Road to Competitive",
  "/app/teams": "Minhas equipes",
  "/app/evolution-plan": "Plano de evolução",
};
const nav = [
  ["/app", "Meu Dia", Home],
  ["/app/coach", "kyrven coach", MessageSquare],
  ["/app/training", "Training Center", Target],
  ["/app/planner", "Planejador", CalendarDays],
  ["/library", "Exercícios", Target],
  ["/competitive", "Competitivo", Trophy],
  ["/competitive/meta", "Meta", Compass],
  ["/news", "Notícias e análises", Compass],
  ["/academy", "kyrven academy", GraduationCap],
  ["/app/evolution", "Minha Evolução", BarChart3],
  ["/app/vod", "VOD Review", Target],
  ["/app/skills", "Minhas Habilidades", Target],
  ["/app/week", "Minha Semana", CalendarDays],
  ["/app/reports", "Relatórios", BarChart3],
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
  const { effective } = useMotionLevel();
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
  const [collapsed, setCollapsed] = useState(false);
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
      document.title = `${match?.[1] || additionalTitles[location.pathname] || "Evolução competitiva"} — kyrven`;
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
            <span className="brand-mark">k</span>kyrven
            <span className="beta">BETA</span>
          </Link>
          <nav aria-label="Menu público">
            <Link to="/competitive">Competitivo</Link>
            <Link to="/competitive/meta">Meta</Link>
            <Link to="/library">Treinamento</Link>
            <Link to="/academy">Academy</Link>
            <Link to="/news">Notícias</Link>
          </nav>
          <div className="row">
            <CommandPalette />
            {themeButton}
            {auth}
          </div>
        </header>
      ) : (
        <>
          <aside
            id="main-navigation"
            ref={menu}
            className={`sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}
          >
            <Link to="/" className="brand">
              <span className="brand-mark">k</span>kyrven
            </Link>
            <button
              className="sidebar-collapse button small"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              <ChevronRight size={16} />
            </button>
            <span className="sidebar-label">SEU PRÓXIMO NÍVEL</span>
            <nav aria-label="Navegação principal">
              {nav.map(([to, title, Icon], index) => (
                <div key={to}>
                  {(
                    {
                      0: "Meu espaço",
                      2: "Treinamento",
                      5: "Explorar",
                      9: "Minha evolução",
                      15: "Ajuda",
                    } as Record<number, string>
                  )[index] && (
                    <span className="nav-group">
                      {
                        (
                          {
                            0: "Meu espaço",
                            2: "Treinamento",
                            5: "Explorar",
                            9: "Minha evolução",
                            15: "Ajuda",
                          } as Record<number, string>
                        )[index]
                      }
                    </span>
                  )}
                  <NavLink
                    end={to !== "/competitive/meta"}
                    to={to}
                    key={to}
                    aria-label={title}
                    title={title}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <m.span
                            aria-hidden="true"
                            className="active-navigation"
                            layoutId={
                              effective === "full"
                                ? "active-navigation"
                                : undefined
                            }
                            transition={{
                              type: "spring",
                              stiffness: 450,
                              damping: 38,
                            }}
                          />
                        )}
                        <Icon size={18} />
                        <span className="nav-title">{title}</span>
                      </>
                    )}
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
          <header className={`app-header ${collapsed ? "compact" : ""}`}>
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
                    additionalTitles[location.pathname] ||
                    "kyrven"}
                </strong>
              </span>
            </div>
            <div className="row">
              <CommandPalette />
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
        className={
          landing ? "landing" : `workspace ${collapsed ? "compact" : ""}`
        }
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
        <NotificationToast message={store.notice || ""} />
        <Suspense fallback={<LoadingSkeleton />}>
          <PageTransition identity={location.pathname}>
            <Outlet />
            <RouteFocus />
          </PageTransition>
        </Suspense>
      </main>
      <footer
        className={
          landing ? "public-footer" : `app-footer ${collapsed ? "compact" : ""}`
        }
      >
        <div>
          <Link to="/" className="brand">
            kyrven
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
