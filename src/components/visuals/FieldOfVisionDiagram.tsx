/**
 * Field of Vision Diagram
 * 
 * SVG-based visualization showing progressive lens field of view zones.
 * Compares near/intermediate/far zones across tiers.
 */

interface ZoneConfig {
  near: number;      // 0-100 percentage width
  intermediate: number;
  far: number;
}

interface Props {
  /** Label for this lens */
  label: string;
  /** Zone widths (0-100) */
  zones: ZoneConfig;
  /** Tier for coloring */
  tier?: 'essential' | 'comfort' | 'advanced' | 'top';
  /** Compact mode for inline use */
  compact?: boolean;
}

const tierFills: Record<string, { near: string; intermediate: string; far: string }> = {
  essential: {
    near: 'hsl(215 15% 65%)',
    intermediate: 'hsl(215 15% 55%)',
    far: 'hsl(215 15% 45%)',
  },
  comfort: {
    near: 'hsl(187 55% 55%)',
    intermediate: 'hsl(187 60% 40%)',
    far: 'hsl(187 65% 30%)',
  },
  advanced: {
    near: 'hsl(205 75% 60%)',
    intermediate: 'hsl(205 80% 48%)',
    far: 'hsl(205 85% 38%)',
  },
  top: {
    near: 'hsl(38 82% 60%)',
    intermediate: 'hsl(38 88% 50%)',
    far: 'hsl(38 92% 42%)',
  },
};

const FieldOfVisionDiagram = ({ label, zones, tier = 'comfort', compact = false }: Props) => {
  const fills = tierFills[tier];
  const w = compact ? 120 : 200;
  const h = compact ? 160 : 240;
  const cx = w / 2;

  // Ellipse dimensions based on zone percentages
  const farRx = (zones.far / 100) * (w / 2 - 4);
  const farRy = h * 0.38;
  const intRx = (zones.intermediate / 100) * (w / 2 - 8);
  const intRy = h * 0.25;
  const nearRx = (zones.near / 100) * (w / 2 - 12);
  const nearRy = h * 0.14;

  const farCy = h * 0.35;
  const intCy = h * 0.55;
  const nearCy = h * 0.75;

  const fontSize = compact ? 8 : 10;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="drop-shadow-sm"
      >
        {/* Lens outline */}
        <ellipse
          cx={cx}
          cy={h * 0.48}
          rx={w / 2 - 2}
          ry={h * 0.46}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="1.5"
          strokeDasharray="4 2"
        />

        {/* Far zone */}
        <ellipse cx={cx} cy={farCy} rx={farRx} ry={farRy} fill={fills.far} opacity={0.25} />
        <ellipse cx={cx} cy={farCy} rx={farRx} ry={farRy} fill="none" stroke={fills.far} strokeWidth="1" />

        {/* Intermediate zone */}
        <ellipse cx={cx} cy={intCy} rx={intRx} ry={intRy} fill={fills.intermediate} opacity={0.35} />
        <ellipse cx={cx} cy={intCy} rx={intRx} ry={intRy} fill="none" stroke={fills.intermediate} strokeWidth="1" />

        {/* Near zone */}
        <ellipse cx={cx} cy={nearCy} rx={nearRx} ry={nearRy} fill={fills.near} opacity={0.45} />
        <ellipse cx={cx} cy={nearCy} rx={nearRx} ry={nearRy} fill="none" stroke={fills.near} strokeWidth="1.5" />

        {/* Labels */}
        {!compact && (
          <>
            <text x={cx} y={farCy} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fill={fills.far} fontWeight="600">
              Longe
            </text>
            <text x={cx} y={intCy} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fill={fills.intermediate} fontWeight="600">
              Intermediário
            </text>
            <text x={cx} y={nearCy} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fill={fills.near} fontWeight="600">
              Perto
            </text>
          </>
        )}
      </svg>
      <span className="text-xs font-medium text-muted-foreground text-center leading-tight max-w-[120px] truncate">
        {label}
      </span>
    </div>
  );
};

export default FieldOfVisionDiagram;

/** Preset zone configs by tier */
export const ZONE_PRESETS: Record<string, ZoneConfig> = {
  essential: { near: 55, intermediate: 45, far: 70 },
  comfort: { near: 65, intermediate: 60, far: 80 },
  advanced: { near: 75, intermediate: 72, far: 88 },
  top: { near: 85, intermediate: 85, far: 95 },
};
