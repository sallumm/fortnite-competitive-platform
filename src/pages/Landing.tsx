import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { BrandSymbol } from "../components/brand/Brand";
import { useStore } from "../lib/store";
import { ProductPreview } from "../components/experience/ProductPreview";
export default function Landing() {
  const { enterDemo, catalog } = useStore();
  const navigate = useNavigate();
  const demo = () => { enterDemo(); navigate("/onboarding"); };
  return <div className="reinvention-landing">
    <section className="folio-hero">
      <div>
        <div className="folio-intro">kyrven / performance em Fortnite</div>
        <h1>Aprender é o início.<br/><em>Evoluir é o plano.</em></h1>
        <p>Seu espaço para estudar, organizar o treino e entender os próprios registros. Uma prática com intenção, do primeiro exercício à preparação competitiva.</p>
        <div className="folio-actions"><button className="button primary" onClick={demo}>Explorar demonstração <ArrowUpRight size={18}/></button><Link className="button" to="/academy">Conhecer a academy <ArrowRight size={18}/></Link></div>
        <span className="folio-caption">Demonstração neste navegador · Construção e Zero Build</span>
      </div>
      <div className="practice-map" aria-label="Ciclo de prática kyrven">
        <header><span>UM CICLO, NÃO UM ATALHO</span><span>01 — 03</span></header>
        <BrandSymbol />
        <ol><li><span>01 / ENTENDER</span><Link to="/academy">Estude a decisão</Link></li><li><span>02 / APLICAR</span><Link to="/library">Pratique com foco</Link></li><li><span>03 / OBSERVAR</span><Link to="/app/reports">Revise o registro</Link></li></ol>
        <footer><span>be kyrven.</span><span>PRÁTICA + CONTEXTO</span></footer>
      </div>
    </section>
    <section className="folio-index">
      <div><h2>Menos dispersão.<br/>Mais direção.</h2><p>Estudo, treino e revisão pertencem à mesma rotina. Escolha por onde começar.</p></div>
      <div className="folio-index-list">
        {[
          ["01","Training Center","Combine exercícios em rotinas. Inicie, retome e registre cada sessão.","/app/training"],
          ["02","Skill Maxing","Revise uma proposta com suas prioridades e disponibilidade antes de confirmar a agenda.","/app/evolution-plan"],
          ["03","kyrven academy","Leia, estude e aplique. Seu percurso pode voltar às bases ou avançar por assunto.","/academy"],
          ["04","Contexto competitivo","Consulte o meta, regulamentos e fontes. A data de verificação acompanha a informação.","/competitive/meta"],
          ["05","Minha evolução","Compare registros equivalentes. Revise VODs e planeje o próximo foco.","/app/evolution"],
        ].map(([n,title,description,to])=><Link key={n} to={to}><span className="index-number">{n}</span><div><h3>{title}</h3><p>{description}</p></div><ArrowUpRight size={20}/></Link>)}
      </div>
    </section>
    <section className="folio-demo"><div><h2>Experimente antes<br/>de organizar.</h2><p>Altere os dias, a duração e os registros de exemplo. Esta prévia não salva sessões nem altera sua conta.</p><Link className="text-link" to="/app/planner">Abrir meu planejador <ArrowRight size={16}/></Link></div><ProductPreview onExplore={demo}/></section>
    <section className="folio-library">
      <header><h2>A prática começa aqui.</h2><Link className="text-link" to="/library">Biblioteca de exercícios <ArrowRight size={16}/></Link></header>
      <div className="folio-library-list">{catalog.exercises.slice(0,3).map(exercise=><article key={exercise.id}><small>{exercise.map_code ? `Ilha ${exercise.map_code}` : "Exercício sem mapa"}</small><h3>{exercise.title}</h3><p>{exercise.description}</p><Link to={`/library/${exercise.id}`}>Consultar instruções <ArrowUpRight size={15}/></Link><small>Verificado em {exercise.verified_at.slice(0,10)}</small></article>)}</div>
    </section>
    <section className="folio-community">
      <div><h2>O treino é seu.<br/>A troca é coletiva.</h2><p>Estudos, atualizações e conversas sobre prática responsável na comunidade kyrven.</p><a className="button" href="https://discord.gg/9WBqfSftrw" target="_blank" rel="noopener noreferrer">Abrir Discord <ArrowUpRight size={17}/></a></div>
      <div><span className="folio-caption">kyrven esports / em desenvolvimento</span><h2>be kyrven.</h2><p>Conheça a proposta da organização e as etapas de desenvolvimento. Trialist, bolsa e elenco têm critérios distintos e decisão humana, sem promessa de contratação.</p><Link className="text-link" to="/esports">Conhecer a organização <ArrowRight size={16}/></Link><br/><Link className="text-link" to="/be-kyrven">Entender o processo <ArrowRight size={16}/></Link></div>
    </section>
    <section className="folio-faq"><h2>Antes de começar.</h2>{[
      ["Preciso de cadastro para explorar?","Biblioteca, academy e central competitiva são públicas. A demonstração usa apenas este navegador. Contas dependem da configuração e disponibilidade do ambiente."],
      ["O que os relatórios medem?","Os relatórios usam os registros que você insere. Participação, estudo declarado e desempenho comparável são informações distintas. XP não equivale a rank ou classificação oficial de Fortnite."],
      ["Existe análise automática das minhas partidas?","Não há leitura automática das partidas. O kyrven coach usa regras; respostas generativas dependem de provedor configurado e consentimento."],
      ["Os eventos são atualizados em tempo real?","Não. Consulte a fonte e a data de verificação de cada registro. Confirme horários e regras na fonte oficial antes de competir."],
      ["Quais planos estão disponíveis?","O escopo gratuito reúne planejamento, exercícios e registros. Pro e Elite estão em desenvolvimento, sem vendas ou pagamentos nesta versão."],
      ["A kyrven é oficial do Fortnite?","Não. A kyrven é um projeto independente, sem afiliação ou endosso da Epic Games."],
    ].map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
    <section className="folio-end"><h2>Uma sessão.<br/>Um próximo passo.</h2><button className="button primary" onClick={demo}>Criar meu primeiro plano <ArrowUpRight size={18}/></button></section>
  </div>;
}
