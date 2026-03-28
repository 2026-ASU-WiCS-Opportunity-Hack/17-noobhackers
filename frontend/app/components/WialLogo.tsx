/**
 * WIAL Logo — SVG recreation of the ascending bars logo.
 * Gold/olive bars ascending left to right, red bars on right.
 */

interface WialLogoProps {
  className?: string;
  height?: number;
}

export default function WialLogo({ className = "", height = 40 }: WialLogoProps) {
  const w = height * 2.8;
  return (
    <svg
      viewBox="0 0 280 100"
      width={w}
      height={height}
      className={className}
      aria-label="WIAL — World Institute for Action Learning"
      role="img"
    >
      {/* Ascending gold/olive bars (left side) */}
      <rect x="10" y="70" width="12" height="25" fill="#B8A030" rx="1" />
      <rect x="26" y="55" width="12" height="40" fill="#B8A030" rx="1" />
      <rect x="42" y="40" width="12" height="55" fill="#B8A030" rx="1" />
      <rect x="58" y="28" width="12" height="67" fill="#C8A830" rx="1" />

      {/* Transition bar */}
      <rect x="74" y="18" width="14" height="77" fill="#CC0033" rx="1" opacity="0.6" />

      {/* Red bars (right side — taller) */}
      <rect x="92" y="8" width="16" height="87" fill="#CC0033" rx="1" />
      <rect x="112" y="5" width="18" height="90" fill="#CC0033" rx="1" />

      {/* Text */}
      <text x="140" y="32" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="600" fill="#333">
        WORLD
      </text>
      <text x="140" y="48" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="600" fill="#333">
        INSTITUTE FOR
      </text>
      <text x="140" y="68" fontFamily="system-ui, sans-serif" fontSize="18" fontWeight="800" fill="#CC0033">
        ACTION
      </text>
      <text x="140" y="88" fontFamily="system-ui, sans-serif" fontSize="18" fontWeight="800" fill="#CC0033">
        LEARNING
      </text>
    </svg>
  );
}
