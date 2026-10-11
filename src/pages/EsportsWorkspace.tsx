import { useState } from "react";
import { useStore } from "../lib/store";
import { esportsRPC } from "../lib/esports/service";
import { downloadEsports } from "../lib/esports/development";
import { Link } from "react-router-dom";
import { Heading, Badge, Empty } from "../components/ui";
import { Brand } from "../components/brand/Brand";
import { useEsports } from "../lib/esports/useEsports";
import { roleLabels, statusLabels } from "../lib/esports/domain";
export default function EsportsWorkspace() {
  const s = useStore();
  const [erase, setErase] = useState(false);
  const { workspace, loading, error, refresh } = useEsports();
  return (
    <>
      <Heading
        eyebrow="kyrven esports"
        title="Meu espaço esports"
        description="Candidaturas, acessos temporários e acompanhamento privado."
      />
      {loading ? (
        <p role="status">Verificando permissões no servidor…</p>
      ) : error ? (
        <p role="alert" className="alert">
          {error}
          <button onClick={() => void refresh()}>Tentar novamente</button>
        </p>
      ) : !workspace ? (
        <Empty title="Entre na sua conta real">
          Esports usa contas autenticadas. A demonstração de treinamento não
          recebe candidaturas ou cargos.
        </Empty>
      ) : (
        <>
          <div className="panel">
            <h2>Meus acessos</h2>
            {workspace.roles.length ? (
              workspace.roles.map((r) => (
                <p key={r.id}>
                  <Badge>{roleLabels[r.role]}</Badge> Até{" "}
                  {new Date(r.ends_at).toLocaleString("pt-BR")}
                </p>
              ))
            ) : (
              <p>Nenhum acesso de esports concedido.</p>
            )}
            <Link to="/be-kyrven" className="button">
              Acompanhar candidatura
            </Link>
            {(workspace.admin || workspace.staff) && (
              <Link to="/admin/esports" className="button">
                Administração esports
              </Link>
            )}
          </div>
          {workspace.roles.some((r) => r.role === "trialist") ? (
            <section className="panel">
              <Brand division="esports" />
              <h2>Área Trialist</h2>
              <p className="preserve-lines">{workspace.trial_intro}</p>
              <p>
                O convite permite realizar avaliações disponíveis. Nota,
                participação e conclusão não geram promoção automática.
              </p>
              <Link to="/app/esports/trials" className="button primary">
                Minhas avaliações
              </Link>
            </section>
          ) : (
            <p className="alert">
              A área de avaliações exige um convite Trialist ativo no servidor.
            </p>
          )}
          {workspace.applications.length > 0 && (
            <Link className="button primary" to="/app/esports/development">
              Meu desenvolvimento
            </Link>
          )}
          <section className="panel">
            <h2>Meus dados de esports</h2>
            <p>
              Exporte candidaturas, respostas e dados compartilháveis do
              programa. A exclusão de esports revoga acessos imediatamente e
              aguarda execução administrativa. Não exclui a conta ou treinos
              pessoais.
            </p>
            <button
              className="button"
              disabled={s.busy}
              onClick={() =>
                void s.run(async () =>
                  downloadEsports(
                    await esportsRPC("esports_export"),
                    "kyrven-esports.json",
                  ),
                )
              }
            >
              Exportar meus dados esports
            </button>
            <button className="button" onClick={() => setErase(true)}>
              Solicitar exclusão de esports
            </button>
            {erase && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void s.run(async () => {
                    await esportsRPC("esports_request_erasure");
                    setErase(false);
                    await refresh();
                  }, "Solicitação registrada e acessos revogados.");
                }}
              >
                <label className="checkbox">
                  <input type="checkbox" required />
                  Entendo que minha participação e os acessos de esports serão
                  retirados.
                </label>
                <button className="button danger" disabled={s.busy}>
                  Confirmar solicitação de exclusão
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => setErase(false)}
                >
                  Cancelar
                </button>
              </form>
            )}
          </section>
          <section className="panel">
            <h2>Etapas registradas</h2>
            {workspace.applications.map((a) => (
              <p key={a.id}>
                {a.payload.nickname} · {statusLabels[a.status]}
              </p>
            ))}
          </section>
        </>
      )}
    </>
  );
}
