import { appendKnowledgeToCoach } from "../knowledge/coach.ts";
import { tokens,isCurrentQuestion,type KnowledgeRow } from "../knowledge/domain.ts";
import { appendRoadAnswer, type RoadSummary } from "./road.ts";
import { appendMetaAnswer, type MetaReferenceData } from "./meta.ts";
import {
  classify,
  rulesAnswer,
  type Context,
  type Preferences,
} from "./domain.ts";
import { retrieve } from "./knowledge.ts";
import { requestSchema } from "./schema.ts";
import type { CoachProvider } from "./provider.ts";
import { officialSnapshot } from "./official.ts";
export interface CoachBackend {
  authenticate(token: string): Promise<boolean>;
  preferences(): Promise<Preferences>;
  rpc(name: string, args: Record<string, unknown>): Promise<unknown>;
}
export function coachHandler(deps: {
  backend: (token: string) => CoachBackend;
  origin: string;
  provider?: CoachProvider;
  official?: typeof officialSnapshot;
}) {
  return async (req: Request) => {
    const headers = {
      "Access-Control-Allow-Origin": deps.origin,
      "Access-Control-Allow-Headers":
        "authorization,x-client-info,apikey,content-type",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    const reply = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), { status, headers });
    if (req.headers.get("origin") && req.headers.get("origin") !== deps.origin)
      return reply({ error: "Origem não permitida." }, 403);
    if (req.method === "OPTIONS") return new Response(null, { headers });
    if (req.method !== "POST")
      return reply({ error: "Método não permitido." }, 405);
    const token = req.headers
      .get("authorization")
      ?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token)
      return reply({ error: "Entre na sua conta para usar o Coach." }, 401);
    try {
      const db = deps.backend(token);
      if (!(await db.authenticate(token)))
        return reply({ error: "Sessão inválida. Entre novamente." }, 401);
      // Read bodies incrementally; the Content-Length header is not trusted.
      if (!req.body) return reply({ error: "Solicitação vazia." }, 400);
      const reader = req.body.getReader(),
        chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          bytes += next.value.length;
          if (bytes > 16000) {
            await reader.cancel();
            return reply({ error: "Solicitação muito grande." }, 413);
          }
          chunks.push(next.value);
        }
      } finally {
        reader.releaseLock();
      }
      const buffer = new Uint8Array(bytes);
      let offset = 0;
      for (const c of chunks) {
        buffer.set(c, offset);
        offset += c.length;
      }
      let input;
      try {
        input = requestSchema.parse(
          JSON.parse(new TextDecoder().decode(buffer)),
        );
      } catch {
        return reply({ error: "Revise os parâmetros da solicitação." }, 400);
      }
      const pref = await db.preferences();
      if (input.op !== "ask") {
        await db.rpc("coach_reserve", { p_external: false });
        if (input.op === "propose")
          return reply(
            await db.rpc("coach_propose", { p_payload: input.payload }),
          );
        return reply(
          await db.rpc("coach_confirm", {
            p_id: input.id,
            p_confirmation: input.confirmation,
          }),
        );
      }
      const q = classify(input.message, input.exercise_id);
      if (input.tournament_id) q.intent = "competition";
      const blocked =
        /senha|credencial|diagn[oó]stico|rem[eé]dio|sem dormir|dados.*outro|outra conta/i.test(
          q.message,
        );
      const external =
        !!deps.provider &&
        pref.external_enabled &&
        pref.consent_version === "coach-v1" &&
        !blocked;
      await db.rpc("coach_reserve", { p_external: external });
      const context = blocked
        ? {}
        : ((await db.rpc("coach_context", {
            p_intent: q.intent,
            p_days: q.days,
            p_category: q.category,
            p_exercise: q.exercise_id || null,
          })) as Context);
      if (!blocked && input.tournament_id)
        context.tournaments = (await db.rpc("coach_competitive_event", {
          p_tournament: input.tournament_id,
        })) as Context["tournaments"];
      const k = retrieve(q.message),
        answer = rulesAnswer(q, context, k.references, k.definitions);
      if (
        !pref.context_enabled &&
        !input.tournament_id &&
        !blocked &&
        ["report", "agenda", "competition"].includes(q.intent)
      ) {
        answer.sections = [
          {
            title: "Autorize o contexto individual",
            items: [
              "Seus registros privados não foram consultados. Ative a personalização nas preferências para analisar sessões, agenda ou favoritos.",
            ],
          },
        ];
        answer.scope = [];
      }
      if (!pref.context_enabled && !blocked)
        answer.notice =
          "Personalização desativada. Autorize o uso dos registros para relatórios e agenda individuais.";
      if (input.tournament_id && !blocked) {
        answer.scope = [
          "Evento público selecionado",
          "Fonte e validade editorial",
        ];
        if (!pref.context_enabled)
          answer.notice =
            "Consulta ao catálogo público; registros privados não foram consultados.";
      }
      if (
        pref.context_enabled &&
        !blocked &&
        /perfil|modalidade.*selecion|formato.*selecion/i.test(q.message)
      ) {
        const profile = (await db.rpc("coach_competitive_profile", {})) as {
          mode?: string;
          format?: string;
          context_id?: string;
        } | null;
        answer.sections.push({
          title: "Meu perfil competitivo",
          items: [
            profile?.mode
              ? `${profile.mode}; formato de prática: ${profile.format || "não informado"}; contexto editorial: ${profile.context_id || "não selecionado"}. Seu formato de prática não confirma o formato de um torneio.`
              : "Nenhuma preferência competitiva específica foi salva.",
          ],
        });
      }
      if (input.meta_context_id && !blocked) {
        const references = await db.rpc("coach_meta_context", {
          p_context: input.meta_context_id,
          p_query: q.message,
        });
        appendMetaAnswer(
          answer,
          references as MetaReferenceData[],
          input.meta_context_id,
        );
      }
      if (input.journey_id && pref.context_enabled && !blocked) {
        appendRoadAnswer(answer, await db.rpc("coach_learning_journey", {p_journey:input.journey_id}) as RoadSummary | null);
      }
      if (!blocked && ["knowledge", "exercise"].includes(q.intent)) {
        // Optional during staged rollout; the established Coach remains available before migration 024.
        const rows = await db.rpc("retrieve_knowledge", {p_query:tokens(q.message).join(" ")||q.message,p_preview:false,p_current:isCurrentQuestion(q.message)}).catch(()=>[]);
        appendKnowledgeToCoach(answer,q.message,rows as KnowledgeRow[]);
      }
      if (external) {
        try {
          if (q.intent === "competition") {
            const source =
              context.tournaments?.find(
                (t) =>
                  Date.parse(t.valid_until) >= Date.now() &&
                  !["finished", "cancelled"].includes(t.status),
              )?.source_url ||
              "https://www.fortnite.com/competitive/rules-guidelines/rules-library";
            const live = await (deps.official || officialSnapshot)(source);
            if (!live) throw new Error("official_unavailable");
            // External page text stays in an explicitly untrusted data section.
            answer.sections.push({
              title:
                "Conteúdo oficial recuperado agora · não confirma sua agenda",
              items: [live.text],
            });
            answer.references.push({
              id: "official-live",
              title: "Fonte oficial consultada agora",
              url: live.url,
              verified_at: live.checked_at,
            });
          }
          const generated = await deps.provider!.generate(q, answer);
          answer.guidance = generated.guidance;
          answer.guidance_reference_ids = generated.citation_ids;
          answer.mode = "generative";
          // Do not display an unformatted scraped page as a factual result.
          answer.sections = answer.sections.filter(
            (s) => !s.title.startsWith("Conteúdo oficial recuperado"),
          );
          answer.notice =
            "Orientação gerada por IA. Pode conter erros; as observações acima são calculadas a partir dos registros. Hipóteses não são causas comprovadas.";
        } catch {
          answer.sections = answer.sections.filter(
            (s) => !s.title.startsWith("Conteúdo oficial recuperado"),
          );
          answer.notice =
            "A orientação externa está indisponível ou não passou na validação. A análise por regras continua disponível.";
        }
      } else if (!deps.provider && !answer.notice)
        answer.notice =
          "Assistência por regras: nenhum provedor generativo configurado.";
      if (pref.history_enabled) {
        try {
          const id = await db.rpc("coach_save_turn", {
            p_question: q.message,
            p_answer: answer,
            p_conversation: input.conversation_id || null,
          });
          if (typeof id === "string") answer.conversation_id = id;
        } catch {
          answer.notice =
            (answer.notice || "") +
            " Não foi possível salvar esta mensagem no histórico.";
        }
      }
      return reply(answer);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const quota = /limite|orçamento|limit/i.test(message);
      return reply(
        {
          error: quota
            ? "Limite de uso atingido. Tente mais tarde."
            : /conflito/i.test(message)
              ? "Conflito na agenda. Revise o horário e gere outra prévia."
              : "Não foi possível concluir. Revise a proposta ou tente novamente.",
        },
        quota ? 429 : 400,
      );
    }
  };
}
