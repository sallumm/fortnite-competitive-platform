import { supabase } from "../client";
import {
  applicationSchema,
  closedPortal,
  type Portal,
  type Workspace,
  type AdminData,
} from "./domain";
export async function esportsRPC<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!supabase)
    throw new Error("A configuração de esports ainda não está disponível.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const message = error.message || "";
    if (/Version conflict/.test(message))
      throw new Error(
        "Este registro mudou. Atualize os dados antes de salvar.",
      );
    if (/Recruitment closed|Launch review/.test(message))
      throw new Error(
        "Recrutamento fechado. A abertura depende de revisão e configuração.",
      );
    if (/authorization|Minor protection/.test(message))
      throw new Error(
        "Autorização do responsável e revisão de proteção pendentes.",
      );
    if (/Application already/.test(message))
      throw new Error("Você já possui uma candidatura neste ciclo.");
    if (/Authentication|Administrative|unavailable|permission/.test(message))
      throw new Error("Sua conta não possui acesso a esta operação.");
    throw new Error(
      "A operação não foi concluída. Confira os campos e tente novamente.",
    );
  }
  return data as T;
}
export const loadPortal = () =>
  supabase
    ? esportsRPC<Portal>("esports_portal")
    : Promise.resolve(closedPortal);
export const loadWorkspace = () => esportsRPC<Workspace>("esports_workspace");
export const loadAdmin = (query = "", offset = 0) =>
  esportsRPC<AdminData>("esports_admin_data", {
    p_query: query,
    p_offset: offset,
  });
export async function submitApplication(
  cycle: string,
  payload: unknown,
  captcha: string,
) {
  if (!supabase || !captcha)
    throw new Error("kyrven: conclua a verificação de segurança.");
  const { data, error } = await supabase.functions.invoke(
    "recruitment-submit",
    { body: { cycle, payload: applicationSchema.parse(payload), captcha } },
  );
  if (error || !data?.id)
    throw new Error(
      "kyrven: candidatura não concluída. Atualize os dados e tente novamente; se houver limite, aguarde dez minutos.",
    );
  return data.id as string;
}
export const withdrawApplication = (id: string) =>
  esportsRPC<void>("esports_withdraw", { p_application: id });
export const adminAction = (
  action: string,
  id: string | null,
  expected: number,
  payload: unknown,
) =>
  esportsRPC<Record<string, unknown>>("esports_admin_action", {
    p_action: action,
    p_id: id,
    p_expected: expected,
    p_payload: payload,
  });
