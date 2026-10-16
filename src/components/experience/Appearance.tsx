import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { MotionPreferences, useMotionLevel } from "./MotionSystem";
import { Modal } from "../ui";
import { SlidersHorizontal } from "lucide-react";
export type Theme = "dark" | "light" | "tidal" | "system";
type Density = "comfortable" | "compact";
const themes: Theme[] = ["dark", "light", "tidal", "system"];
export function readAppearance(storage?: Pick<Storage, "getItem">) {
  try {
    const theme = storage?.getItem("clutchfolio-theme");
    return { theme: themes.includes(theme as Theme) ? theme as Theme : "dark" as Theme,
      density: storage?.getItem("kyrven-density") === "compact" ? "compact" as Density : "comfortable" as Density };
  } catch { return { theme: "dark" as Theme, density: "comfortable" as Density }; }
}
const Context = createContext({theme: "dark" as Theme, density: "comfortable" as Density,
  setTheme: (_theme: Theme) => {}, setDensity: (_density: Density) => {}});
export function AppearanceProvider({children}: {children: ReactNode}) {
  const [preferences, setPreferences] = useState(() => {
    try { return readAppearance(localStorage); } catch { return readAppearance(); }
  });
  const {theme, density} = preferences;
  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const resolved = theme === "system" ? system.matches ? "light" : "dark" : theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.density = density;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "light" ? "#f2efe7" : resolved === "tidal" ? "#10292d" : "#191b1b");
    };
    apply(); system.addEventListener("change", apply);
    try { localStorage.setItem("clutchfolio-theme", theme); localStorage.setItem("kyrven-density", density); } catch { /* In-memory preference remains usable. */ }
    return () => system.removeEventListener("change", apply);
  }, [theme, density]);
  return <Context.Provider value={{...preferences, setTheme: theme => setPreferences(p => ({...p, theme})), setDensity: density => setPreferences(p => ({...p, density}))}}>{children}</Context.Provider>;
}
export const useAppearance = () => useContext(Context);
export function AppearanceSettings() {
  const {theme, density, setTheme, setDensity} = useAppearance();
  const {setLevel} = useMotionLevel();
  return <div className="appearance-settings">
    <p>Ajuste este navegador. As alterações aparecem imediatamente.</p>
    <fieldset><legend>Ambiente de leitura</legend><div className="theme-options">
      {([["dark","Grafite"],["light","Papel"],["tidal","Maré"],["system","Sistema"]] as const).map(([value,label]) => <button key={value} type="button" data-swatch={value} aria-pressed={theme === value} onClick={() => setTheme(value)}><span aria-hidden="true"/>{label}</button>)}
    </div></fieldset>
    <label>Densidade de listas e tabelas<select value={density} onChange={e => setDensity(e.target.value as Density)}><option value="comfortable">Confortável</option><option value="compact">Compacta</option></select></label>
    <MotionPreferences />
    <button type="button" className="button" onClick={() => {setTheme("dark");setDensity("comfortable");setLevel("full");}}>Restaurar aparência padrão</button>
  </div>;
}
export function AppearanceButton() {
  const [open,setOpen] = useState(false);
  return <><button className="icon-button" aria-label="Personalizar aparência" onClick={() => setOpen(true)}><SlidersHorizontal size={18}/></button>{open && <Modal title="Seu ambiente" onClose={() => setOpen(false)}><AppearanceSettings /></Modal>}</>;
}
