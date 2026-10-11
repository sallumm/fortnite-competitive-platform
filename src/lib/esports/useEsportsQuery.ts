import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../store";
export function useEsportsQuery<T>(load: () => Promise<T>) {
  const s = useStore(),
    seq = useRef(0);
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const generation = ++seq.current;
    setLoading(true);
    setError("");
    try {
      if (!s.session || s.demo)
        throw new Error("Esta área exige uma conta real autorizada.");
      const result = await load();
      if (seq.current === generation) setData(result);
    } catch (e) {
      if (seq.current === generation) {
        setData(null);
        setError(e instanceof Error ? e.message : "Consulta indisponível.");
      }
    } finally {
      if (seq.current === generation) setLoading(false);
    }
  }, [load, s.session?.user.id, s.demo]);
  useEffect(() => {
    setData(null);
    void refresh();
    return () => {
      seq.current++;
    };
  }, [refresh]);
  return { data, error, loading, refresh };
}
