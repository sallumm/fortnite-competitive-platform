import { Link } from "react-router-dom";
import { ArrowUpRight, Target, GraduationCap, ShieldCheck } from "lucide-react";
import { Brand } from "../components/brand/Brand";
import {
  SectionReveal,
  AnimatedCard,
} from "../components/experience/primitives";
import { Badge, Heading } from "../components/ui";
import { useSEO } from "../lib/seo";
import { useEsports } from "../lib/esports/useEsports";
export default function Esports() {
  const { portal, error } = useEsports();
  useSEO(
    "kyrven esports",
    "Uma organização em desenvolvimento, com seleção transparente e apoio à aprendizagem.",
  );
  return (
    <>
      <SectionReveal className="esports-hero">
        <Brand division="esports" />
        <Badge>Organização em desenvolvimento</Badge>
        <h1>
          Potencial encontra
          <br />
          <em>direção.</em>
        </h1>
        <p>{portal.settings.introduction}</p>
        <div className="row wrap">
          <Link className="button primary" to="/be-kyrven">
            be kyrven. <ArrowUpRight size={18} />
          </Link>
          <Link className="button" to="/academy">
            Conhecer a academy
          </Link>
        </div>
        <div className="esports-coordinate" aria-hidden="true">
          LEARN / PRACTICE / DEVELOP
        </div>
      </SectionReveal>
      {error && (
        <div role="alert" className="alert">
          {error}
        </div>
      )}
      <Heading
        level={2}
        eyebrow="NOSSA DIREÇÃO"
        title="Desenvolvimento com contexto"
        description="A proposta é avaliar aprendizagem, consistência, decisões e comunicação. Diferentes experiências podem ter espaço conforme os critérios de cada ciclo."
      />
      <div className="esports-divisions">
        {[
          [
            GraduationCap,
            "kyrven academy",
            "Estudo e treinamento para quem busca organizar sua evolução.",
          ],
          [
            Target,
            "kyrven development",
            "Bolsas temporárias, objetivos individuais e revisões humanas conforme disponibilidade.",
          ],
          [
            ShieldCheck,
            "kyrven esports",
            "Seleção expressa para elenco, com critérios e formalização próprios.",
          ],
        ].map(([Icon, title, text]) => {
          const I = Icon as typeof Target;
          return (
            <AnimatedCard key={String(title)} className="division-row">
              <I size={18} aria-hidden="true" />
              <h2>{String(title)}</h2>
              <p>{String(text)}</p>
            </AnimatedCard>
          );
        })}
      </div>
      <SectionReveal className="panel">
        <span className="eyebrow">ACADEMY ROSTER / ELENCO COMPETITIVO</span>
        <h2>Um elenco será anunciado quando existir.</h2>
        <p>
          Nenhum jogador, treinador, patrocinador ou conquista está sendo
          anunciado nesta etapa. Bolsa e Trialist não representam ingresso
          automático na organização.
        </p>
      </SectionReveal>
      <SectionReveal className="panel">
        <h2>Seleção e contato oficial</h2>
        <p>
          {portal.operational
            ? "Consulte os ciclos e critérios atuais em be kyrven."
            : "Recrutamento público fechado. Abertura depende de revisão e configuração."}
        </p>
        <p>{portal.settings.support_text}</p>
        {portal.settings.official_discord ? (
          <a
            className="button"
            href={portal.settings.official_discord}
            target="_blank"
            rel="noopener noreferrer"
          >
            Discord oficial <ArrowUpRight size={16} />
          </a>
        ) : (
          <p>Canal oficial de atendimento ainda não configurado.</p>
        )}
        <Link to="/be-kyrven" className="text-link">
          Regras e perguntas frequentes <ArrowUpRight size={16} />
        </Link>
      </SectionReveal>
    </>
  );
}
