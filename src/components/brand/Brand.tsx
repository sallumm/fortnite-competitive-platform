export function BrandSymbol({
  className = "brand-symbol",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 5h7v9L22 5h8L16 17l14 10h-9L11 20v7H4Z"
        fill="currentColor"
      />
    </svg>
  );
}
export function Brand({
  division,
}: {
  division?: "academy" | "esports" | "development";
}) {
  return (
    <span className="brand-lockup">
      <BrandSymbol />
      <span className="brand-wordmark">
        kyrven{division && <small>{division}</small>}
      </span>
    </span>
  );
}
