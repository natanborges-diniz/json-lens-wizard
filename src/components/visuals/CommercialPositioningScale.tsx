/**
 * Commercial Positioning Scale
 * 
 * Visual staircase showing tier positioning from Essential → Top.
 * Highlights the current tier and shows upgrade path.
 */

import { cn } from '@/lib/utils';

interface Props {
  /** Which tier is active/highlighted */
  activeTier: 'essential' | 'comfort' | 'advanced' | 'top';
  /** Optional: show upgrade arrow to this tier */
  upgradeTo?: 'comfort' | 'advanced' | 'top';
  /** Compact mode */
  compact?: boolean;
  /** Show labels */
  showLabels?: boolean;
}

const tiers = [
  { key: 'essential', label: 'Essencial', shortLabel: 'E', height: 1 },
  { key: 'comfort', label: 'Conforto', shortLabel: 'C', height: 2 },
  { key: 'advanced', label: 'Avançado', shortLabel: 'A', height: 3 },
  { key: 'top', label: 'Topo', shortLabel: 'T', height: 4 },
] as const;

const tierColorMap: Record<string, { bg: string; active: string; text: string }> = {
  essential: {
    bg: 'bg-muted/50',
    active: 'bg-[hsl(var(--tier-essential))]',
    text: 'text-[hsl(var(--tier-essential))]',
  },
  comfort: {
    bg: 'bg-muted/50',
    active: 'bg-[hsl(var(--tier-comfort))]',
    text: 'text-[hsl(var(--tier-comfort))]',
  },
  advanced: {
    bg: 'bg-muted/50',
    active: 'bg-[hsl(var(--tier-advanced))]',
    text: 'text-[hsl(var(--tier-advanced))]',
  },
  top: {
    bg: 'bg-muted/50',
    active: 'bg-[hsl(var(--tier-top))]',
    text: 'text-[hsl(var(--tier-top))]',
  },
};

const CommercialPositioningScale = ({
  activeTier,
  upgradeTo,
  compact = false,
  showLabels = true,
}: Props) => {
  const barWidth = compact ? 'w-8' : 'w-12';
  const maxH = compact ? 48 : 64;
  const gap = compact ? 'gap-1' : 'gap-1.5';

  return (
    <div className="flex flex-col items-center">
      <div className={`flex items-end ${gap}`}>
        {tiers.map((tier) => {
          const isActive = tier.key === activeTier;
          const isUpgrade = tier.key === upgradeTo;
          const h = (tier.height / 4) * maxH;
          const colors = tierColorMap[tier.key];

          return (
            <div key={tier.key} className="flex flex-col items-center gap-0.5">
              <div
                className={cn(
                  barWidth,
                  'rounded-t-md transition-all duration-300 relative',
                  isActive ? colors.active : isUpgrade ? `${colors.active} opacity-50` : colors.bg,
                  isActive && 'ring-2 ring-offset-1 ring-foreground/20'
                )}
                style={{ height: `${h}px` }}
              >
                {/* Upgrade arrow */}
                {isUpgrade && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-foreground animate-bounce">
                    <svg width="12" height="10" viewBox="0 0 12 10">
                      <path d="M6 0L12 10H0Z" fill="currentColor" opacity="0.6" />
                    </svg>
                  </div>
                )}

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-foreground/60" />
                )}
              </div>

              {showLabels && (
                <span
                  className={cn(
                    'font-medium leading-none',
                    compact ? 'text-[8px]' : 'text-[10px]',
                    isActive ? colors.text : 'text-muted-foreground'
                  )}
                >
                  {compact ? tier.shortLabel : tier.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CommercialPositioningScale;
