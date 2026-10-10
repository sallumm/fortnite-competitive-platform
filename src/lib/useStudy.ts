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
    if (!enabled) {
      setData(emptyStudy());
      return;
    }
    const current = generation.current;
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
  }, [enabled, s.demo, s.session?.user.id]);
  useEffect(() => {
    generation.current++;
    let active = true;
    setData(emptyStudy());
    setLoadedOwner(owner);
    setError("");
    if (!enabled) return;
    setLoading(true);
    loadStudy(s.demo)
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active)
          setError("Não foi possível consultar seu estudo. Tente novamente.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      generation.current++;
    };
  }, [enabled, s.demo, s.session?.user.id]);
  return {
    data: loadedOwner === owner ? data : emptyStudy(),
    error,
    loading,
    enabled,
    refresh,
  };
}
