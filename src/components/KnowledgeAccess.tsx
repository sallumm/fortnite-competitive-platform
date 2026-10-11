import { Link } from "react-router-dom";
export function KnowledgeAccess({ question = "" }: { question?: string }) {
  return (
    <Link
      className="button ghost"
      to={"/knowledge" + (question ? "?q=" + encodeURIComponent(question) : "")}
    >
      Perguntar ao Fortnite Knowledge
    </Link>
  );
}
