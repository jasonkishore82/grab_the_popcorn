// A film clapperboard: dark board with a striped clapper arm on top.
export default function Clapboard({ size = 28, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <rect x="3" y="12" width="26" height="16" rx="3" fill="currentColor" />
      <path d="M7 17h18M7 22h11" stroke="var(--bg, #fff)" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
      <g transform="rotate(-14 4 11)">
        <rect x="3" y="5" width="26" height="6.5" rx="1.8" fill="var(--accent-text, #0a84ff)" />
        <path d="M9 5l-3.2 6.5M15.5 5l-3.2 6.5M22 5l-3.2 6.5M28.5 5l-3.2 6.5" stroke="var(--bg, #fff)" strokeWidth="2.2" />
      </g>
    </svg>
  );
}
