import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/client";
import { appDestination } from "../lib/navigation";
import { Heading } from "../components/ui";

export default function Security() {
  const location = useLocation();
  const destination = appDestination(location.state?.from);
  const [factors, setFactors] = useState<
    { id: string; friendly_name?: string }[]
  >([]);
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [verified, setVerified] = useState(false);
  const [required, setRequired] = useState(true);
  async function load() {
    if (!supabase) throw Error("Contas ainda não estão configuradas.");
    const [list, status, level] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.rpc("security_status"),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (list.error || status.error || level.error)
      throw Error(
        "Não foi possível consultar a segurança da conta. Tente novamente.",
      );
    setFactors(list.data.totp);
    setFactor(list.data.totp[0]?.id || "");
    setVerified(level.data.currentLevel === "aal2");
    setRequired(
      status.data?.privileged === true || level.data.nextLevel === "aal2",
    );
    setReady(true);
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch {
      setError(
        "Não foi possível concluir. Confira o código do autenticador e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load().catch(() =>
      setError(
        "Não foi possível consultar a segurança da conta. Tente novamente.",
      ),
    );
  }, []);
  return (
    <section className="panel">
      <Heading
        title="Segurança da conta"
        description="A administração exige autenticação em duas etapas. Use um aplicativo autenticador."
      />
      {error && <p role="alert">{error}</p>}
      {!ready && (
        <button disabled={busy} onClick={() => run(load)}>
          Tentar novamente
        </button>
      )}
      {ready && (
        <>
          <p>
            {verified
              ? "Segunda etapa verificada nesta sessão."
              : "Confirme sua identidade antes de acessar funções protegidas."}
          </p>
          {factors.length > 0 && (
            <label>
              Autenticador
              <select
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
              >
                {factors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.friendly_name || "Autenticador"} · {f.id.slice(-6)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!qr && (
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const result = await supabase!.auth.mfa.enroll({
                    factorType: "totp",
                    friendlyName: "kyrven " + new Date().toISOString(),
                  });
                  if (result.error) throw result.error;
                  setFactor(result.data.id);
                  setQr(result.data.totp.qr_code);
                })
              }
            >
              Adicionar autenticador
            </button>
          )}
          {qr && (
            <div>
              <p>
                Escaneie este código no seu autenticador. Não compartilhe o QR.
              </p>
              <img
                alt="QR para cadastrar o autenticador"
                src={qr}
                width={220}
                height={220}
              />
            </div>
          )}
          {factor && (!verified || !!qr) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const result = await supabase!.auth.mfa.challengeAndVerify({
                    factorId: factor,
                    code,
                  });
                  if (result.error) throw result.error;
                  setQr("");
                  setCode("");
                  await load();
                });
              }}
            >
              <label>
                Código do autenticador
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button disabled={busy}>Verificar código</button>
            </form>
          )}
          {qr && verified && (
            <p>
              Confirme o novo fator após sair e entrar novamente, ou cancele o
              cadastro abaixo.
            </p>
          )}
          {factor && (
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (
                    !window.confirm(
                      "Remover este autenticador? A administração continuará exigindo duas etapas.",
                    )
                  )
                    return;
                  const result = await supabase!.auth.mfa.unenroll({
                    factorId: factor,
                  });
                  if (result.error) throw result.error;
                  const refreshed = await supabase!.auth.refreshSession();
                  if (refreshed.error) throw refreshed.error;
                  setQr("");
                  setCode("");
                  await load();
                })
              }
            >
              Remover autenticador selecionado
            </button>
          )}
          {(verified || !required) && (
            <p>
              <a href={destination === "/security" ? "/app" : destination}>
                Continuar para a plataforma
              </a>
            </p>
          )}
          <p>
            Sem acesso ao autenticador? Procure o operador pelo canal de suporte
            verificado. Não envie senhas ou códigos.
          </p>
        </>
      )}
      <Link to="/app/profile">Voltar ao perfil</Link>
    </section>
  );
}
