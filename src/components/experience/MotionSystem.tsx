import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { LazyMotion, MotionConfig, useReducedMotion } from "motion/react";
export type MotionLevel = "full" | "reduced" | "essential";
const Context = createContext({
  level: "full" as MotionLevel,
  effective: "full" as MotionLevel,
  setLevel: (_level: MotionLevel) => {},
});
const features = () => import("./features").then((module) => module.default);
export function MotionSystem({ children }: { children: ReactNode }) {
  const systemReduced = useReducedMotion();
  const [level, updateLevel] = useState<MotionLevel>(() => {
    try {
      const saved = localStorage.getItem("clutchfolio-motion");
      return saved === "reduced" || saved === "essential" ? saved : "full";
    } catch {
      return "full";
    }
  });
  const effective = systemReduced && level === "full" ? "reduced" : level;
  useEffect(() => {
    document.documentElement.dataset.motion = effective;
  }, [effective, level]);
  const setLevel = (next: MotionLevel) => {
    updateLevel(next);
    try {
      localStorage.setItem("clutchfolio-motion", next);
    } catch {
      /* Preference still works without storage. */
    }
  };
  return (
    <Context.Provider value={{ level, effective, setLevel }}>
      <MotionConfig
        reducedMotion={effective === "full" ? "user" : "always"}
        transition={{
          duration:
            effective === "essential" ? 0 : effective === "reduced" ? 0.1 : 0.2,
        }}
      >
        <LazyMotion features={features} strict>
          {children}
        </LazyMotion>
      </MotionConfig>
    </Context.Provider>
  );
}
export const useMotionLevel = () => useContext(Context);
export function MotionPreferences() {
  const { level, effective, setLevel } = useMotionLevel();
  return (
    <label>
      Intensidade de movimento
      <select
        value={level}
        onChange={(e) => setLevel(e.target.value as MotionLevel)}
      >
        <option value="full">Movimento completo</option>
        <option value="reduced">Movimento reduzido</option>
        <option value="essential">Somente respostas essenciais</option>
      </select>
      <small>
        Preferência deste navegador. A redução de movimento do sistema tem
        prioridade.{" "}
        {effective === "reduced" && level === "full"
          ? "Redução do sistema ativa."
          : ""}
      </small>
    </label>
  );
}
