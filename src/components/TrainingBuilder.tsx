import { useState } from "react";
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
import { Modal } from "./ui";
import { useStore } from "../lib/store";
import type { Plan, Step, Exercise } from "../lib/types";
function BuilderStep({
  step,
  exercise,
  index,
  count,
  change,
  move,
  remove,
}: {
  step: Step;
  exercise?: Exercise;
  index: number;
  count: number;
  change: (minutes: number) => void;
  move: (direction: number) => void;
  remove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.exercise_id });
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
}: {
  plan: Plan;
  onClose: () => void;
}) {
  const s = useStore();
  const [draft, setDraft] = useState(() => structuredClone(plan));
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
          s.run(async () => {
            await s.save("plans", draft);
            onClose();
          }, "Rotina salva.");
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
        <label>
          Adicionar exercício
          <select
            value=""
            disabled={draft.steps.length >= 20}
            onChange={(e) => {
              if (e.target.value)
                update({
                  ...draft,
                  steps: [
                    ...draft.steps,
                    { exercise_id: e.target.value, minutes: 10 },
                  ],
                });
            }}
          >
            <option value="">Escolha um exercício…</option>
            {s.catalog.exercises
              .filter(
                (e) =>
                  (e.mode === "both" || e.mode === s.data.profile?.mode) &&
                  !draft.steps.some((st) => st.exercise_id === e.id),
              )
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
          </select>
        </label>
        <p className="muted small-text">
          Arraste pela alça ou use os botões de ordem. Pelo teclado: Espaço
          inicia, setas movem, Espaço confirma e Escape cancela. Alterações são
          locais até salvar.
        </p>
        {preview ? (
          <ol className="builder-preview">
            {draft.steps.map((step) => (
              <li key={step.exercise_id}>
                <strong>
                  {
                    s.catalog.exercises.find((e) => e.id === step.exercise_id)
                      ?.title
                  }
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
                  `Reorganizando ${s.catalog.exercises.find((e) => e.id === active.id)?.title || "exercício"}.`,
                onDragOver: ({ over }) =>
                  over
                    ? `Destino: ${s.catalog.exercises.find((e) => e.id === over.id)?.title || "exercício"}.`
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
                  draft.steps.findIndex((x) => x.exercise_id === active.id),
                  draft.steps.findIndex((x) => x.exercise_id === over.id),
                );
            }}
          >
            <SortableContext
              items={draft.steps.map((x) => x.exercise_id)}
              strategy={verticalListSortingStrategy}
            >
              {draft.steps.map((step, i) => (
                <BuilderStep
                  key={step.exercise_id}
                  step={step}
                  exercise={s.catalog.exercises.find(
                    (e) => e.id === step.exercise_id,
                  )}
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
        {total > 240 && (
          <p role="alert" className="alert">
            A rotina pode ter no máximo 240 minutos.
          </p>
        )}
        <button
          className="button primary full"
          disabled={s.busy || !draft.steps.length || total > 240}
        >
          Salvar rotina
        </button>
      </form>
    </Modal>
  );
}
