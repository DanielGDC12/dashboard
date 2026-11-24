/**
 * Placeholder wordmark. Replace with the official SVG
 * "logo/mantiqueira-em-casa-branco" from Figma Assets (node 2868:3).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 52"
      role="img"
      aria-label="Mantiqueira em Casa"
      className={className}
      fill="currentColor"
    >
      <text
        x="110"
        y="26"
        textAnchor="middle"
        fontFamily="Assistant, sans-serif"
        fontWeight="800"
        fontSize="26"
        letterSpacing="1.5"
      >
        MANTIQUEIRA
      </text>
      <text
        x="110"
        y="47"
        textAnchor="middle"
        fontFamily="Assistant, sans-serif"
        fontWeight="600"
        fontSize="16"
        fontStyle="italic"
      >
        em casa
      </text>
    </svg>
  );
}
