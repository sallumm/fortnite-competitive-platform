import { TrainingStepTransition } from "../components/experience/primitives";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useStore } from "../lib/store";
import { supabase } from "../lib/client";
import {
  defaults,
  demoAnswer,
  type Preferences,
  type Answer,
  type Turn,
  type Conversation,
} from "../lib/coach";
import { safeURL } from "../../supabase/functions/_shared/coach/domain";
import { CoachPlanning } from "../components/CoachPlanning";
import { Heading } from "../components/ui";
const suggestions = [
  "O que devo treinar hoje?",
  "Como foi minha evolução nos últimos 30 dias?",
  "Organize meus treinos para terça, quinta e sábado.",
  "Quero melhorar em box fights. Por onde começo?",
  "Qual campeonato salvei para sábado?",
];
export default function Coach() {
  const s = useStore(),
    owner = s.data.profile!.id,
    [params, setParams] = useSearchParams();
  const localKey = "clutchfolio-coach-demo:" + owner;
  const [pref, setPref] = useState<Preferences>(defaults),
    [ready, setReady] = useState(false),
    [settings, setSettings] = useState(false),
    [message, setMessage] = useState(params.get("q") || "");
  const [turns, setTurns] = useState<Turn[]>([]),
    [conversations, setConversations] = useState<Conversation[]>([]),
    [conversation, setConversation] = useState<string | undefined>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [deleteConfirm, setDeleteConfirm] = useState(false);
  const end = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null),
    alive = useRef(true);
  const history = useRef<Record<string, Turn[]>>({});
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (s.demo) {
          const stored = JSON.parse(localStorage.getItem(localKey) || "{}");
          if (!cancelled) {
            setPref({ ...defaults, ...stored.pref, external_enabled: false });
            history.current = stored.history || {};
            setConversations(stored.conversations || []);
          }
        } else if (supabase) {
          const { data, error } = await supabase
            .from("coach_preferences")
            .select("*")
            .eq("id", owner)
            .maybeSingle();
          if (error) throw error;
          if (!cancelled) {
            setPref(data || defaults);
            const result = await supabase
              .from("coach_conversations")
              .select("id,title,created_at")
              .order("created_at", { ascending: false })
              .limit(100);
            if (result.error) throw result.error;
            setConversations(result.data || []);
          }
        }
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled)
          setError(
            "Não foi possível carregar o Coach. Verifique se a migração e a função de servidor foram configuradas.",
          );
      }
    }
    void load();
    return () => {
      cancelled = true;
      setTurns([]);
    };
  }, [owner, s.demo, localKey]);
  useEffect(() => {
    const q = params.get("q");
    if (q) {
      setMessage(q);
      setTurns([]);
      setConversation(undefined);
    }
  }, [params]);
  useEffect(() => {
    end.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [turns.length, busy]);
  function persist(nextPref = pref, nextConversations = conversations) {
    if (s.demo)
      localStorage.setItem(
        localKey,
        JSON.stringify({
          pref: nextPref,
          history: history.current,
          conversations: nextConversations,
        }),
      );
  }
  async function updatePref(key: keyof Preferences, value: boolean) {
    setBusy(true);
    setError("");
    const next = {
      ...pref,
      [key]: value,
      consent_version:
        key === "external_enabled" && value ? "coach-v1" : pref.consent_version,
    };
    try {
      if (!s.demo && supabase) {
        const { error } = await supabase
          .from("coach_preferences")
          .upsert({ id: owner, ...next });
        if (error) throw error;
      }
      setPref(next);
      persist(next);
    } catch {
      setError("Não foi possível salvar sua preferência. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  async function call(body: unknown): Promise<unknown> {
    if (!supabase) throw Error("Servidor não configurado.");
    const { data, error } = await supabase.functions.invoke("clutch-coach", {
      body: body as Record<string, unknown>,
    });
    if (error) {
      let detail = "Coach indisponível. Tente novamente.";
      if ("context" in error && error.context instanceof Response) {
        try {
          const json = await error.context.json();
          if (json.error) detail = json.error;
        } catch {
          /* generic failure */
        }
      }
      throw Error(detail);
    }
    if (data?.error) throw Error(data.error);
    return data;
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    const question = message.trim();
    if (!ready || busy || !question) return;
    setBusy(true);
    setError("");
    setDeleteConfirm(false);
    try {
      const exercise = params.get("exercise") || undefined;
      const answer = s.demo
        ? demoAnswer(
            s.data,
            s.catalog,
            question,
            pref,
            exercise,
            params.get("tournament") || undefined,
          )
        : ((await call({
            op: "ask",
            message: question,
            exercise_id: exercise,
            tournament_id: params.get("tournament") || undefined,
            conversation_id: pref.history_enabled ? conversation : undefined,
          })) as Answer);
      if (!alive.current) return;
      let id = answer.conversation_id || conversation;
      const turn: Turn = {
          id: crypto.randomUUID(),
          question,
          answer,
          created_at: new Date().toISOString(),
        },
        nextTurns = [...turns, turn];
      if (pref.history_enabled && (s.demo || answer.conversation_id)) {
        if (!id) id = crypto.randomUUID();
        setConversation(id);
        const next = conversations.some((c) => c.id === id)
          ? conversations
          : [
              { id, title: question.slice(0, 80), created_at: turn.created_at },
              ...conversations,
            ];
        setConversations(next);
        if (s.demo) {
          history.current[id] = [...(history.current[id] || []), turn];
          persist(pref, next);
        }
      }
      setTurns(nextTurns);
      setMessage("");
      setParams({}, { replace: true });
      input.current?.focus();
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function open(id: string) {
    setBusy(true);
    setError("");
    try {
      if (s.demo) setTurns(history.current[id] || []);
      else if (supabase) {
        const { data, error } = await supabase
          .from("coach_messages")
          .select("id,question,answer,created_at")
          .eq("conversation_id", id)
          .order("created_at")
          .limit(100);
        if (error) throw error;
        setTurns(data || []);
      }
      setConversation(id);
      setParams({}, { replace: true });
    } catch {
      setError("Não foi possível abrir esta conversa.");
    } finally {
      setBusy(false);
    }
  }
  async function erase() {
    setBusy(true);
    setError("");
    try {
      if (s.demo) {
        history.current = {};
        persist(pref, []);
      } else if (supabase) {
        const { error } = await supabase
          .from("coach_conversations")
          .delete()
          .eq("user_id", owner);
        if (error) throw error;
      }
      setConversations([]);
      setTurns([]);
      setConversation(undefined);
      setDeleteConfirm(false);
    } catch {
      setError("Não foi possível excluir o histórico.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="SEU TREINAMENTO, COM CONTEXTO"
        title="Clutch Coach"
        description="Entenda seus registros, encontre exercícios e planeje os próximos passos."
        action={
          <button
            className="button"
            onClick={() => setSettings(!settings)}
            aria-expanded={settings}
          >
            <SlidersHorizontal size={16} />
            Privacidade e preferências
          </button>
        }
      />
      {settings && (
        <section className="panel coach-settings">
          <h2>Você controla o contexto</h2>
          <p>
            Os registros são consultados por assunto. Nome, e-mail, XP e dados
            de outras contas não são enviados ao modelo. Não escreva senhas ou
            informações sensíveis.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={pref.context_enabled}
              disabled={!ready || busy}
              onChange={(e) =>
                void updatePref("context_enabled", e.target.checked)
              }
            />
            Autorizar consulta aos meus registros para personalização
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={pref.external_enabled}
              disabled={!ready || busy || s.demo}
              onChange={(e) =>
                void updatePref("external_enabled", e.target.checked)
              }
            />
            Autorizar envio da pergunta e do contexto selecionado à OpenAI
          </label>
          <p className="small-text muted">
            Opcional. Quando configurada, a OpenAI recebe sua pergunta,
            observações resumidas e referências. A API não usa esses dados para
            treinamento por padrão; registros de prevenção de abuso podem ser
            retidos por até 30 dias. Desativar impede novos envios. A
            demonstração funciona somente por regras.{" "}
            <a
              href="https://developers.openai.com/api/docs/guides/your-data"
              target="_blank"
              rel="noreferrer"
            >
              Política do provedor
            </a>
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={pref.history_enabled}
              disabled={!ready || busy}
              onChange={(e) =>
                void updatePref("history_enabled", e.target.checked)
              }
            />
            Salvar histórico de novas mensagens{" "}
            {s.demo ? "neste navegador" : "na minha conta"}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={pref.proactive_enabled}
              disabled={!ready || busy}
              onChange={(e) =>
                void updatePref("proactive_enabled", e.target.checked)
              }
            />
            Mostrar sugestões do Coach ao abrir Meu Dia
          </label>
          <p className="small-text muted">
            Sugestões apenas com o site aberto, sem notificações em segundo
            plano.
          </p>
          <button
            className="button"
            disabled={busy || !conversations.length}
            onClick={() => setDeleteConfirm(true)}
          >
            <Trash2 size={16} />
            Excluir todo o histórico
          </button>
          {deleteConfirm && (
            <div className="alert">
              <p>
                Excluir permanentemente todas as conversas salvas da sua conta?
              </p>
              <button
                className="button"
                disabled={busy}
                onClick={() => void erase()}
              >
                Confirmar exclusão do histórico
              </button>
              <button
                className="button"
                onClick={() => setDeleteConfirm(false)}
              >
                Voltar
              </button>
            </div>
          )}
        </section>
      )}
      <div className="coach-layout">
        <aside className="coach-conversations panel" aria-label="Conversas">
          <button
            className="button"
            disabled={busy}
            onClick={() => {
              setTurns([]);
              setConversation(undefined);
              setMessage("");
              setParams({}, { replace: true });
              input.current?.focus();
            }}
          >
            <Plus size={16} />
            Nova conversa
          </button>
          <h2>Conversas</h2>
          <p className="small-text muted">
            {pref.history_enabled
              ? "Histórico ativado."
              : "Histórico desligado. Novas mensagens ficam apenas nesta página."}
          </p>
          {conversations.map((c) => (
            <button
              key={c.id}
              className={
                "coach-conversation " +
                (conversation === c.id ? "selected" : "")
              }
              disabled={busy}
              onClick={() => void open(c.id)}
            >
              <MessageSquare size={16} />
              <span>{c.title}</span>
            </button>
          ))}
          <Link className="text-link" to="/app/planner">
            Meu calendário
          </Link>
          <Link className="text-link" to="/app/reports">
            Meus relatórios
          </Link>
          <Link className="text-link" to="/library">
            Biblioteca
          </Link>
        </aside>
        <section
          className="coach-chat panel"
          aria-label="Conversa com Clutch Coach"
        >
          <div className="coach-chat-header">
            <ShieldCheck size={19} />
            <div>
              <strong>Clutch Coach</strong>
              <small>
                {s.demo
                  ? "Demonstração local · regras"
                  : "Contexto autenticado · IA externa opcional"}
              </small>
            </div>
          </div>
          <div
            className="coach-transcript"
            role="log"
            aria-live="polite"
            aria-label="Mensagens"
          >
            {!turns.length && (
              <div className="coach-welcome">
                <span className="eyebrow">UM PRÓXIMO PASSO CONCRETO</span>
                <h2>O que você quer trabalhar hoje?</h2>
                <p>
                  Comece com uma habilidade, um período do seu histórico ou sua
                  agenda. O Coach distingue registros de hipóteses.
                </p>
                <div className="coach-suggestions">
                  {suggestions.map((q) => (
                    <button
                      className="button"
                      key={q}
                      disabled={busy}
                      onClick={() => {
                        setMessage(q);
                        input.current?.focus();
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                {!pref.context_enabled && (
                  <button
                    className="text-link"
                    onClick={() => setSettings(true)}
                  >
                    Ativar personalização nas preferências
                  </button>
                )}
              </div>
            )}
            {turns.map((t) => (
              <TrainingStepTransition identity={t.id} key={t.id}>
                <article className="coach-turn">
                  <div className="coach-user">
                    <span className="small-text">VOCÊ</span>
                    <p>{t.question}</p>
                  </div>
                  <div className="coach-answer">
                    <span className="eyebrow">
                      {t.answer.mode === "generative"
                        ? "ANÁLISE + ORIENTAÇÃO POR IA"
                        : "ASSISTÊNCIA POR REGRAS"}
                    </span>
                    {t.answer.sections.map((section, i) => (
                      <section key={i}>
                        <h3>{section.title}</h3>
                        <ul>
                          {section.items.map((line, j) => (
                            <li key={j}>{line}</li>
                          ))}
                        </ul>
                      </section>
                    ))}
                    {t.answer.guidance && (
                      <section className="coach-guidance">
                        <h3>Orientação gerada · hipóteses e sugestões</h3>
                        <p>{t.answer.guidance}</p>
                        <p className="small-text">
                          Referências:{" "}
                          {t.answer.references
                            .filter((r) =>
                              t.answer.guidance_reference_ids?.includes(r.id),
                            )
                            .map((r) => (
                              <a key={r.id} href={safeURL(r.url)}>
                                {r.title} ·{" "}
                              </a>
                            ))}
                        </p>
                      </section>
                    )}
                    <p className="small-text muted">{t.answer.notice}</p>
                    <details>
                      <summary>Contexto e referências</summary>
                      <p>
                        Dados consultados:{" "}
                        {t.answer.scope.join(", ") || "nenhum dado privado"}.
                      </p>
                      <div className="coach-references">
                        {t.answer.references
                          .filter((r) => safeURL(r.url))
                          .map((r) =>
                            r.url.startsWith("/") ? (
                              <Link key={r.id} to={r.url}>
                                {r.title}
                              </Link>
                            ) : (
                              <a
                                key={r.id}
                                href={r.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {r.title}
                                {r.verified_at
                                  ? " · " + r.verified_at.slice(0, 10)
                                  : ""}
                              </a>
                            ),
                          )}
                      </div>
                    </details>
                  </div>
                </article>
              </TrainingStepTransition>
            ))}
            {busy && (
              <p className="coach-loading" role="status">
                Consultando os registros necessários…
              </p>
            )}
            <div ref={end} />
          </div>
          {error && (
            <p role="alert" className="alert error">
              {error}
            </p>
          )}
          <form className="coach-composer" onSubmit={send}>
            <label htmlFor="coach-message">Sua mensagem</label>
            <div className="row">
              <textarea
                ref={input}
                id="coach-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="O que devo treinar hoje?"
                required
                disabled={busy || !ready}
              />
              <button
                className="button primary"
                type="submit"
                disabled={busy || !ready || !message.trim()}
                aria-label="Enviar mensagem"
              >
                <Send size={18} />
                <span>Enviar</span>
              </button>
            </div>
            <small className="muted">
              {message.length}/2000 · Observe os registros e confira as fontes.
              O Coach pode errar.
            </small>
          </form>
        </section>
      </div>
      {turns.at(-1)?.answer.planning && (
        <CoachPlanning
          key={turns.at(-1)!.id}
          question={turns.at(-1)!.question}
          call={call}
        />
      )}
    </>
  );
}
