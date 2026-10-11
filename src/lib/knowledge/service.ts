import { supabase } from "../client";
import faq from "../../data/knowledge-faq.json";
import {
  askSchema,
  answerKnowledge,
  documentSchema,
  type KnowledgeDocument,
  type KnowledgeRow,
  type KnowledgeQuery,
  type KnowledgeAnswer,
} from "../../../supabase/functions/_shared/knowledge/domain";
export * from "../../../supabase/functions/_shared/knowledge/domain";
export type KnowledgeDraft = {
  id: string;
  version: number;
  payload: KnowledgeDocument;
  published_revision: number | null;
  archived: boolean;
  updated_at: string;
  updated_by: string | null;
};
export type KnowledgeSettings = {
  enabled: boolean;
  daily_limit: number;
  minute_limit: number;
  external_enabled: boolean;
  detail: "concise" | "extended";
  epoch: number;
};
export const demoSettings: KnowledgeSettings = {
  enabled: true,
  daily_limit: 60,
  minute_limit: 6,
  external_enabled: false,
  detail: "concise",
  epoch: 1,
};
const failure = (e: unknown) => {
  if (e)
    throw new Error(
      "Operação não concluída. Confira permissões, campos e versão; recarregue se outro editor alterou o registro.",
    );
};
function db() {
  if (!supabase)
    throw new Error("Conecte uma conta administrativa para gerenciar a base.");
  return supabase;
}
export async function settings(demo = false): Promise<KnowledgeSettings> {
  if (demo || !supabase) return demoSettings;
  const { data, error } = await supabase
    .from("knowledge_settings")
    .select("*")
    .single();
  failure(error);
  return data;
}
export async function askKnowledge(
  input: KnowledgeQuery,
  demo = false,
): Promise<KnowledgeAnswer> {
  const q = askSchema.parse(input);
  if (demo || !supabase) {
    if (q.preview)
      throw new Error(
        "Testes de rascunhos exigem autorização administrativa no servidor.",
      );
    const key = "clutchfolio-knowledge-demo-usage";
    const now = Date.now();
    let v: {
      day: string;
      minute: number;
      requests: number;
      minute_requests: number;
    } = {
      day: new Date().toISOString().slice(0, 10),
      minute: Math.floor(now / 60000),
      requests: 0,
      minute_requests: 0,
    };
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved?.day === v.day)
        v = {
          ...saved,
          minute_requests:
            saved.minute === v.minute ? saved.minute_requests : 0,
          minute: v.minute,
        };
    } catch {
      throw new Error("Não foi possível verificar o limite da demonstração.");
    }
    if (v.requests >= 60 || v.minute_requests >= 6)
      throw new Error("Limite da demonstração atingido. Tente mais tarde.");
    v.requests++;
    v.minute_requests++;
    localStorage.setItem(key, JSON.stringify(v));
    const result = answerKnowledge(q, faq as KnowledgeRow[]);
    result.notice +=
      " Demonstração local; nenhuma chamada externa ou registro de perguntas.";
    return result;
  }
  const { data, error } = await supabase.functions.invoke(
    "fortnite-knowledge",
    { body: q },
  );
  if (error || data?.error)
    throw new Error(
      data?.error ||
        "O assistente não pôde responder. Confira a sessão e tente novamente.",
    );
  return data;
}
export async function loadAdmin() {
  const c = db();
  const [d, r, m, s] = await Promise.all([
    c
      .from("knowledge_drafts")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500),
    c
      .from("knowledge_revisions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
    c
      .from("knowledge_diagnostics")
      .select("kind,topic,created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    settings(),
  ]);
  failure(d.error || r.error || m.error);
  return {
    drafts: (d.data || []) as KnowledgeDraft[],
    revisions: (r.data || []) as {
      id: string;
      version: number;
      payload: KnowledgeDocument;
      action: string;
      created_at: string;
    }[],
    diagnostics: (m.data || []) as {
      kind: string;
      topic: string;
      created_at: string;
    }[],
    settings: s,
  };
}
export async function saveKnowledge(
  p: KnowledgeDocument,
  d?: KnowledgeDraft | null,
) {
  documentSchema.parse(p);
  const { data, error } = await db().rpc("save_knowledge", {
    p_id: d?.id || null,
    p_expected: d?.version || 0,
    p_payload: p,
  });
  failure(error);
  return data as KnowledgeDraft;
}
export async function manageKnowledge(
  d: KnowledgeDraft,
  action: "publish" | "withdraw" | "archive" | "restore",
  version?: number,
) {
  const { data, error } = await db().rpc("manage_knowledge", {
    p_id: d.id,
    p_expected: d.version,
    p_action: action,
    p_confirmation: action.toUpperCase(),
    p_restore: version || null,
  });
  failure(error);
  return data as KnowledgeDraft;
}
export async function configureKnowledge(s: KnowledgeSettings) {
  const { error } = await db().rpc("configure_knowledge", {
    p_enabled: s.enabled,
    p_daily: s.daily_limit,
    p_minute: s.minute_limit,
    p_external: s.external_enabled,
    p_detail: s.detail,
  });
  failure(error);
}
export async function refreshKnowledge() {
  const { data, error } = await db().rpc("refresh_knowledge");
  failure(error);
  return data as number;
}

export async function providerStatus() {
  const { data, error } = await db().functions.invoke("fortnite-knowledge", {
    body: { op: "status" },
  });
  if (error || data?.error)
    throw new Error(
      "Status do servidor indisponível. Verifique a implantação da função e sua sessão.",
    );
  return data as {
    enabled: boolean;
    provider: string | null;
    provider_configured: boolean;
    limits: string;
    billing: string;
  };
}
