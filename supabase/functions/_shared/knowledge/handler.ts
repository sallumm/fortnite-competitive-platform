import {
  askSchema,
  answerKnowledge,
  tokens,
  isCurrentQuestion,
  scopeOf,
  type KnowledgeRow,
} from "./domain.ts";
import type { CoachProvider } from "../coach/provider.ts";
import { classify, type Answer } from "../coach/domain.ts";
export type KnowledgeBackend = {
  authenticate(token: string): Promise<boolean>;
  rpc(name: string, args: Record<string, unknown>): Promise<unknown>;
  settings(): Promise<{
    enabled: boolean;
    external_enabled: boolean;
    detail: string;
  }>;
  editorial(
    query: string,
    mode: string,
    season: string,
    version: string,
    region: string,
    current: boolean,
  ): Promise<KnowledgeRow[]>;
};
export function knowledgeHandler(deps: {
  backend: (token: string) => KnowledgeBackend;
  origin: string;
  provider?: CoachProvider;
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
    const reply = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    if (req.headers.get("origin") && req.headers.get("origin") !== deps.origin)
      return reply({ error: "Origem não permitida." }, 403);
    if (req.method === "OPTIONS") return new Response(null, { headers });
    if (req.method !== "POST")
      return reply({ error: "Método não permitido." }, 405);
    const token = req.headers
      .get("authorization")
      ?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token)
      return reply(
        { error: "Entre na sua conta para consultar o assistente." },
        401,
      );
    try {
      const db = deps.backend(token);
      if (!(await db.authenticate(token)))
        return reply({ error: "Sessão inválida." }, 401);
      if (!req.body) return reply({ error: "Solicitação vazia." }, 400);
      const reader = req.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        for (;;) {
          const n = await reader.read();
          if (n.done) break;
          bytes += n.value.length;
          if (bytes > 12000) {
            await reader.cancel();
            return reply({ error: "Solicitação muito grande." }, 413);
          }
          chunks.push(n.value);
        }
      } finally {
        reader.releaseLock();
      }
      const buf = new Uint8Array(bytes);
      let at = 0;
      for (const c of chunks) {
        buf.set(c, at);
        at += c.length;
      }
      const raw = JSON.parse(new TextDecoder().decode(buf));
      if (raw?.op === "status") {
        if (!(await db.rpc("is_admin", {})))
          return reply({ error: "Acesso administrativo restrito." }, 403);
        const config = await db.settings();
        return reply({
          enabled: config.enabled,
          external_allowed: config.external_enabled,
          provider: deps.provider?.name || null,
          provider_configured: !!deps.provider,
          limits:
            "20 chamadas externas por usuário/dia; 500 globais/dia, compartilhadas com Coach",
          billing:
            "Consumo monetário real não disponível sem integração ao faturamento.",
        });
      }
      const parsed = askSchema.safeParse(raw);
      if (!parsed.success)
        return reply({ error: "Revise os campos da pergunta." }, 400);
      const q = parsed.data;
      await db.rpc("reserve_knowledge", { p_preview: q.preview });
      const settings = await db.settings();
      const query = tokens(q.message).join(" ");
      const rows = (await db.rpc("retrieve_knowledge", {
        p_query: query || q.message,
        p_preview: q.preview,
        p_mode: q.mode,
        p_season: q.season,
        p_version: q.version,
        p_region: q.region,
        p_current: isCurrentQuestion(q.message),
      })) as KnowledgeRow[];
      const editorial = await db.editorial(
        query,
        q.mode,
        q.season,
        q.version,
        q.region,
        isCurrentQuestion(q.message),
      );
      const answer = answerKnowledge(
        q,
        [...rows, ...editorial],
        new Date(),
        q.preview,
      );
      if (
        settings.detail === "concise" &&
        !/diferen|compar| versus | vs /i.test(q.message)
      )
        answer.sections = answer.sections.slice(0, 1);
      if (q.preview)
        answer.notice +=
          " Teste administrativo privado; rascunhos não são publicados.";
      if (
        q.external &&
        q.consent === "knowledge-v1" &&
        settings.external_enabled &&
        deps.provider &&
        !answer.missing &&
        answer.references.length &&
        answer.sections.length &&
        !q.preview
      ) {
        let providerAttempted = false;
        try {
          await db.rpc("coach_reserve", { p_external: true });
          const grounded: Answer = {
            mode: "rules",
            sections: answer.sections.map((s) => ({
              title: s.title,
              items: [s.text],
            })),
            references: answer.references.map((r) => ({
              id: r.id,
              title: r.title,
              url: r.url,
              verified_at: r.verified_at,
            })),
            scope: ["Conhecimento público revisado, sem registros privados"],
            notice: answer.notice,
          };
          providerAttempted = true;
          const generated = await deps.provider.generate(
            classify(q.message),
            grounded,
          );
          answer.summary = generated.guidance;
          answer.mode = "generative";
          answer.provider = deps.provider.name;
          answer.notice =
            "Orientação gerada por modelo externo com fontes públicas selecionadas. Nenhum registro privado foi consultado.";
        } catch {
          answer.notice +=
            " O modelo externo não ficou disponível; mantida a explicação fundamentada.";
          if (providerAttempted)
            await db
              .rpc("knowledge_diagnostic", {
                p_kind: "provider_failure",
                p_topic: "",
              })
              .catch(() => {});
        }
      }
      if (!q.preview)
        await db
          .rpc("knowledge_diagnostic", {
            p_kind: answer.missing ? "missing" : "served",
            p_topic:
              q.diagnostics && scopeOf(q.message) === "fortnite"
                ? tokens(q.message).slice(0, 8).join(" ").slice(0, 200)
                : "",
          })
          .catch(() => {});
      return reply(answer);
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      if (e instanceof SyntaxError)
        return reply({ error: "Solicitação JSON inválida." }, 400);
      if (/desativado/.test(m))
        return reply(
          { error: "Fortnite Knowledge está temporariamente desativado." },
          503,
        );
      if (/limite/.test(m))
        return reply(
          { error: "Limite de consultas atingido. Tente mais tarde." },
          429,
        );
      if (/Administrative/.test(m))
        return reply({ error: "Acesso administrativo restrito." }, 403);
      return reply(
        { error: "A consulta não pôde ser concluída. Tente novamente." },
        500,
      );
    }
  };
}
