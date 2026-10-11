import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "./store";
import { emptyStudy } from "./academy";
import { loadStudy } from "./academy-service";
export function useStudy() {
  const s = useStore();
  const generation = useRef(0);
  const owner = s.demo ? "demo" : s.session?.user.id || "";
  const [loadedOwner, setLoadedOwner] = useState("");
  const enabled = Boolean(s.demo || s.session);
  const [data, setData] = useState(emptyStudy);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    if (!enabled) {
      setData(emptyStudy());
      setLoading(false);
      setLoadedOwner(owner);
      return;
    }
    setLoading(true);
    try {
      const loaded = await loadStudy(s.demo);
      if (current === generation.current) {
        setData(loaded);
        setLoadedOwner(owner);
        setError("");
      }
    } catch {
      if (current === generation.current)
        setError("Não foi possível consultar seu estudo. Tente novamente.");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [enabled, s.demo, owner]);
  useEffect(() => {
    setData(emptyStudy());
    setLoadedOwner(owner);
    setError("");
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh, owner]);
  return {
    data: loadedOwner === owner ? data : emptyStudy(),
    error: loadedOwner === owner ? error : "",
    loading: loadedOwner !== owner || loading,
    enabled,
    refresh,
  };
}
