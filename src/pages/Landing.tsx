import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Target,
  CalendarDays,
  Trophy,
  ChartNoAxesCombined,
  Play,
  ShieldCheck,
  Layers,
  MoveUpRight,
} from "lucide-react";
import { useStore } from "../lib/store";
import { CheckLine } from "../components/ui";
export default function Landing() {
  const { enterDemo } = useStore();
  const navigate = useNavigate();
  const demo = () => {
    enterDemo();
    navigate("/onboarding");
  };
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="pill">
            <span className="dot" />
            SEU COMPETITIVO, COM DIREÇÃO
          </div>
          <h1>
            Seu próximo nível
            <br />
            começa com um
            <br />
            <em>plano de jogo.</em>
          </h1>
          <p>
            Treine com propósito. Entenda o cenário. Acompanhe sua evolução. Um
            espaço para transformar vontade de melhorar em prática organizada.
          </p>
          <div className="hero-actions">
            <Link className="button primary" to="/auth">
              Construir meu plano <ArrowUpRight size={18} />
            </Link>
            <button className="button" onClick={demo}>
              <Play size={15} />
              Explorar demonstração
            </button>
          </div>
          <div className="hero-proof">
            <ShieldCheck size={16} />
            Comece gratuitamente
            <span />
            Construção e Zero Build
          </div>
        </div>
        <div
          className="hero-visual"
          aria-label="Prévia ilustrativa do planejador"
        >
          <div className="visual-grid" />
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="visual-coordinate">TRAIN WITH INTENT / 01</div>
          <div className="preview-dashboard">
            <div className="preview-top">
              <span className="brand-mark">C</span>
              <span>SEU PLANO DE JOGO</span>
              <span className="badge green">PRÉVIA</span>
            </div>
            <h3>
              Uma sessão.
              <br />
              Um objetivo claro.
            </h3>
            <div className="preview-objective">
              <Target size={20} />
              <div>
                Foco da sessão<strong>Precisão antes da velocidade</strong>
              </div>
              <MoveUpRight size={20} />
            </div>
            <div className="preview-plan">
              <div>
                <span>01</span>
                <div>
                  <strong>Tracking com intenção</strong>
                  <small>Mira · 10 minutos</small>
                </div>
                <div className="mini-line" />
              </div>
              <div>
                <span>02</span>
                <div>
                  <strong>Edits e resets</strong>
                  <small>Mecânicas · 10 minutos</small>
                </div>
              </div>
              <div>
                <span>03</span>
                <div>
                  <strong>Revisão de uma decisão</strong>
                  <small>Game sense · 10 minutos</small>
                </div>
              </div>
            </div>
            <button className="button primary full" onClick={demo}>
              Testar este fluxo
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="floating-note">
            <span className="green-text">PLANEJE. PRATIQUE. REVISE.</span>
            <p>
              Seu progresso merece
              <br />
              mais que horas de jogo.
            </p>
          </div>
        </div>
      </section>
      <div className="feature-strip">
        <span>
          <Target />
          Treinamento estruturado
        </span>
        <span>
          <Trophy />
          Contexto competitivo
        </span>
        <span>
          <CalendarDays />
          Agenda unificada
        </span>
        <span>
          <ChartNoAxesCombined />
          Registros que fazem sentido
        </span>
      </div>
      <section className="landing-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">MAIS CLAREZA. MAIS INTENÇÃO.</span>
            <h2>
              Uma plataforma.
              <br />
              Todo o seu desenvolvimento.
            </h2>
          </div>
          <p>
            Do primeiro treino à preparação para um campeonato: conecte o que
            você estuda com o que pratica.
          </p>
        </div>
        <div className="feature-grid">
          <article className="feature-large">
            <CalendarDays />
            <h3>Seu tempo, bem planejado.</h3>
            <p>
              Monte rotinas, organize a semana e execute sessões passo a passo.
              Ajuste o plano quando sua vida mudar.
            </p>
            <div className="week-preview">
              {["SEG", "TER", "QUA", "QUI", "SEX"].map((d, i) => (
                <div key={d}>
                  <small>{d}</small>
                  <span>{12 + i}</span>
                  {i % 2 === 0 ? (
                    <div className="calendar-block">
                      Treino
                      <br />
                      <strong>30 min</strong>
                    </div>
                  ) : (
                    <div className="rest-block">Descanso</div>
                  )}
                </div>
              ))}
            </div>
            <span className="muted small-text">
              Exemplo ilustrativo de uma semana planejada.
            </span>
            <button className="text-link" onClick={demo}>
              Experimentar o planejador <ArrowRight size={16} />
            </button>
          </article>
          <article>
            <Target />
            <h3>Pratique a habilidade certa.</h3>
            <p>
              Exercícios com instruções, métricas definidas e códigos de ilhas
              conferidos em fontes oficiais.
            </p>
            <Link to="/library" className="text-link">
              Explorar exercícios <ArrowRight size={16} />
            </Link>
          </article>
          <article>
            <Trophy />
            <h3>Entenda o competitivo.</h3>
            <p>
              Campeonatos, notícias e regulamentos com origem e data de
              verificação. Sem resultados inventados.
            </p>
            <Link to="/competitive" className="text-link">
              Abrir central competitiva <ArrowRight size={16} />
            </Link>
          </article>
        </div>
      </section>
      <section className="landing-section split-section">
        <div>
          <span className="eyebrow">PROGRESSO COM CONTEXTO</span>
          <h2>
            Saiba o que mudou.
            <br />
            Decida o que vem depois.
          </h2>
          <p>
            Seu dashboard começa vazio e cresce com seus próprios registros.
            Compare o mesmo exercício, identifique padrões e planeje a próxima
            sessão.
          </p>
          <CheckLine>Histórico de treinos e resultados individuais</CheckLine>
          <CheckLine>Relatórios por habilidade e período</CheckLine>
          <CheckLine>XP por conclusão, com limite diário</CheckLine>
          <CheckLine>
            Ranks internos de participação, sem penalizar descanso
          </CheckLine>
          <button className="button" onClick={demo}>
            Conhecer meu painel <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="progress-visual">
          <div className="row between">
            <span className="eyebrow">SUA EVOLUÇÃO</span>
            <Layers className="green-text" />
          </div>
          <h3>
            O próximo passo
            <br />é observável.
          </h3>
          <div className="rank-track">
            <div className="rank-shape">I</div>
            <div>
              <strong>Rookie</strong>
              <small>O começo da sua jornada</small>
            </div>
          </div>
          <div className="rank-label">
            <span>0 XP</span>
            <span>Contender · 500 XP</span>
          </div>
          <progress value={0} max={500} />
          <div className="progress-empty">
            <ChartNoAxesCombined />
            <p>
              Seu primeiro registro inicia
              <br />
              sua história de evolução.
            </p>
          </div>
          <span className="muted small-text">
            Prévia de uma conta nova. Sem estatísticas demonstrativas.
          </span>
        </div>
      </section>
      <section className="landing-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ACADEMY</span>
            <h2>Entenda antes de executar.</h2>
          </div>
          <Link className="button" to="/academy">
            Explorar conteúdos
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="three-grid">
          {[
            [
              "01",
              "Mecânicas com propósito",
              "Controle de peças, ângulos e exposição.",
            ],
            [
              "02",
              "Decisões em contexto",
              "VOD review, posicionamento e rotações.",
            ],
            [
              "03",
              "Uma rotina sustentável",
              "Pausas, sono e limites da evidência.",
            ],
          ].map(([n, t, d]) => (
            <Link className="academy-preview" to="/academy" key={n}>
              <span>{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
              <ArrowUpRight />
            </Link>
          ))}
        </div>
      </section>
      <section className="landing-section" id="plans">
        <div className="section-heading">
          <div>
            <span className="eyebrow">COMECE PELO ESSENCIAL</span>
            <h2>
              Uma base gratuita.
              <br />
              Espaço para crescer.
            </h2>
          </div>
        </div>
        <div className="three-grid plans">
          {[
            [
              "FREE",
              "Gratuito",
              "Treinos, calendário e sua evolução.",
              [
                "Conta e planejamento",
                "Biblioteca de exercícios",
                "Relatórios e progressão",
              ],
            ],
            [
              "PRO",
              "Em desenvolvimento",
              "Mais profundidade para seu treinamento.",
              [
                "Rotinas especializadas",
                "Conteúdo próprio avançado",
                "Relatórios adicionais",
              ],
            ],
            [
              "ELITE",
              "Em desenvolvimento",
              "Acompanhamento humano personalizado.",
              [
                "Análise humana de VODs",
                "Orientação individual",
                "Capacidade ainda em definição",
              ],
            ],
          ].map(([name, price, desc, items], i) => (
            <article
              key={String(name)}
              className={i === 0 ? "featured-plan" : ""}
            >
              <span className="eyebrow">{name as string}</span>
              <h3>{price as string}</h3>
              <p>{desc as string}</p>
              {(items as string[]).map((x) => (
                <CheckLine key={x}>{x}</CheckLine>
              ))}
              {i === 0 ? (
                <Link className="button primary full" to="/auth">
                  Começar grátis
                  <ArrowRight size={16} />
                </Link>
              ) : (
                <span className="badge">
                  Sem vendas ou pagamentos nesta versão
                </span>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="landing-section faq">
        <span className="eyebrow">PERGUNTAS FREQUENTES</span>
        <h2>Antes de começar.</h2>
        {[
          [
            "É uma plataforma oficial do Fortnite?",
            "Não. Este é um projeto independente, sem afiliação ou endosso da Epic Games.",
          ],
          [
            "Preciso de cadastro para explorar?",
            "Não. Biblioteca, Academy e central competitiva são públicas. A demonstração permite testar o planejamento neste navegador.",
          ],
          [
            "O rank mede minha habilidade?",
            "Não. Os ranks internos representam participação registrada. Não equivalem a ranks, PR ou classificação oficial do Fortnite.",
          ],
          [
            "Existe análise automática das minhas partidas?",
            "Ainda não. Os relatórios usam dados que você registra. A central de ajuda usa conteúdos estruturados e não se apresenta como IA.",
          ],
          [
            "O calendário é atualizado em tempo real?",
            "Não. Cada registro tem fonte e data de verificação. Mudanças precisam de revisão editorial; confirme horários no calendário oficial ou na aba Competir.",
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
      <section className="closing-cta">
        <span className="eyebrow">PRATIQUE COM DIREÇÃO</span>
        <h2>
          A próxima sessão
          <br />
          pode ter um objetivo.
        </h2>
        <button className="button primary" onClick={demo}>
          Criar meu primeiro plano
          <ArrowUpRight size={18} />
        </button>
      </section>
    </>
  );
}
