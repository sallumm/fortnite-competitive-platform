import type { Question } from "../lib/academy";
export function AcademyQuestionsEditor({
  questions,
  onChange,
}: {
  questions: Question[];
  onChange: (q: Question[]) => void;
}) {
  const update = (i: number, q: Question) =>
    onChange(questions.map((x, j) => (j === i ? q : x)));
  return (
    <section className="panel">
      <h3>Avaliação conceitual da aula</h3>
      <p>
        Inclua somente perguntas verificadas no texto e nas fontes da aula. Toda
        resposta exige explicação.
      </p>
      {questions.map((q, i) => (
        <fieldset key={q.id}>
          <legend>Pergunta {i + 1}</legend>
          <label>
            Pergunta
            <input
              value={q.prompt}
              maxLength={1000}
              onChange={(e) => update(i, { ...q, prompt: e.target.value })}
            />
          </label>
          {q.options.map((o, j) => (
            <label key={j}>
              Opção {j + 1}
              <input
                maxLength={500}
                value={o}
                onChange={(e) =>
                  update(i, {
                    ...q,
                    options: q.options.map((v, k) =>
                      k === j ? e.target.value : v,
                    ),
                  })
                }
              />
            </label>
          ))}
          <label>
            Resposta correta
            <select
              value={q.answer}
              onChange={(e) =>
                update(i, { ...q, answer: Number(e.target.value) })
              }
            >
              {q.options.map((_, j) => (
                <option key={j} value={j}>
                  Opção {j + 1}
                </option>
              ))}
            </select>
          </label>
          <label>
            Explicação
            <textarea
              maxLength={1000}
              value={q.explanation}
              onChange={(e) => update(i, { ...q, explanation: e.target.value })}
            />
          </label>
          <button
            type="button"
            onClick={() => onChange(questions.filter((_, j) => j !== i))}
          >
            Remover pergunta
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="button"
        disabled={questions.length >= 12}
        onClick={() =>
          onChange([
            ...questions,
            {
              id: `q-${crypto.randomUUID()}`,
              prompt: "",
              options: ["", "", ""],
              answer: 0,
              explanation: "",
            },
          ])
        }
      >
        Adicionar pergunta
      </button>
    </section>
  );
}
