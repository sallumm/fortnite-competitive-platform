import * as m from "motion/react-m";
import { ProgressIndicator } from "./experience/primitives";
import { useEffect, useRef, useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Copy, X } from "lucide-react";
import { useStore } from "../lib/store";
export function Heading({
  eyebrow,
  title,
  description,
  action,
  level = 1,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  level?: 1 | 2;
}) {
  return (
    <m.div
      className="page-heading"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 180, damping: 26 }}
    >
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        {level === 1 ? <h1>{title}</h1> : <h2>{title}</h2>}
        {description && <p>{description}</p>}
      </div>
      {action}
    </m.div>
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
      <span className="empty-mark" aria-hidden="true">—</span>
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
export function CopyCode({ code, label }: { code: string; label?: string }) {
  const { run } = useStore();
  return (
    <button
      type="button"
      className="button small"
      aria-label={label}
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
  variant = "modal",
}: {
  variant?: "modal" | "drawer";
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
      className={variant === "drawer" ? "animated-drawer" : "animated-modal"}
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby={titleId}
    >
      <m.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        className="modal-content"
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
      </m.div>
    </dialog>
  );
}
export const Progress = ProgressIndicator;
export function CheckLine({ children }: { children: ReactNode }) {
  return (
    <div className="check-line">
      <Check size={15} />
      {children}
    </div>
  );
}
