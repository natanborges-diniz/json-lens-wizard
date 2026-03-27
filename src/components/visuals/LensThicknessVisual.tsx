/**
 * Lens Thickness Visual
 * 
 * Cross-section illustration showing relative lens thickness by refractive index.
 * Higher index = thinner lens.
 */

interface Props {
  refractiveIndex: number;
  materialName: string;
  /** Aesthetic score 1-5 */
  aestheticScore?: number;
  compact?: boolean;
}

const indexThicknessMap: Record<string, { edgeThickness: number; label: string; color: string }> = {
  '1.50': { edgeThickness: 28, label: 'Padrão', color: 'hsl(215 15% 55%)' },
  '1.53': { edgeThickness: 24, label: 'Leve', color: 'hsl(187 50% 50%)' },
  '1.56': { edgeThickness: 22, label: 'Fino', color: 'hsl(187 60% 45%)' },
  '1.59': { edgeThickness: 20, label: 'Fino', color: 'hsl(205 60% 50%)' },
  '1.60': { edgeThickness: 18, label: 'Fino', color: 'hsl(205 70% 45%)' },
  '1.67': { edgeThickness: 13, label: 'Muito Fino', color: 'hsl(205 80% 40%)' },
  '1.74': { edgeThickness: 9, label: 'Ultra Fino', color: 'hsl(38 85% 48%)' },
};

function getThicknessConfig(index: number) {
  const key = index.toFixed(2);
  if (indexThicknessMap[key]) return indexThicknessMap[key];
  // Fallback: interpolate
  if (index <= 1.50) return indexThicknessMap['1.50'];
  if (index >= 1.74) return indexThicknessMap['1.74'];
  return { edgeThickness: Math.round(28 - (index - 1.50) * 80), label: `${index}`, color: 'hsl(205 60% 50%)' };
}

const LensThicknessVisual = ({ refractiveIndex, materialName, aestheticScore, compact = false }: Props) => {
  const config = getThicknessConfig(refractiveIndex);
  const w = compact ? 80 : 120;
  const h = compact ? 50 : 70;
  const centerThickness = 4;
  const edgeH = config.edgeThickness;

  // Cross-section path: left edge thick → center thin → right edge thick
  const path = `
    M ${w * 0.1} ${h / 2 - edgeH / 2}
    Q ${w * 0.35} ${h / 2 - centerThickness / 2} ${w / 2} ${h / 2 - centerThickness / 2}
    Q ${w * 0.65} ${h / 2 - centerThickness / 2} ${w * 0.9} ${h / 2 - edgeH / 2}
    L ${w * 0.9} ${h / 2 + edgeH / 2}
    Q ${w * 0.65} ${h / 2 + centerThickness / 2} ${w / 2} ${h / 2 + centerThickness / 2}
    Q ${w * 0.35} ${h / 2 + centerThickness / 2} ${w * 0.1} ${h / 2 + edgeH / 2}
    Z
  `;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <path
          d={path}
          fill={config.color}
          opacity={0.3}
          stroke={config.color}
          strokeWidth="1.5"
        />
        {/* Center dot */}
        <circle cx={w / 2} cy={h / 2} r="2" fill={config.color} />
      </svg>

      <div className="text-center">
        <div className={`font-semibold text-foreground ${compact ? 'text-[10px]' : 'text-xs'}`}>
          {refractiveIndex.toFixed(2)}
        </div>
        <div className={`text-muted-foreground ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          {config.label}
        </div>
        {!compact && (
          <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">
            {materialName}
          </div>
        )}
      </div>

      {aestheticScore != null && !compact && (
        <div className="flex gap-0.5 mt-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-3 rounded-full ${
                i < aestheticScore ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LensThicknessVisual;
