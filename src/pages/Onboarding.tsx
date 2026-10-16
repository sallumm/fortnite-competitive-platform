import { TrainingStepTransition } from "../components/experience/primitives";
import { useState } from "react";
import { supabase } from "../lib/client";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { appDestination } from "../lib/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Target,
  Trophy,
  Layers,
  Clock,
} from "lucide-react";
import { useStore } from "../lib/store";
import type { Profile } from "../lib/types";
import { labels } from "../lib/types";
import { Heading, Progress } from "../components/ui";
export default function Onboarding() {
  const store = useStore();
  const navigate = useNavigate();
  const route = useLocation();
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [p, setP] = useState<Profile>(
    store.data.profile || {
      id: store.session?.user.id || "demo",
      display_name: "Jogador",
      mode: "build",
      level: "beginner",
      objective: "aim",
      minutes: 30,
      input: "kbm",
      timezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
      onboarded: false,
      reminder_enabled: true,
    },
  );
  if (!store.demo && !store.session) return <Navigate to="/auth" replace />;
  const choices =
    step === 0
      ? ["build", "zero"]
      : step === 1
        ? ["beginner", "intermediate", "advanced"]
        : ["aim", "mechanics", "decisions", "vod", "competitive"];
  const field = step === 0 ? "mode" : step === 1 ? "level" : "objective";
  const titles = [
    "Como você joga?",
    "Em que momento você está?",
    "Qual é o seu foco?",
    "Um plano que cabe na sua vida.",
  ];
  const finish = () =>
    store.run(async () => {
      const profile = { ...p, onboarded: true };
      if (!store.demo) {
        if (!accepted)
          throw Error(
            "kyrven: leia e aceite os documentos antes de continuar.",
          );
        const { error } = await supabase!.rpc("accept_account_documents", {
          p_terms: "2026-10-11-prelaunch",
          p_privacy: "2026-10-11-prelaunch",
          p_accepted: true,
        });
        if (error) throw error;
      }
      await store.saveProfile(profile);
      if (!store.data.plans.length) {
        const { starterSteps } = await import("../lib/logic");
        const steps = starterSteps(
          store.catalog.exercises,
          profile,
          profile.minutes,
        );
        if (steps.length)
          await store.save("plans", {
            id: crypto.randomUUID(),
            user_id: p.id,
            title: "Meu primeiro plano",
            steps,
          });
      }
      navigate(appDestination(route.state?.from));
    });
  return (
    <div className="onboarding panel surface-onboarding">
      <div className="onboarding-caption"><span>Seu ponto de partida</span><span>Etapa {step + 1} de 4</span></div>
      <div className="onboarding-steps">
        {[Layers, Trophy, Target, Clock].map((Icon, i) => (
          <span className={i <= step ? "active" : ""} key={i} aria-current={i === step ? "step" : undefined}>
            <Icon size={18} />
            {i + 1}
          </span>
        ))}
      </div>
      <Progress value={step + 1} max={4} />
      <TrainingStepTransition identity={step}>
        <Heading
          title={titles[step]}
          description="Você pode mudar essas escolhas a qualquer momento."
        />
        {step < 3 ? (
          <div className="choice-grid">
            {choices
              .filter(
                (c) => !(step === 2 && p.mode === "zero" && c === "mechanics"),
              )
              .map((c) => (
                <button
                  aria-pressed={p[field] === c}
                  className={p[field] === c ? "selected" : ""}
                  key={c}
                  onClick={() =>
                    setP({
                      ...p,
                      [field]: c,
                      ...(field === "mode" &&
                      c === "zero" &&
                      p.objective === "mechanics"
                        ? { objective: "aim" as const }
                        : {}),
                    })
                  }
                >
                  <strong>{labels[c]}</strong>
                  {p[field] === c && <Check size={18} />}
                </button>
              ))}
          </div>
        ) : (
          <div className="form-grid">
            <label>
              Como podemos chamar você?
              <input
                value={p.display_name}
                maxLength={40}
                required
                onChange={(e) => setP({ ...p, display_name: e.target.value })}
              />
            </label>
            <label>
              Duração inicial
              <select
                value={p.minutes}
                onChange={(e) =>
                  setP({ ...p, minutes: Number(e.target.value) })
                }
              >
                {[30, 45, 60].map((n) => (
                  <option value={n} key={n}>
                    {n} minutos
                  </option>
                ))}
              </select>
              <small>
                Ponto de partida ajustável, sem duração ideal universal.
              </small>
            </label>
            <label>
              Dispositivo
              <select
                value={p.input}
                onChange={(e) =>
                  setP({ ...p, input: e.target.value as Profile["input"] })
                }
              >
                <option value="kbm">Teclado e mouse</option>
                <option value="controller">Controle</option>
              </select>
            </label>
            <label>
              Fuso horário
              <select
                value={p.timezone}
                onChange={(e) => setP({ ...p, timezone: e.target.value })}
              >
                {Array.from(
                  new Set([
                    p.timezone,
                    "America/Sao_Paulo",
                    "America/Manaus",
                    "America/Rio_Branco",
                    "Europe/Lisbon",
                    "UTC",
                  ]),
                ).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
        )}
      </TrainingStepTransition>
      {step === 3 && !store.demo && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          Li os{" "}
          <a href="/legal/terms" target="_blank" rel="noopener noreferrer">
            termos
          </a>{" "}
          e o{" "}
          <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">
            aviso de privacidade
          </a>
          , versão preliminar 2026-10-11. Cadastros públicos dependem de revisão
          do operador.
        </label>
      )}
      <div className="row between">
        <button
          className="button"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          <ArrowLeft size={16} />
          Voltar
        </button>
        <button
          className="button primary"
          disabled={store.busy || !p.display_name.trim()}
          onClick={() => (step < 3 ? setStep(step + 1) : finish())}
        >
          {step === 3 ? "Criar meu plano" : "Continuar"}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
