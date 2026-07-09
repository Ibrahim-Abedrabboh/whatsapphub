// Custom line-icon set for the marketing surface — a small, coherent family
// drawn on a 24px grid with a 1.6 stroke, inheriting currentColor so it picks
// up the ember accent. Replaces emoji glyphs (which render inconsistently
// across platforms). Server-safe: no client hooks, pure SVG.
import type { ReactElement, SVGProps } from "react";

export type IconKey = "menu" | "star" | "signal" | "log" | "shield" | "repeat";

const PATHS: Record<IconKey, ReactElement> = {
  // Send menu — a list of items
  menu: (
    <>
      <circle cx="5" cy="7" r="1" />
      <circle cx="5" cy="12" r="1" />
      <circle cx="5" cy="17" r="1" />
      <path d="M9 7h10M9 12h10M9 17h6" />
    </>
  ),
  // Request feedback — a star
  star: <path d="M12 4.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 16.98l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76z" />,
  // Delivery status — a broadcast signal
  signal: (
    <>
      <path d="M5.5 18.5a9 9 0 0 1 9-9" />
      <path d="M5.5 18.5a4.5 4.5 0 0 1 4.5-4.5" />
      <circle cx="5.6" cy="18.4" r="1.1" />
    </>
  ),
  // Message log — a receipt of records
  log: (
    <>
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
    </>
  ),
  // Consent — a shield with a check
  shield: (
    <>
      <path d="M12 4l6 2.1v4.4c0 3.9-2.6 6.9-6 8.1-3.4-1.2-6-4.2-6-8.1V6.1z" />
      <path d="M9.3 11.8l1.9 1.9 3.4-3.6" />
    </>
  ),
  // Recurring — two looping arrows
  repeat: (
    <>
      <path d="M5 10a6 6 0 0 1 10-3.7l2 1.9" />
      <path d="M19 14a6 6 0 0 1-10 3.7L7 15.8" />
      <path d="M17 4.2v4h-4" />
      <path d="M7 19.8v-4h4" />
    </>
  ),
};

export function Icon({ name, ...props }: { name: IconKey } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
