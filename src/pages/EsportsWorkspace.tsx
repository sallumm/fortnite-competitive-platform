import { Link } from "react-router-dom";
import { Heading, Badge, Empty } from "../components/ui";
import { Brand } from "../components/brand/Brand";
import { useEsports } from "../lib/esports/useEsports";
import { roleLabels, statusLabels } from "../lib/esports/domain";
export default function EsportsWorkspace() {
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
          {workspace.roles.some((r) => r.role === "development_scholar") && (
            <Link className="button primary" to="/app/esports/development">
              Meu desenvolvimento
            </Link>
          )}
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
