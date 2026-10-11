import { boundedText } from "./bounded-body.ts";
export interface RecruitmentDependencies {
  user(token: string): Promise<string | null>;
  reserve(token: string): Promise<boolean>;
  issue(user: string, cycle: string): Promise<string>;
  submit(
    token: string,
    cycle: string,
    payload: unknown,
    ticket: string,
  ): Promise<string>;
  fetch: typeof fetch;
}
export function recruitmentHandler(
  d: RecruitmentDependencies,
  origin: string,
  secret: string,
) {
  return async (req: Request) => {
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers":
        "authorization,apikey,content-type,x-client-info",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      Vary: "Origin",
    };
    const reply = (status: number, error: string) =>
      new Response(JSON.stringify({ error }), { status, headers });
    if (req.headers.get("origin") && req.headers.get("origin") !== origin)
      return reply(403, "Origem não autorizada.");
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return reply(405, "Método não permitido.");
    if (!secret || !origin.startsWith("https://"))
      return reply(503, "Recrutamento ainda não configurado.");
    try {
      const token =
        req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
      const user = await d.user(token);
      if (!user) return reply(401, "Entre novamente.");
      if (!(await d.reserve(token)))
        return new Response(
          JSON.stringify({
            error: "Limite de solicitações. Aguarde dez minutos.",
          }),
          { status: 429, headers: { ...headers, "Retry-After": "600" } },
        );
      let body;
      try {
        body = JSON.parse(await boundedText(req, 24000));
      } catch {
        return reply(400, "Solicitação inválida ou muito grande.");
      }
      if (
        !body ||
        typeof body.cycle !== "string" ||
        !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(body.cycle) ||
        typeof body.captcha !== "string" ||
        !body.captcha ||
        body.captcha.length > 2048
      )
        return reply(400, "Confirme a verificação de segurança.");
      const response = await d.fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({ secret, response: body.captcha }),
        },
      );
      if (!response.ok)
        return reply(503, "Verificação temporariamente indisponível.");
      const result = JSON.parse(await boundedText(response, 8192));
      if (
        result.success !== true ||
        result.hostname !== new URL(origin).hostname ||
        result.action !== "recruitment"
      )
        return reply(400, "Verificação inválida ou expirada. Tente novamente.");
      const ticket = await d.issue(user, body.cycle);
      const id = await d.submit(token, body.cycle, body.payload, ticket);
      return new Response(JSON.stringify({ id }), { status: 201, headers });
    } catch {
      return reply(
        503,
        "Não foi possível concluir a candidatura. Atualize e tente novamente.",
      );
    }
  };
}
