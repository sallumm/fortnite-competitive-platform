import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Trash2,
  Undo2,
  Eye,
} from "lucide-react";
import { Badge, Modal } from "./ui";
import { useStore } from "../lib/store";
import {
  identifySteps,
  stepExercise,
  trainingCategories,
  validatePlan,
  readPlanDraft,
} from "../lib/training";
import type { Plan, Step, Exercise } from "../lib/types";
function BuilderStep({
  step,
  exercise,
  index,
  count,
  change,
  move,
  remove,
  edit,
  duplicate,
}: {
  step: Step;
  exercise?: Exercise;
  index: number;
  count: number;
  change: (minutes: number) => void;
  move: (direction: number) => void;
  remove: () => void;
  edit: (patch: Partial<Step>) => void;
  duplicate: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id! });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 2 : undefined,
      }}
      className={`builder-step ${isDragging ? "dragging" : ""}`}
    >
      <div className="row">
        <button
          type="button"
          className="icon-button drag-handle"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Arrastar ${exercise?.title || "exercício"}`}
        >
          <GripVertical size={18} />
        </button>
        <strong>
          {index + 1}. {exercise?.title || "Exercício indisponível"}
        </strong>
      </div>
      <div className="row wrap">
        <label>
          Minutos
          <input
            type="number"
            min={1}
            max={120}
            required
            value={step.minutes}
            onChange={(e) => change(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          className="icon-button"
          aria-label="Mover para cima"
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          <ArrowUp size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Mover para baixo"
          disabled={index === count - 1}
          onClick={() => move(1)}
        >
          <ArrowDown size={16} />
        </button>
        <button
          type="button"
          className="icon-button danger"
          aria-label="Remover exercício"
          onClick={remove}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="form-grid">
        <label>
          Bloco
          <input
            maxLength={80}
            value={step.block || ""}
            onChange={(e) => edit({ block: e.target.value })}
            placeholder="Aquecimento, prática, revisão…"
          />
        </label>
        <label>
          Repetições (opcional)
          <input
            type="number"
            min={1}
            max={1000}
            value={step.repetitions ?? ""}
            onChange={(e) =>
              edit({
                repetitions: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
          />
        </label>
        <label>
          Link de apoio (opcional)
          <input
            type="url"
            maxLength={2048}
            value={step.resource_url || ""}
            onChange={(e) => edit({ resource_url: e.target.value })}
            placeholder="HTTPS · Epic, Fortnite ou YouTube"
          />
        </label>
        <label>
          Notas da etapa
          <textarea
            maxLength={1000}
            value={step.notes || ""}
            onChange={(e) => edit({ notes: e.target.value })}
          />
        </label>
      </div>
      <button type="button" className="button small" onClick={duplicate}>
        Duplicar etapa
      </button>
      {step.custom && (
        <div className="form-grid">
          <label>
            Nome da atividade privada
            <input
              maxLength={160}
              value={step.custom.title}
              onChange={(e) =>
                edit({ custom: { ...step.custom!, title: e.target.value } })
              }
            />
          </label>
          <label>
            Instruções da atividade privada
            <textarea
              minLength={20}
              maxLength={10000}
              value={step.custom.instructions}
              onChange={(e) =>
                edit({
                  custom: { ...step.custom!, instructions: e.target.value },
                })
              }
            />
          </label>
        </div>
      )}
      <details>
        <summary>Instruções e avaliação</summary>
        <p>{exercise?.instructions}</p>
        <p className="muted">
          {exercise?.metric}
          {exercise?.map_code ? ` · Ilha ${exercise.map_code}` : ""}
        </p>
      </details>
    </div>
  );
}
export function TrainingBuilder({
  plan,
  onClose,
  onCommit,
}: {
  plan: Plan;
  onCommit?: (plan: Plan) => Promise<void>;
  onClose: () => void;
}) {
  const s = useStore();
  const existing = s.data.plans.some((p) => p.id === plan.id);
  const key =
    "clutchfolio-plan-draft:" +
    plan.user_id +
    ":" +
    (onCommit || existing ? plan.id : "new");
  const saved = useRef(false);
  const [draft, setDraft] = useState(() => ({
    ...structuredClone(plan),
    steps: identifySteps(plan.steps),
  }));
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [custom, setCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [recovery, setRecovery] = useState<Plan | null>(() => {
    try {
      const d = JSON.parse(localStorage.getItem(key) || "null");
      return readPlanDraft(d, plan.user_id, existing ? plan.id : undefined);
    } catch {
      return null;
    }
  });
  const [draftError, setDraftError] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(draft));
        setDraftError(false);
      } catch {
        setDraftError(true);
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      if (!saved.current) {
        try {
          localStorage.setItem(key, JSON.stringify(draft));
        } catch {
          /* Keep the editor usable without local storage. */
        }
      }
    };
  }, [draft, key]);
  const errors = validatePlan(draft, s.catalog.exercises);
  const privateExercises = [
    ...new Map(
      [...s.data.plans.flatMap((p) => p.steps), ...draft.steps]
        .filter((st) => st.custom)
        .map((st) => [st.custom!.id, st.custom!]),
    ).values(),
  ];
  const availableExercises = [...s.catalog.exercises, ...privateExercises];
  const exercises = availableExercises.filter(
    (e) =>
      (draft.mode === "both" ||
        !draft.mode ||
        e.mode === "both" ||
        e.mode === draft.mode) &&
      (!category ||
        (e.categories?.length ? e.categories : [e.category]).includes(
          category,
        )) &&
      (
        e.title +
        " " +
        (e.skills || []).join(" ") +
        " " +
        (e.tags || []).join(" ")
      )
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const [history, setHistory] = useState<Plan[]>([]);
  const [preview, setPreview] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      scrollBehavior: "auto",
    }),
  );
  const update = (next: Plan) => {
    setHistory((h) => [...h.slice(-29), structuredClone(draft)]);
    setDraft(next);
  };
  const reorder = (from: number, to: number) => {
    if (from !== to && to >= 0 && to < draft.steps.length)
      update({ ...draft, steps: arrayMove(draft.steps, from, to) });
  };
  const total = draft.steps.reduce((n, step) => n + step.minutes, 0);
  return (
    <Modal title="Editar rotina" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          s.run(
            async () => {
              if (errors.length)
                throw new Error("Clutchfolio: " + errors.join(" "));
              if (onCommit) await onCommit(draft);
              else await s.save("plans", draft);
              saved.current = true;
              localStorage.removeItem(key);
              onClose();
            },
            onCommit
              ? "Prévia atualizada; agenda ainda não alterada."
              : "Rotina salva.",
          );
        }}
      >
        <label>
          Nome
          <input
            autoFocus
            required
            maxLength={80}
            value={draft.title}
            onChange={(e) => update({ ...draft, title: e.target.value })}
          />
        </label>
        {recovery && (
          <div className="alert">
            <p>Há um rascunho local desta rotina.</p>
            <button
              type="button"
              className="button"
              onClick={() => {
                setDraft({ ...recovery, steps: identifySteps(recovery.steps) });
                setRecovery(null);
              }}
            >
              Recuperar rascunho
            </button>
            <button
              type="button"
              className="button"
              onClick={() => setRecovery(null)}
            >
              Descartar rascunho
            </button>
          </div>
        )}
        <div className="form-grid">
          <label>
            Descrição
            <textarea
              maxLength={1000}
              value={draft.description || ""}
              onChange={(e) =>
                update({ ...draft, description: e.target.value })
              }
            />
          </label>
          <label>
            Objetivo
            <textarea
              maxLength={500}
              value={draft.objective || ""}
              onChange={(e) => update({ ...draft, objective: e.target.value })}
            />
          </label>
          <label>
            Modalidade
            <select
              value={draft.mode || "both"}
              onChange={(e) =>
                update({ ...draft, mode: e.target.value as Plan["mode"] })
              }
            >
              <option value="both">Todas</option>
              <option value="build">Construção</option>
              <option value="zero">Construção Zero</option>
            </select>
          </label>
          <label>
            Nível recomendado
            <select
              value={draft.level || "intermediate"}
              onChange={(e) =>
                update({ ...draft, level: e.target.value as Plan["level"] })
              }
            >
              <option value="beginner">Iniciante</option>
              <option value="intermediate">Intermediário</option>
              <option value="advanced">Avançado</option>
            </select>
          </label>
        </div>
        <div className="builder-summary">
          <div>
            <span className="eyebrow">SEU PLANO</span>
            <h3>
              {total} minutos <small>· {draft.steps.length} etapas</small>
            </h3>
          </div>
          <div className="row">
            <button
              type="button"
              className="button small"
              disabled={!history.length}
              onClick={() => {
                setDraft(history.at(-1)!);
                setHistory((h) => h.slice(0, -1));
              }}
            >
              <Undo2 size={16} />
              Desfazer
            </button>
            <button
              type="button"
              className="button small"
              aria-pressed={preview}
              onClick={() => setPreview(!preview)}
            >
              <Eye size={16} />
              Pré-visualizar
            </button>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Buscar exercícios
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, habilidade ou termo competitivo"
            />
          </label>
          <label>
            Categoria
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Todas as categorias</option>
              {Object.entries(trainingCategories).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Adicionar exercício
          <select
            value=""
            disabled={draft.steps.length >= 50}
            onChange={(e) => {
              if (e.target.value)
                update({
                  ...draft,
                  steps: [
                    ...draft.steps,
                    {
                      id: crypto.randomUUID(),
                      exercise_id: e.target.value,
                      ...(privateExercises.find(
                        (ex) => ex.id === e.target.value,
                      )
                        ? {
                            custom: structuredClone(
                              privateExercises.find(
                                (ex) => ex.id === e.target.value,
                              )!,
                            ),
                          }
                        : {}),
                      minutes: 10,
                    },
                  ],
                });
            }}
          >
            <option value="">Escolha um exercício…</option>
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
        <details className="builder-library">
          <summary>Explorar biblioteca · {exercises.length} exercícios</summary>
          {exercises.map((e) => (
            <article className="panel" key={e.id}>
              <h3>{e.title}</h3>
              <p>{e.description}</p>
              <p>{e.instructions}</p>
              <p className="muted">
                {e.mode === "build"
                  ? "Construção"
                  : e.mode === "zero"
                    ? "Construção Zero"
                    : "Todas as modalidades"}{" "}
                · {e.creator} · {e.metric}
              </p>
              {e.measurement && <p>{e.measurement.procedure}</p>}
              {e.source_url ? (
                <a
                  href={e.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Fonte · {e.map_code || "Protocolo editorial"}
                </a>
              ) : (
                <Badge>Atividade privada · criada por você</Badge>
              )}
              {e.published && (
                <p className="small-text">
                  Verificado em{" "}
                  {new Date(e.verified_at).toLocaleDateString("pt-BR")}; não
                  testado dentro do jogo.
                </p>
              )}
              <button
                type="button"
                className="button small"
                disabled={draft.steps.length >= 50}
                onClick={() =>
                  update({
                    ...draft,
                    steps: [
                      ...draft.steps,
                      {
                        id: crypto.randomUUID(),
                        exercise_id: e.id,
                        ...(!e.published ? { custom: structuredClone(e) } : {}),
                        minutes: 10,
                      },
                    ],
                  })
                }
              >
                Adicionar {e.title}
              </button>
            </article>
          ))}
        </details>
        <button
          type="button"
          className="button"
          onClick={() => setCustom(!custom)}
        >
          Atividade personalizada
        </button>
        {custom && (
          <section className="panel">
            <label>
              Nome da atividade
              <input
                maxLength={160}
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
              />
            </label>
            <label>
              Instruções da atividade
              <textarea
                minLength={20}
                maxLength={10000}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
              />
            </label>
            <p className="muted">
              Atividade privada, sem mapa verificado. Você pode criar revisão,
              pausa ou prática própria.
            </p>
            <button
              type="button"
              className="button"
              disabled={
                !customTitle.trim() ||
                customInstructions.length < 20 ||
                draft.steps.length >= 50
              }
              onClick={() => {
                const id = crypto.randomUUID();
                const exercise: Exercise = {
                  id,
                  title: customTitle,
                  description: customInstructions.slice(0, 500),
                  instructions: customInstructions,
                  mode: draft.mode || "both",
                  category: "decisions",
                  level: draft.level || "intermediate",
                  creator: "Atividade personalizada",
                  map_code: null,
                  source_url: "",
                  verified_at: "",
                  metric: "Resultado observado",
                  published: false,
                };
                update({
                  ...draft,
                  steps: [
                    ...draft.steps,
                    {
                      id: crypto.randomUUID(),
                      exercise_id: id,
                      minutes: 5,
                      custom: exercise,
                    },
                  ],
                });
                setCustom(false);
                setCustomTitle("");
                setCustomInstructions("");
              }}
            >
              Adicionar atividade
            </button>
          </section>
        )}
        <p role="status" className="muted small-text">
          {draftError
            ? "Não foi possível salvar o rascunho neste navegador. Salve a rotina antes de sair."
            : "Rascunho automático neste navegador, separado por conta. A rotina é persistida ao salvar."}
        </p>
        <p className="muted small-text">
          Arraste pela alça ou use os botões de ordem. Pelo teclado: Espaço
          inicia, setas movem, Espaço confirma e Escape cancela. Alterações são
          locais até salvar.
        </p>
        {preview ? (
          <ol className="builder-preview">
            {draft.steps.map((step) => (
              <li key={step.id}>
                <strong>
                  {stepExercise(step, s.catalog.exercises)?.title}
                </strong>
                <span>{step.minutes} min</span>
              </li>
            ))}
          </ol>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={{
              announcements: {
                onDragStart: ({ active }) =>
                  `Reorganizando ${
                    stepExercise(
                      draft.steps.find((st) => st.id === active.id)!,
                      s.catalog.exercises,
                    )?.title || "exercício"
                  }.`,
                onDragOver: ({ over }) =>
                  over
                    ? `Destino: ${
                        stepExercise(
                          draft.steps.find((st) => st.id === over.id)!,
                          s.catalog.exercises,
                        )?.title || "exercício"
                      }.`
                    : "Fora da lista.",
                onDragEnd: () =>
                  "Ordem atualizada localmente. Salve para confirmar.",
                onDragCancel: () => "Reorganização cancelada.",
              },
              screenReaderInstructions: {
                draggable:
                  "Pressione Espaço para iniciar, setas para mover, Espaço para confirmar e Escape para cancelar.",
              },
            }}
            onDragEnd={({ active, over }) => {
              if (over)
                reorder(
                  draft.steps.findIndex((x) => x.id === active.id),
                  draft.steps.findIndex((x) => x.id === over.id),
                );
            }}
          >
            <SortableContext
              items={draft.steps.map((x) => x.id!)}
              strategy={verticalListSortingStrategy}
            >
              {draft.steps.map((step, i) => (
                <BuilderStep
                  key={step.id}
                  step={step}
                  exercise={stepExercise(step, s.catalog.exercises)}
                  edit={(patch) =>
                    update({
                      ...draft,
                      steps: draft.steps.map((st, n) =>
                        n === i ? { ...st, ...patch } : st,
                      ),
                    })
                  }
                  duplicate={() =>
                    update({
                      ...draft,
                      steps: [
                        ...draft.steps.slice(0, i + 1),
                        { ...structuredClone(step), id: crypto.randomUUID() },
                        ...draft.steps.slice(i + 1),
                      ],
                    })
                  }
                  index={i}
                  count={draft.steps.length}
                  change={(minutes) =>
                    update({
                      ...draft,
                      steps: draft.steps.map((st, n) =>
                        n === i ? { ...st, minutes } : st,
                      ),
                    })
                  }
                  move={(d) => reorder(i, i + d)}
                  remove={() =>
                    update({
                      ...draft,
                      steps: draft.steps.filter((_, n) => n !== i),
                    })
                  }
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
        {errors.length > 0 && (
          <p role="alert" className="alert">
            {errors.join(" ")}
          </p>
        )}
        <button
          className="button primary full"
          disabled={s.busy || errors.length > 0}
        >
          Salvar rotina
        </button>
      </form>
    </Modal>
  );
}
