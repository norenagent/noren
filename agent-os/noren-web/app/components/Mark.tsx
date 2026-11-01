// The Noren mark: four stacked bars, each carrying one diagonal stroke of an N. 667 x 656.
const MARK_PATHS = [
  "M0 150 L69 150 L69 65 L146 150 L667 150 L667 0 L201 0 L201 95 L117 0 L0 0 Z",
  "M0 322 L201 322 L201 238 L276 322 L667 322 L667 176 L333 176 L333 264 L251 176 L0 176 Z",
  "M0 348 L0 490 L333 490 L333 408 L408 490 L667 490 L667 348 L463 348 L463 433 L384 348 Z",
  "M0 656 L463 656 L463 577 L536 656 L667 656 L667 516 L597 516 L597 603 L514 516 L0 516 Z"
];

export function NorenMark({ className, height = 28, color = "#1b492d" }: { className?: string; height?: number; color?: string }) {
  return (
    <svg
      viewBox="0 0 667 656"
      height={height}
      width={(height * 667) / 656}
      className={className}
      aria-hidden
      focusable="false"
      fill={color}
    >
      {MARK_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
