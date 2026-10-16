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
        <span className="sr-only">kyrven</span>
        <svg className="brand-lettering" width="110" height="28" viewBox="0 0 215 52" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="square" strokeLinejoin="round" aria-hidden="true">
          {['M2 2v32m0-12 15-13M3 21l15 13','M3 10l9 22m12-22L10 46','M3 34V10m0 9q5-12 17-9','M2 10l10 24 11-24','M3 22h22q0-14-11-14Q2 8 2 22t23 6','M3 34V10m0 9q0-10 11-10t11 12v13'].map((d,i)=><path key={i} transform={`translate(${i*35+3} 3)`} d={d}/>)}
        </svg>
        {division && <small>{division}</small>}
      </span>
    </span>
  );
}
