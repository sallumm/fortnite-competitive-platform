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
        d="M5 4h7v11L23 4h8L18 17l13 11h-9L12 19v9H5V4Z"
        fill="currentColor"
      />
      <path d="M2 28h6" stroke="currentColor" strokeWidth="2" />
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
