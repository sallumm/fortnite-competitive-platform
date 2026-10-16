import { AppearanceButton, useAppearance } from "./experience/Appearance";
import { clearLocalProductData } from "../lib/local-data";
import { Brand } from "./brand/Brand";
import * as m from "motion/react-m";
import { useMotionLevel } from "./experience/MotionSystem";
import { CommandPalette } from "./experience/CommandPalette";
import {
  PageTransition,
  NotificationToast,
  LoadingSkeleton,
} from "./experience/primitives";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
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
  "/app/esports": "Meu espaço esports",
  "/admin/esports": "Administração esports",
  "/be-kyrven": "be kyrven.",
  "/esports": "kyrven esports",
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
  ["/app/evolution-plan", "Skill Maxing", Layers],
  ["/app/road", "Road to Competitive", Compass],
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
  ["/esports", "kyrven esports", Trophy],
  ["/be-kyrven", "be kyrven.", Users],
  ["/app/esports", "Meu espaço esports", Shield],
] as const;
function RouteFocus() {
  const location = useLocation();
  useEffect(() => {
    // This effect commits only after the lazy page inside Suspense is ready.
    // A lazy page can finish loading after the user has opened the drawer.
    if (!document.querySelector("#main-navigation.open"))
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
  const {theme, setTheme} = useAppearance();
  const menu = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const menuTrigger = useRef<HTMLButtonElement | null>(null);
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
  const openMenu = (trigger: HTMLButtonElement) => {
    menuTrigger.current = trigger;
    setOpen(true);
  };
  const closeMenu = useCallback(() => {
    setOpen(false);
    const trigger = menuTrigger.current?.getClientRects().length
      ? menuTrigger.current
      : toggle.current;
    trigger?.focus({ preventScroll: true });
  }, []);
  const location = useLocation();
  const navigate = useNavigate();
  const landing = location.pathname === "/";
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
    const mobile = window.matchMedia("(max-width: 680px)");
    if (!mobile.matches) {
      setOpen(false);
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (menu.current) menu.current.scrollTop = 0;
    menu.current?.querySelector<HTMLElement>("a,button")?.focus({ preventScroll: true });
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(
        menu.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled])",
        ) || [],
      ).filter((node) => node.getClientRects().length > 0);
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
    const resize = () => {
      if (mobile.matches) return;
      setOpen(false);
      // The mobile close button becomes hidden before this media event fires.
      menu.current?.querySelector<HTMLElement>("nav a[href]")?.focus({ preventScroll: true });
    };
    mobile.addEventListener("change", resize);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keyboard);
      mobile.removeEventListener("change", resize);
    };
  }, [open, closeMenu]);
  const themeButton = (
    <button
      className="icon-button theme-toggle"
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
            <Brand />
            <span className="beta">BETA</span>
          </Link>
          <nav aria-label="Menu público">
            <Link to="/competitive">Competitivo</Link>
            <Link to="/competitive/meta">Meta</Link>
            <Link to="/library">Treinamento</Link>
            <Link to="/academy">Academy</Link>
            <Link to="/esports">Esports</Link>
          </nav>
          <div className="row">
            <CommandPalette />
            {store.session && <Link to="/security">Segurança</Link>}
            {themeButton}<AppearanceButton />
            {auth}
          </div>
        </header>
      ) : (
        <>
          <aside
            id="main-navigation"
            ref={menu}
            className={`sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}
            onClick={(event) => {
              if (open && event.target instanceof Element && event.target.closest("a[href]")) {
                setOpen(false);
                document.getElementById("main")?.focus({ preventScroll: true });
              }
            }}
          >
            <button
              type="button"
              className="icon-button mobile-menu-close"
              aria-label="Fechar menu de navegação"
              onClick={closeMenu}
            >
              <X size={20} />
            </button>
            <Link to="/" className="brand">
              <Brand />
            </Link>
            <button
              className="sidebar-collapse button small"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              <ChevronRight size={16} />
            </button>
            <span className="sidebar-label">CADERNO DE PERFORMANCE</span>
            <nav aria-label="Navegação principal">
              {nav.map(([to, title, Icon], index) => (
                <div key={to}>
                  {(
                    {
                      0: "Meu espaço",
                      2: "Treinamento",
                      7: "Explorar",
                      11: "Minha evolução",
                      17: "Comunidade",
                    } as Record<number, string>
                  )[index] && (
                    <span className="nav-group">
                      {
                        (
                          {
                            0: "Meu espaço",
                            2: "Treinamento",
                            7: "Explorar",
                            11: "Minha evolução",
                            17: "Comunidade",
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
            onClick={closeMenu}
          />
          <header className={`app-header ${collapsed ? "compact" : ""}`}>
            <div className="row">
              <button
                ref={toggle}
                aria-controls="main-navigation"
                aria-expanded={open}
                className="icon-button mobile-menu"
                aria-label={open ? "Fechar menu" : "Abrir menu"}
                onClick={(event) => open ? closeMenu() : openMenu(event.currentTarget)}
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
              {themeButton}<AppearanceButton />
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
                      clearLocalProductData(localStorage, sessionStorage);
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
      {!landing && <nav className="mobile-dock" aria-label="Acesso rápido mobile"><NavLink to="/app" end><Home size={19}/>Hoje</NavLink><NavLink to="/app/training"><Target size={19}/>Treinar</NavLink><NavLink to="/app/planner"><CalendarDays size={19}/>Agenda</NavLink><NavLink to="/academy"><GraduationCap size={19}/>Estudar</NavLink><button onClick={(event) => openMenu(event.currentTarget)} aria-label="Mais destinos" aria-controls="main-navigation" aria-expanded={open}><Menu size={19}/>Mais</button></nav>}
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
          <Link to="/esports">kyrven esports</Link>
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
