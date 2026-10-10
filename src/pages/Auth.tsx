import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { supabase, configured } from "../lib/client";
import { useStore } from "../lib/store";
import { Heading } from "../components/ui";
export default function Auth() {
  const store = useStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "reset" | "update">(
    location.hash.includes("type=recovery") ||
      location.search.includes("recovery=1")
      ? "update"
      : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  if (store.session && mode !== "update") return <Navigate to="/app" replace />;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    store.run(async () => {
      if (!supabase)
        throw new Error(
          "Clutchfolio: configure o Supabase para habilitar contas.",
        );
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error)
          throw new Error(
            "Clutchfolio: não foi possível entrar. Confira os dados e a confirmação de e-mail.",
          );
        navigate("/app");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: location.origin + "/auth" },
        });
        if (error)
          throw new Error(
            "Clutchfolio: cadastro indisponível. Verifique os dados ou tente novamente mais tarde.",
          );
        setMessage(
          "Solicitação enviada. Se necessário, confirme o e-mail para continuar.",
        );
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/auth?recovery=1",
        });
        if (error) throw error;
        setMessage(
          "Se houver uma conta para este e-mail, você receberá instruções.",
        );
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Senha atualizada.");
        navigate("/app");
      }
    });
  };
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <span className="eyebrow">SEU PRÓXIMO CAPÍTULO</span>
        <h1>
          Menos improviso.
          <br />
          Mais intenção.
        </h1>
        <p>
          Organize seus treinos, acompanhe o cenário e construa um histórico que
          ajuda a decidir o próximo passo.
        </p>
        <LockKeyhole size={36} />
        <p className="small-text">
          Coletamos apenas o necessário para sua conta e seus registros. Você
          pode exportar ou excluir seus dados.
        </p>
      </div>
      <div className="panel auth-form">
        <Heading
          title={
            mode === "signup"
              ? "Crie seu espaço"
              : mode === "reset"
                ? "Recuperar acesso"
                : mode === "update"
                  ? "Nova senha"
                  : "Bom ter você por aqui"
          }
          description="Seu plano de jogo começa aqui."
        />
        {!configured && (
          <div className="alert">
            Contas ainda não foram ativadas nesta instalação. Explore a
            demonstração enquanto o responsável configura o Supabase.
          </div>
        )}
        <div className="tabs">
          {(["login", "signup", "reset"] as const).map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setMessage("");
              }}
            >
              {m === "login"
                ? "Entrar"
                : m === "signup"
                  ? "Criar conta"
                  : "Recuperar"}
            </button>
          ))}
          {location.search.includes("recovery=1") && (
            <button onClick={() => setMode("update")}>Nova senha</button>
          )}
        </div>
        <form onSubmit={submit}>
          {mode !== "update" && (
            <label>
              E-mail
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              Senha
              <input
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <small>Ao criar ou alterar, use pelo menos 8 caracteres.</small>
            </label>
          )}
          {mode === "signup" && (
            <label className="checkbox-label">
              <input type="checkbox" required />
              Li os <Link to="/legal/terms">termos</Link> e a{" "}
              <Link to="/legal/privacy">política de privacidade</Link>.
            </label>
          )}
          <button
            disabled={!configured || store.busy}
            className="button primary full"
          >
            {store.busy
              ? "Processando…"
              : mode === "signup"
                ? "Criar conta"
                : mode === "reset"
                  ? "Enviar instruções"
                  : mode === "update"
                    ? "Atualizar senha"
                    : "Entrar"}
            <ArrowRight size={16} />
          </button>
        </form>
        {message && (
          <p role="status" className="alert">
            {message}
          </p>
        )}
        <button
          className="text-link"
          onClick={() => {
            store.enterDemo();
            navigate("/onboarding");
          }}
        >
          Explorar sem cadastro
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
