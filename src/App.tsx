import { lazy, Suspense, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { Provider, useStore } from "./lib/store";
import { Layout } from "./components/Layout";
import { Empty } from "./components/ui";
import { currentEvent } from "./lib/competitive";
import { dateInZone } from "./lib/calendar";
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Coach = lazy(() => import("./pages/Coach"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Planner = lazy(() => import("./pages/Planner"));
const Training = lazy(() => import("./pages/Training"));
const Library = lazy(() => import("./pages/Library"));
const Competitive = lazy(() => import("./pages/Competitive"));
const Editorial = lazy(() => import("./pages/Editorial"));
const Skills = lazy(() => import("./pages/Skills"));
const Week = lazy(() => import("./pages/Week"));
const Journal = lazy(() => import("./pages/Journal"));
const Reports = lazy(() => import("./pages/Reports"));
const Progression = lazy(() =>
  import("./pages/Reports").then((m) => ({ default: m.Progression })),
);
const Help = lazy(() =>
  import("./pages/Support").then((m) => ({ default: m.Help })),
);
const Community = lazy(() =>
  import("./pages/Support").then((m) => ({ default: m.Community })),
);
const Profile = lazy(() =>
  import("./pages/Support").then((m) => ({ default: m.ProfilePage })),
);
const Legal = lazy(() =>
  import("./pages/Support").then((m) => ({ default: m.Legal })),
);
const Admin = lazy(() => import("./pages/Admin"));
function Loading() {
  return (
    <div className="skeleton-page" role="status" aria-label="Carregando">
      <div />
      <div />
      <div />
      <p>Carregando seu espaço…</p>
    </div>
  );
}
function Guard({
  children,
  onboard = true,
}: {
  children: ReactNode;
  onboard?: boolean;
}) {
  const s = useStore();
  const location = useLocation();
  if (s.error && s.loading)
    return (
      <Empty title="Seu espaço não pôde ser carregado">
        Use “Tentar novamente” acima para recuperar seus dados.
      </Empty>
    );
  if (s.loading) return <Loading />;
  if (!s.demo && !s.session)
    return (
      <Navigate
        to="/auth"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  if (onboard && !s.data.profile?.onboarded)
    return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
function Reminders() {
  const s = useStore();
  if (!s.data.profile?.reminder_enabled) return null;
  const now = Date.now();
  const upcoming = s.catalog.tournaments.filter(
    (t) =>
      currentEvent(t) &&
      s.data.bookmarks.some(
        (b) => b.kind === "tournament" && b.target_id === t.id,
      ) &&
      (t.starts_at
        ? new Date(t.starts_at).getTime() - now >= 0 &&
          new Date(t.starts_at).getTime() - now < 864e5
        : t.start_date === dateInZone(new Date(), s.data.profile!.timezone)),
  );
  return upcoming.length ? (
    <div className="reminders" role="status">
      Favoritos próximos:{" "}
      {upcoming.map((t) => (
        <Link key={t.id} to={"/competitive/" + t.slug}>
          {t.title}
        </Link>
      ))}
      . Confirme horários na fonte oficial.
    </div>
  ) : null;
}
function TrainingRoute() {
  const { id } = useParams();
  const s = useStore();
  return <Training key={`${s.data.profile?.id}:${id}`} />;
}
function Application() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Reminders />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/onboarding"
              element={
                <Guard onboard={false}>
                  <Onboarding />
                </Guard>
              }
            />
            <Route
              path="/app"
              element={
                <Guard>
                  <Dashboard />
                </Guard>
              }
            />
            <Route
              path="/app/coach"
              element={
                <Guard>
                  <Coach />
                </Guard>
              }
            />
            <Route
              path="/app/planner"
              element={
                <Guard>
                  <Planner />
                </Guard>
              }
            />
            <Route
              path="/app/session/:id"
              element={
                <Guard>
                  <TrainingRoute />
                </Guard>
              }
            />
            <Route
              path="/app/skills"
              element={
                <Guard>
                  <Skills />
                </Guard>
              }
            />
            <Route
              path="/app/week"
              element={
                <Guard>
                  <Week />
                </Guard>
              }
            />
            <Route
              path="/app/journal/:id"
              element={
                <Guard>
                  <Journal />
                </Guard>
              }
            />
            <Route
              path="/app/reports"
              element={
                <Guard>
                  <Reports />
                </Guard>
              }
            />
            <Route
              path="/app/progression"
              element={
                <Guard>
                  <Progression />
                </Guard>
              }
            />
            <Route
              path="/app/profile"
              element={
                <Guard>
                  <Profile />
                </Guard>
              }
            />
            <Route path="/library" element={<Library />} />
            <Route path="/library/:id" element={<Library />} />
            <Route path="/competitive" element={<Competitive />} />
            <Route path="/competitive/:slug" element={<Competitive />} />
            <Route path="/news" element={<Editorial />} />
            <Route path="/news/:slug" element={<Editorial />} />
            <Route path="/academy" element={<Editorial academy />} />
            <Route path="/academy/:slug" element={<Editorial academy />} />
            <Route path="/help" element={<Help />} />
            <Route path="/community" element={<Community />} />
            <Route path="/legal/:type" element={<Legal />} />
            <Route
              path="/admin"
              element={
                <Guard>
                  <Admin />
                </Guard>
              }
            />
            <Route
              path="*"
              element={
                <Empty
                  title="Página não encontrada"
                  to="/"
                  label="Voltar ao início"
                />
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
export default function App() {
  return (
    <Provider>
      <Application />
    </Provider>
  );
}
