import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { emptyRoad } from "./domain";
import { loadRoad } from "./service";
export function useRoad() {
  const s = useStore(),
    owner = s.demo ? "demo" : s.session?.user.id || "";
  const epoch = useRef(0),
    [loaded, setLoaded] = useState(""),
    [data, setData] = useState(emptyRoad),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    const e = epoch.current;
    if (!owner) return;
    setLoading(true);
    try {
      const d = await loadRoad(s.demo);
      if (e === epoch.current) {
        setData(d);
        setLoaded(owner);
        setError("");
      }
    } catch {
      if (e === epoch.current)
        setError("Não foi possível consultar sua jornada. Tente novamente.");
    } finally {
      if (e === epoch.current) setLoading(false);
    }
  }, [owner, s.demo]);
  useEffect(() => {
    epoch.current++;
    setData(emptyRoad());
    setLoaded(owner);
    setError("");
    void refresh();
    return () => {
      epoch.current++;
    };
  }, [refresh, owner]);
  return {
    data: loaded === owner ? data : emptyRoad(),
    error,
    loading,
    refresh,
  };
}
