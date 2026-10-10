import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { loadMeta } from "../lib/meta-service";
import { loadEditorial } from "../lib/meta-editorial-service";
import {
  cleanEntryContent,
  type MetaEdition,
  type MetaAsset,
} from "../lib/meta-editorial";
import {
  type MetaCatalog,
  metaStates,
  metaStatus,
  latestMeta,
  relatedMetaLinks,
} from "../lib/meta";
import { MetaContent } from "../components/MetaContent";
import { Badge, Empty, Heading } from "../components/ui";
import { useSEO } from "../lib/seo";
export default function MetaDetail() {
  const { id, contextId, slug } = useParams(),
    s = useStore();
  const [c, setC] = useState<MetaCatalog | null>(null),
    [ed, setEd] = useState<MetaEdition[]>([]),
    [assets, setAssets] = useState<MetaAsset[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      loadMeta(s.demo),
      s.demo ? Promise.resolve({ editions: [], assets: [] }) : loadEditorial(),
    ])
      .then(([c, e]) => {
        if (active) {
          setC(c);
          setEd(e.editions);
          setAssets(e.assets);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Não foi possível consultar este conteúdo. Recarregue a página.",
          );
      });
    return () => {
      active = false;
    };
  }, [s.demo, id, contextId, slug]);
  const e = id
      ? c?.entries.find((x) => x.id === id)
      : c?.entries
          .filter(
            (x) =>
              x.context_id === contextId &&
              ed.some(
                (edition) =>
                  edition.entry_id === x.id && edition.content.slug === slug,
              ),
          )
          .sort((a, b) => b.revision - a.revision)[0],
    ctx = c?.contexts.find((x) => x.id === e?.context_id),
    v = c?.versions.find((x) => x.id === ctx?.version_id),
    latest =
      e && c
        ? latestMeta(c.entries).find(
            (x) =>
              x.subject_key === e.subject_key && x.context_id === e.context_id,
          )
        : null;
  useSEO(
    e?.title || "Meta",
    "Conhecimento contextualizado com fontes e histórico.",
  );
  if (error) return <Empty title="Conteúdo indisponível">{error}</Empty>;
  if (!c) return <p role="status">Carregando conteúdo…</p>;
  if (!e || latest?.state === "archived")
    return (
      <Empty title="Conteúdo não publicado ou retirado">
        <Link to="/competitive/meta">Voltar ao Meta</Link>
      </Empty>
    );
  const edition = ed.find((x) => x.entry_id === e.id),
    content = edition?.content || {
      ...cleanEntryContent(e),
      links: relatedMetaLinks(c, e).map(
        ({ target_kind, target_id, reason }) => ({
          target_kind,
          target_id,
          reason,
        }),
      ),
    };
  return (
    <>
      <Heading
        eyebrow="META CENTER"
        title={e.title}
        description={`${v?.season} · Patch ${v?.patch} · ${c.modes.find((x) => x.id === ctx?.mode_id)?.title} · ${c.formats.find((x) => x.id === ctx?.format_id)?.title} · ${ctx?.region === "unspecified" ? "Região não especificada" : ctx?.region}`}
        action={
          <Link className="button" to="/competitive/meta">
            Voltar ao Meta
          </Link>
        }
      />
      <Badge>
        {metaStates[metaStatus(e, ctx!.version_id, ctx!.version_id)]}
      </Badge>
      {latest?.id !== e.id && (
        <p className="notice">
          Revisão histórica.{" "}
          <Link to={"/competitive/meta/" + latest?.id}>
            Consultar edição mais recente
          </Link>
        </p>
      )}
      <MetaContent content={content} catalog={c} assets={assets} />
      <section className="panel">
        <h2>Histórico contextual</h2>
        <ul>
          {c.entries
            .filter(
              (x) =>
                x.context_id === e.context_id &&
                x.subject_key === e.subject_key,
            )
            .sort((a, b) => b.revision - a.revision)
            .map((x) => (
              <li key={x.id}>
                <Link to={"/competitive/meta/" + x.id}>
                  Revisão {x.revision} · {x.title}
                </Link>
                <p>{x.change_note}</p>
              </li>
            ))}
        </ul>
      </section>
    </>
  );
}
