import { KnowledgeAccess } from "../components/KnowledgeAccess";
import { MotionPreferences } from "../components/experience/MotionSystem";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Download,
  MessageCircle,
  Search,
  Shield,
  Users,
} from "lucide-react";
import { useStore } from "../lib/store";
import { exportPlayerData } from "../lib/export-data";
import { clearLocalProductData } from "../lib/local-data";
import { supabase } from "../lib/client";
import { download, recommendations } from "../lib/logic";
import type { Profile } from "../lib/types";
import { labels } from "../lib/types";
import { Badge, Heading, Modal } from "../components/ui";
export function Help() {
  const s = useStore();
  const [query, setQuery] = useState("");
  const all = s.catalog.articles.filter((a) =>
    (a.title + " " + a.body).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <KnowledgeAccess />
      <Heading
        eyebrow="CENTRAL DE AJUDA"
        title="Encontre uma orientação clara."
        description="Busca em conteúdos revisados. Esta central usa regras e textos estruturados, não inteligência artificial generativa."
      />
      <div className="filters panel">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Buscar ajuda"
            placeholder="Ex.: VOD, sono, mira, campeonato…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="two-grid">
        {all.map((a) => (
          <Link
            className="panel"
            to={(a.kind === "lesson" ? "/academy/" : "/news/") + a.slug}
            key={a.id}
          >
            <BookOpen size={22} />
            <h3>{a.title}</h3>
            <p>{a.summary}</p>
            <span className="text-link">
              Consultar conteúdo
              <ArrowRight size={16} />
            </span>
          </Link>
        ))}
      </div>
      {s.data.profile && (
        <section className="panel">
          <h2>Exercícios para seu objetivo informado</h2>
          <p className="muted">
            Seleção por modalidade e objetivo do perfil, sem inferir desempenho.
          </p>
          {recommendations(s.catalog.exercises, s.data.profile)
            .slice(0, 3)
            .map((e) => (
              <Link className="list-row" key={e.id} to={"/library/" + e.id}>
                {e.title}
                <ArrowRight size={16} />
              </Link>
            ))}
        </section>
      )}
      <section className="panel">
        <h2>Dúvidas sobre dados recentes?</h2>
        <p>
          Não usamos conhecimento antigo para responder sobre horários,
          resultados ou regras atuais. Consulte as fontes oficiais:
        </p>
        <div className="row wrap">
          <a
            className="button"
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.fortnite.com/competitive/schedule"
          >
            Programação
            <ArrowUpRight size={16} />
          </a>
          <a
            className="button"
            target="_blank"
            rel="noopener noreferrer"
            href="https://www.fortnite.com/competitive/rules-guidelines/rules-library"
          >
            Regulamentos
            <ArrowUpRight size={16} />
          </a>
        </div>
      </section>
    </>
  );
}
export function Community() {
  const invite = import.meta.env.VITE_DISCORD_INVITE;
  const valid =
    invite && /^https:\/\/(discord\.gg\/|discord\.com\/invite\/)/.test(invite);
  return (
    <>
      <Heading
        eyebrow="COMUNIDADE"
        title="Evoluir também é trocar experiências."
        description="Um espaço para compartilhar estudos e apoiar uma prática responsável."
      />
      <section className="community-hero panel">
        <Users size={70} />
        <h2>Conexões além da sessão.</h2>
        <p>
          O Discord do projeto poderá reunir atualizações, suporte e conversas
          sobre treinamento. A conta na plataforma é independente do Discord.
        </p>
        {valid ? (
          <a
            className="button primary"
            href={invite}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={18} />
            Entrar na comunidade
          </a>
        ) : (
          <Badge>Convite da comunidade ainda não configurado</Badge>
        )}
        <p className="small-text muted">
          Não há monitoramento em tempo real ou canal de atendimento ativo
          anunciado nesta instalação.
        </p>
      </section>
      <div className="three-grid">
        {[
          [
            "Respeito",
            "Sem assédio, discriminação ou divulgação de dados pessoais.",
          ],
          [
            "Integridade",
            "Sem cheats, venda de contas ou promessas de resultados garantidos.",
          ],
          [
            "Privacidade",
            "Evite expor dados pessoais, especialmente de menores de idade.",
          ],
        ].map(([t, d]) => (
          <article className="panel" key={t}>
            <Shield size={22} />
            <h3>{t}</h3>
            <p>{d}</p>
          </article>
        ))}
      </div>
    </>
  );
}
export function ProfilePage() {
  const s = useStore();
  const [p, setP] = useState<Profile>(s.data.profile!);
  const [confirm, setConfirm] = useState(false);
  const [deletion, setDeletion] = useState("");
  return (
    <>
      <Heading
        eyebrow="MEU ESPAÇO"
        title="Seu perfil, suas preferências."
        description="Ajuste o plano ao seu momento. Você mantém o controle dos seus dados."
      />
      <section className="panel motion-settings">
        <h2>Uma experiência no seu ritmo</h2>
        <MotionPreferences />
      </section>
      <section className="panel profile-form">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            s.run(() => s.saveProfile(p), "Preferências salvas.");
          }}
        >
          <div className="form-grid">
            <label>
              Nome de exibição
              <input
                required
                maxLength={40}
                value={p.display_name}
                onChange={(e) => setP({ ...p, display_name: e.target.value })}
              />
            </label>
            {(["mode", "level", "objective", "input"] as const).map((key) => (
              <label key={key}>
                {key === "mode"
                  ? "Modalidade"
                  : key === "level"
                    ? "Experiência"
                    : key === "objective"
                      ? "Objetivo"
                      : "Dispositivo"}
                <select
                  value={p[key]}
                  onChange={(e) => setP({ ...p, [key]: e.target.value })}
                >
                  {(key === "mode"
                    ? ["build", "zero"]
                    : key === "level"
                      ? ["beginner", "intermediate", "advanced"]
                      : key === "objective"
                        ? [
                            "aim",
                            "mechanics",
                            "piece",
                            "competitive",
                            "decisions",
                            "vod",
                          ]
                        : ["kbm", "controller"]
                  ).map((x) => (
                    <option value={x} key={x}>
                      {labels[x]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              Duração inicial
              <select
                value={p.minutes}
                onChange={(e) =>
                  setP({ ...p, minutes: Number(e.target.value) })
                }
              >
                {[30, 45, 60].map((n) => (
                  <option value={n} key={n}>
                    {n} minutos
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fuso horário
              <select
                value={p.timezone}
                onChange={(e) => setP({ ...p, timezone: e.target.value })}
              >
                {Array.from(
                  new Set([
                    p.timezone,
                    "America/Sao_Paulo",
                    "America/Manaus",
                    "America/Rio_Branco",
                    "Europe/Lisbon",
                    "UTC",
                  ]),
                ).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={p.reminder_enabled}
              onChange={(e) =>
                setP({ ...p, reminder_enabled: e.target.checked })
              }
            />
            Exibir lembretes locais de eventos favoritos ao abrir a plataforma
          </label>
          <p className="muted small-text">
            Não há e-mails, notificações push ou alertas com o site fechado
            nesta versão.
          </p>
          <button className="button primary" disabled={s.busy}>
            Salvar preferências
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>Privacidade e dados</h2>
        <p>
          Exporte seus registros em JSON ou solicite a exclusão definitiva da
          conta e dos dados vinculados.
        </p>
        <div className="row wrap">
          <button
            className="button"
            disabled={s.busy}
            onClick={() =>
              s.run(async () => {
                const snapshot = await exportPlayerData(
                  s.data,
                  supabase,
                  s.demo,
                );
                download(
                  JSON.stringify(snapshot, null, 2),
                  "clutchfolio-meus-dados.json",
                  "application/json",
                );
              }, "Exportação preparada.")
            }
          >
            <Download size={16} />
            Exportar dados
          </button>
          <button className="button danger" onClick={() => setConfirm(true)}>
            {s.demo ? "Apagar dados da demonstração" : "Excluir conta e dados"}
          </button>
        </div>
      </section>
      {confirm && (
        <Modal title="Excluir conta e dados?" onClose={() => setConfirm(false)}>
          <p>Esta ação não pode ser desfeita. Digite EXCLUIR para confirmar.</p>
          <label>
            Confirmação
            <input
              value={deletion}
              onChange={(e) => setDeletion(e.target.value)}
            />
          </label>
          <button
            className="button danger"
            disabled={deletion !== "EXCLUIR" || s.busy}
            onClick={() =>
              s.run(async () => {
                if (s.demo) {
                  clearLocalProductData(localStorage, sessionStorage);
                  // A full navigation clears in-memory private state as well.
                  window.location.assign("/");
                  return;
                } else {
                  const { error } = await supabase!.functions.invoke(
                    "delete-account",
                    { body: { confirmation: "EXCLUIR" } },
                  );
                  if (error)
                    throw new Error(
                      "kyrven: a exclusão não foi concluída. Entre novamente e tente outra vez. Se persistir, contate o responsável pela plataforma.",
                    );
                  clearLocalProductData(localStorage, sessionStorage);
                  await supabase!.auth.signOut();
                }
                window.location.assign("/");
              })
            }
          >
            Excluir definitivamente
          </button>
        </Modal>
      )}
    </>
  );
}
export function Legal() {
  const { type } = useParams();
  return (
    <article className="reading-page article-body">
      <Heading
        title={
          type === "privacy"
            ? "Privacidade nesta versão"
            : "Condições de uso nesta versão"
        }
        description="Documento preliminar do MVP. Revisão e identificação do operador são necessárias antes de abrir o cadastro ao público."
      />
      {type === "privacy" ? (
        <>
          <h2>Dados tratados</h2>
          <p>
            A conta utiliza e-mail e credenciais gerenciadas pelo Supabase Auth.
            Armazenamos nome de exibição, preferências de treino, rotinas,
            agenda, sessões, resultados, observações, favoritos e metas. Não
            solicitamos nome civil, localização precisa ou documentos.
          </p>
          <h2>Finalidade e controle</h2>
          <p>
            Os registros permitem organizar o treinamento e gerar relatórios
            pessoais. O perfil e os treinos são privados. Você pode exportar os
            dados e excluir a conta no perfil. A exclusão remove os registros
            vinculados do banco ativo; políticas de retenção de backups do
            provedor devem ser verificadas pelo operador.
          </p>
          <h2>kyrven coach e provedores externos</h2>
          <p>
            A personalização, o envio externo e o histórico de conversas são
            opcionais e ficam desligados por padrão. Quando você autoriza e há
            um provedor configurado, sua pergunta, observações resumidas e
            referências necessárias podem ser enviadas à OpenAI. A assistência
            por regras continua disponível sem esse envio. A API da OpenAI não
            utiliza os dados para treinamento por padrão; registros de prevenção
            de abuso podem ser retidos por até 30 dias. A retenção externa segue
            a política do provedor e não é apagada pela exclusão do histórico no
            kyrven.
          </p>
          <p>
            Você pode desativar novos envios, excluir o histórico nas
            preferências do Coach e excluir sua conta no perfil. Contadores
            operacionais são mínimos, privados e não registram perguntas em
            logs. O Coach pode errar, não identifica causas de oscilações de
            desempenho e não fornece diagnóstico médico.
          </p>
          <h2>Armazenamento local</h2>
          <p>
            A demonstração usa armazenamento neste navegador. A preferência de
            tema e os rascunhos das sessões também são locais. Contas
            configuradas utilizam Supabase para sessão e dados. Não há analytics
            publicitário implementado.
          </p>
          <h2>Adolescentes e operação pública</h2>
          <p>
            O responsável pelo serviço deverá documentar base legal, atendimento
            de direitos, transferências internacionais, proteção de adolescentes
            e participação de responsáveis quando aplicável. Até identificar o
            operador, o canal de privacidade e revisar essas condições, mantenha
            cadastros restritos a testes.
          </p>
        </>
      ) : (
        <>
          <h2>Finalidade</h2>
          <p>
            Ferramenta independente para organizar treinos e consultar conteúdo
            editorial. Não promete resultados competitivos, ganhos financeiros
            ou elegibilidade em torneios.
          </p>
          <h2>Informação competitiva</h2>
          <p>
            Datas e regras podem mudar. Os registros têm data de verificação e
            fonte original. Confirme informações na fonte oficial ou na aba
            Competir antes de participar.
          </p>
          <h2>Planos e conteúdo</h2>
          <p>
            A versão gratuita é funcional quando configurada. PRO e ELITE são
            conceitos em desenvolvimento, sem vendas, preços ou pagamentos
            ativos. Materiais educativos próprios não constituem diagnóstico
            médico.
          </p>
          <h2>Uso responsável</h2>
          <p>
            Não publique dados de terceiros, cheats, assédio ou conteúdos que
            violem direitos. Equilibre treinamento com descanso, estudos e
            outros compromissos. Consulte regras etárias do Fortnite e dos
            eventos, sem inferir elegibilidade a partir da conta neste site.
          </p>
          <h2>Identidade e propriedade intelectual</h2>
          <p>
            Não há afiliação com a Epic Games. kyrven é uma plataforma independente.
            A monetização de conteúdo relacionado à propriedade intelectual da
            Epic exige avaliação e permissões adequadas; o aviso de
            independência não concede licença comercial.
          </p>
        </>
      )}
      <Link className="button" to="/">
        Voltar à plataforma
        <ArrowRight size={16} />
      </Link>
    </article>
  );
}
