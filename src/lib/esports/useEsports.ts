import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { closedPortal, type Portal, type Workspace } from "./domain";
import { loadPortal, loadWorkspace } from "./service";
export function useEsports() {
  const s = useStore();
  const [portal, setPortal] = useState<Portal>(closedPortal);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const generation = ++sequence.current;
    setLoading(true);
    setError("");
    setWorkspace(null);
    try {
      const p = await loadPortal();
      if (generation !== sequence.current) return;
      setPortal(p);
      if (s.session && !s.demo) {
        const w = await loadWorkspace();
        if (generation === sequence.current) setWorkspace(w);
      }
    } catch (e) {
      if (generation === sequence.current)
        setError(e instanceof Error ? e.message : "Consulta indisponível.");
    } finally {
      if (generation === sequence.current) setLoading(false);
    }
  }, [s.session?.user.id, s.demo]);
  useEffect(() => {
    void refresh();
    return () => {
      sequence.current++;
    };
  }, [refresh]);
  return { portal, workspace, loading, error, refresh };
}
