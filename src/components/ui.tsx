import { useEffect, useRef, useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Copy, Target, X } from "lucide-react";
import { useStore } from "../lib/store";
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  children,
  to,
  label,
}: {
  title: string;
  children?: ReactNode;
  to?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <Target size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
      {to && (
        <Link className="button primary" to={to}>
          {label || "Começar"}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Source({
  url,
  date,
  stale = false,
}: {
  url: string;
  date: string;
  stale?: boolean;
}) {
  return (
    <div className="source">
      <a href={url} target="_blank" rel="noopener noreferrer">
        Fonte original <ArrowUpRight size={13} />
      </a>
      <span>
        Verificado em {new Date(date).toLocaleDateString("pt-BR")}
        {stale ? " · Revisão necessária" : ""}
      </span>
    </div>
  );
}
export function CopyCode({ code }: { code: string }) {
  const { run } = useStore();
  return (
    <button
      className="button small"
      onClick={() =>
        run(async () => {
          await navigator.clipboard.writeText(code);
        })
      }
    >
      <Copy size={14} />
      {code}
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby={titleId}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Fechar janela"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Progress({
  value,
  max = 100,
}: {
  value: number;
  max?: number;
}) {
  return (
    <progress
      max={Number.isFinite(max) && max > 0 ? max : 1}
      value={
        Number.isFinite(value)
          ? Math.max(0, Math.min(value, max > 0 ? max : 1))
          : 0
      }
      aria-label={`${max > 0 && Number.isFinite(value) ? Math.round(Math.max(0, Math.min(value / max, 1)) * 100) : 0}% concluído`}
    />
  );
}
export function CheckLine({ children }: { children: ReactNode }) {
  return (
    <div className="check-line">
      <Check size={15} />
      {children}
    </div>
  );
}
