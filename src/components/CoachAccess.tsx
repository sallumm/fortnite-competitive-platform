import { Link } from "react-router-dom";
import { MessageSquare } from "lucide-react";
export function CoachAccess({
  question = "O que devo treinar hoje?",
  label = "Conversar com o Clutch Coach",
  exerciseId,
}: {
  question?: string;
  label?: string;
  exerciseId?: string;
}) {
  const params = new URLSearchParams({ q: question });
  if (exerciseId) params.set("exercise", exerciseId);
  return (
    <Link className="button coach-access" to={"/app/coach?" + params}>
      <MessageSquare size={16} />
      {label}
    </Link>
  );
}
