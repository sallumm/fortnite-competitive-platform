import { useEffect, useRef, useState } from "react";
type Api = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Api;
  }
}
let pending: Promise<Api> | undefined;
export function loadTurnstile(): Promise<Api> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (pending) return pending;
  pending = new Promise<Api>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      pending = undefined;
      reject(Error("CAPTCHA unavailable"));
    };
    const timer = setTimeout(fail, 15000);
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onerror = fail;
    script.onload = () => {
      if (!window.turnstile) {
        fail();
        return;
      }
      clearTimeout(timer);
      resolve(window.turnstile);
    };
    document.head.append(script);
  });
  return pending;
}
export function Turnstile({
  action,
  onToken,
}: {
  action: string;
  onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    callback = useRef(onToken);
  callback.current = onToken;
  const [retry, setRetry] = useState(0),
    [error, setError] = useState(false);
  const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  useEffect(() => {
    let active = true,
      id: string | undefined,
      api: Api | undefined;
    callback.current("");
    setError(false);
    if (sitekey)
      loadTurnstile()
        .then((a) => {
          if (!active) return;
          api = a;
          id = a.render(container.current!, {
            sitekey,
            action,
            callback: (t: string) => callback.current(t),
            "expired-callback": () => callback.current(""),
            "error-callback": () => {
              callback.current("");
              setError(true);
            },
          });
        })
        .catch(() => {
          if (active) setError(true);
        });
    return () => {
      active = false;
      if (id !== undefined) api?.remove(id);
    };
  }, [sitekey, action, retry]);
  if (!sitekey)
    return <p role="status">Verificação de segurança ainda não configurada.</p>;
  return (
    <div>
      <div ref={container} />
      {error && (
        <p role="alert">
          Verificação indisponível.{" "}
          <button type="button" onClick={() => setRetry((r) => r + 1)}>
            Tentar novamente
          </button>
        </p>
      )}
    </div>
  );
}
