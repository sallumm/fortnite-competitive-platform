import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type {
  EditorialContent,
  MetaAsset,
  MetaVideo,
} from "../lib/meta-editorial";
import { youtubeId } from "../lib/meta-editorial";
import { imageUrl } from "../lib/meta-editorial-service";
import type { MetaCatalog } from "../lib/meta";
import { useStore } from "../lib/store";
export function MetaImage({ asset }: { asset: MetaAsset }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () =>
      imageUrl(asset)
        .then((u) => {
          if (active) {
            setUrl(u);
            setError(false);
          }
        })
        .catch(() => {
          if (active) setError(true);
        });
    void load();
    const timer = setInterval(load, 240000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [asset]);
  return (
    <figure className="meta-image">
      {url && !error ? (
        <img
          src={url}
          alt={asset.alt}
          loading="lazy"
          decoding="async"
          onError={() => setError(true)}
        />
      ) : (
        <p>{error ? "Imagem indisponível." : "Carregando imagem…"}</p>
      )}
      <figcaption>
        {asset.credit} ·{" "}
        <a href={asset.source_url} target="_blank" rel="noopener noreferrer">
          Fonte da imagem
        </a>
        <details>
          <summary>Direitos de uso registrados</summary>
          {asset.rights}
        </details>
      </figcaption>
    </figure>
  );
}
export function MetaVideoPlayer({ video }: { video: MetaVideo }) {
  const [consent, setConsent] = useState(false),
    [start, setStart] = useState(0);
  const id = youtubeId(video.url);
  return (
    <article className="panel meta-video">
      <h3>{video.title}</h3>
      <p>
        {video.creator} · {video.description}
      </p>
      {consent && video.embed_allowed && id ? (
        <>
          <iframe
            title={video.title}
            src={`https://www.youtube-nocookie.com/embed/${id}?start=${start}&rel=0`}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
          <button className="button" onClick={() => setConsent(false)}>
            Fechar vídeo e retirar consentimento
          </button>
        </>
      ) : (
        <>
          {video.embed_allowed && id && (
            <>
              <p className="small-text">
                Ao carregar, seu navegador se conectará ao YouTube. O modo de
                privacidade aprimorada não elimina toda coleta de dados.
              </p>
              <button className="button" onClick={() => setConsent(true)}>
                Permitir YouTube e carregar vídeo
              </button>
            </>
          )}
          <a
            className="button"
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir no provedor
          </a>
        </>
      )}
      {!!video.timestamps.length && (
        <ul>
          {video.timestamps.map((t, i) => (
            <li key={i}>
              <button className="button" onClick={() => setStart(t.seconds)}>
                {Math.floor(t.seconds / 60)}:
                {String(t.seconds % 60).padStart(2, "0")} · {t.label}
              </button>
              {!consent && (
                <span className="small-text">
                  {" "}
                  Requer carregar o vídeo para navegar.
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="small-text">
        Autorização registrada: {video.authorization}
      </p>
      <a href={video.source_url} target="_blank" rel="noopener noreferrer">
        Fonte do material
      </a>
    </article>
  );
}
export function MetaContent({
  content,
  catalog,
  assets = [],
}: {
  content: EditorialContent;
  catalog: MetaCatalog;
  assets?: MetaAsset[];
}) {
  const s = useStore();
  const [skillNames, setSkillNames] = useState<Record<string, string>>({});
  const needsSkills = content.links.some((l) => l.target_kind === "competency");
  useEffect(() => {
    let active = true;
    if (needsSkills)
      import("../lib/training-research")
        .then((m) => {
          if (active)
            setSkillNames(
              Object.fromEntries(
                m.knowledge.competencies.map((x) => [x.id, x.title]),
              ),
            );
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [needsSkills]);
  return (
    <div className="meta-rich">
      <p className="lead">{content.summary}</p>
      {content.body.trim() !== content.summary.trim() && (
        <p className="meta-text">{content.body}</p>
      )}
      <p className="small-text">
        {content.author} · Revisão:{" "}
        {new Date(content.verified_at).toLocaleString("pt-BR")} · Categoria:{" "}
        {content.category}
      </p>
      {content.objective && (
        <section>
          <h2>Objetivo</h2>
          <p>{content.objective}</p>
          <p>
            Nível:{" "}
            {
              {
                all: "Todos",
                beginner: "Iniciante",
                intermediate: "Intermediário",
                advanced: "Avançado",
              }[content.level]
            }
          </p>
        </section>
      )}
      {content.prerequisites && (
        <section>
          <h2>Pré-requisitos</h2>
          <p>{content.prerequisites}</p>
        </section>
      )}
      {!!content.characteristics.length && (
        <section>
          <h2>Características documentadas</h2>
          <dl className="meta-characteristics">
            {content.characteristics.map((x, i) => (
              <div key={i}>
                <dt>{x.name}</dt>
                <dd>{x.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {content.blocks.map((b, i) => (
        <section key={i}>
          <h2>{b.heading}</h2>
          <p className="meta-text">{b.text}</p>
        </section>
      ))}
      {content.media_ids.map((id) => {
        const a = assets.find((x) => x.id === id);
        return a ? (
          <MetaImage key={id} asset={a} />
        ) : (
          <p key={id}>Imagem associada não disponível.</p>
        );
      })}
      {content.videos.map((v, i) => (
        <MetaVideoPlayer key={i} video={v} />
      ))}
      <section>
        <h2>Fontes e limitações</h2>
        <p>{content.limitations}</p>
        <ul>
          {content.source_ids.map((id) => {
            const x = catalog.sources.find((x) => x.id === id);
            return (
              <li key={id}>
                {x ? (
                  <>
                    <a href={x.url} target="_blank" rel="noopener noreferrer">
                      {x.title}
                    </a>
                    <p>{x.limitations}</p>
                  </>
                ) : (
                  "Fonte indisponível"
                )}
              </li>
            );
          })}
        </ul>
      </section>
      {!!content.links.length && (
        <section>
          <h2>Treinos e conteúdos relacionados</h2>
          <ul>
            {content.links.map((l, i) => {
              const e = s.catalog.exercises.find((x) => x.id === l.target_id),
                a = s.catalog.articles.find((x) => x.id === l.target_id),
                t = s.catalog.tournaments.find((x) => x.id === l.target_id);
              const to =
                l.target_kind === "exercise" && e
                  ? "/library/" + e.id
                  : l.target_kind === "article" && a
                    ? "/academy/" + a.slug
                    : l.target_kind === "tournament" && t
                      ? "/competitive/" + t.slug
                      : l.target_kind === "competency"
                        ? "/academy/research"
                        : null;
              return (
                <li key={i}>
                  {to ? (
                    <Link to={to}>
                      {e?.title ||
                        a?.title ||
                        t?.title ||
                        skillNames[l.target_id] ||
                        l.target_id}
                    </Link>
                  ) : (
                    "Conteúdo indisponível"
                  )}
                  <p>{l.reason}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
