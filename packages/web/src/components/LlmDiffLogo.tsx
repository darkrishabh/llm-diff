/** App mark: side-by-side panels (compare / diff). Matches `src/app/icon.svg`. */

export function LlmDiffLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id="llm-diff-logo-gradient" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e40af" />
          <stop offset="1" stopColor="#172554" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#llm-diff-logo-gradient)" />
      <rect x="7" y="9" width="7" height="14" rx="2" fill="#ffffff" fillOpacity="0.95" />
      <rect x="18" y="9" width="7" height="14" rx="2" fill="#ffffff" fillOpacity="0.78" />
      <rect x="15" y="8" width="2" height="16" rx="1" fill="#ffffff" fillOpacity="0.35" />
    </svg>
  );
}
