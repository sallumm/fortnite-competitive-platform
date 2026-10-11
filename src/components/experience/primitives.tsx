import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import * as m from "motion/react-m";
import { AnimatePresence, animate, useMotionValue } from "motion/react";
import { Info } from "lucide-react";
import { useMotionLevel } from "./MotionSystem";
export function PageTransition({
  children,
  identity,
}: {
  children: ReactNode;
  identity: string;
}) {
  const { effective } = useMotionLevel();
  return (
    <m.div
      key={identity}
      className="page-transition"
      transition={{
        duration: effective === "full" ? 0.32 : 0,
        ease: [0.22, 1, 0.36, 1],
      }}
      initial={
        effective === "essential"
          ? false
          : { opacity: 0.85, y: effective === "full" ? 8 : 0 }
      }
      animate={{ opacity: 1, y: 0 }}
    >
      {children}
    </m.div>
  );
}
export function AnimatedCard({
  children,
  className = "",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const { effective } = useMotionLevel();
  return (
    <m.article
      {...rest}
      className={`panel interactive-card ${className}`}
      whileHover={effective === "full" ? { y: -3 } : undefined}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
    >
      {children}
    </m.article>
  );
}
export function AnimatedButton({
  children,
  className = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  // Native button semantics and CSS handle press feedback without a second animation engine.
  return (
    <button {...props} className={className}>
      {children}
    </button>
  );
}
export function SectionReveal({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const { effective } = useMotionLevel();
  return (
    <m.section
      id={id}
      className={className}
      initial={false}
      whileInView={
        effective === "full" && typeof IntersectionObserver !== "undefined"
          ? { y: [10, 0], opacity: [0.85, 1] }
          : undefined
      }
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.35 }}
    >
      {children}
    </m.section>
  );
}
export function AnimatedTabs<T extends string | number>({
  value,
  onChange,
  items,
  label,
  className = "",
}: {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  const id = useId();
  const { effective } = useMotionLevel();
  return (
    <div
      role="group"
      aria-label={label}
      className={`tabs animated-tabs ${className}`}
    >
      {items.map((item) => (
        <button
          type="button"
          key={item.value}
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
        >
          {value === item.value && (
            <m.span
              className="tab-indicator"
              layoutId={id}
              transition={{
                type: "spring",
                stiffness: effective === "full" ? 450 : 2000,
                damping: 38,
              }}
            />
          )}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
export function ProgressIndicator({
  value,
  max = 100,
}: {
  value: number;
  max?: number;
}) {
  const { effective } = useMotionLevel();
  const ratio =
    Number.isFinite(value) && max > 0
      ? Math.max(0, Math.min(value / max, 1))
      : 0;
  return (
    <div className="progress-indicator">
      <progress
        className="sr-only"
        value={ratio}
        max={1}
        aria-label={`${Math.round(ratio * 100)}% concluído`}
      />
      <m.span
        aria-hidden="true"
        initial={false}
        animate={{ scaleX: ratio }}
        transition={
          effective === "full"
            ? { type: "spring", stiffness: 120, damping: 24 }
            : { duration: effective === "essential" ? 0 : 0.1 }
        }
      />
    </div>
  );
}
export function StatCounter({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const { effective } = useMotionLevel();
  const number = useMotionValue(value);
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current === value) {
      number.set(value);
      if (ref.current)
        ref.current.textContent = value.toLocaleString("pt-BR") + suffix;
      return;
    }
    const from = previous.current;
    previous.current = value;
    if (effective !== "full") {
      number.set(value);
      return;
    }
    number.set(from);
    const subscription = number.on("change", (current) => {
      if (ref.current)
        ref.current.textContent =
          Math.round(current).toLocaleString("pt-BR") + suffix;
    });
    const controls = animate(number, value, { duration: 0.4, ease: "easeOut" });
    return () => {
      controls.stop();
      subscription();
    };
  }, [value, effective, number, suffix]);
  return (
    <strong className="stat-counter">
      <span aria-hidden="true" ref={ref}>
        {value.toLocaleString("pt-BR")}
        {suffix}
      </span>
      <span className="sr-only">
        {value}
        {suffix}
      </span>
    </strong>
  );
}
export function NotificationToast({ message }: { message: string }) {
  const { effective } = useMotionLevel();
  return (
    <AnimatePresence initial={false}>
      {message && (
        <m.div
          key={message}
          role="status"
          className="toast"
          initial={{ opacity: 0, y: effective === "full" ? 12 : 0 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          <span className="toast-check" aria-hidden="true">
            ✓
          </span>
          {message}
        </m.div>
      )}
    </AnimatePresence>
  );
}
export function LoadingSkeleton() {
  return (
    <div className="skeleton-page" role="status" aria-label="Carregando">
      <div />
      <div />
      <div />
      <p>Carregando esta página…</p>
    </div>
  );
}
export function InteractiveTooltip({ text }: { text: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="interactive-tooltip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="icon-button"
        aria-label="Mais informações"
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <Info size={16} />
      </button>
      {open && (
        <span id={id} role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}
export function TrainingStepTransition({
  children,
  identity,
}: {
  children: ReactNode;
  identity: string | number;
}) {
  const { effective } = useMotionLevel();
  return (
    <m.div
      key={identity}
      initial={
        effective === "essential"
          ? false
          : { opacity: 0.8, x: effective === "full" ? 10 : 0 }
      }
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
    >
      {children}
    </m.div>
  );
}
