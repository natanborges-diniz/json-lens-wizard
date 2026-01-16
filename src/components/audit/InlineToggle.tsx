import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineToggleProps {
  active: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
}

export const InlineToggle = ({ active, onToggle, size = 'md' }: InlineToggleProps) => {
  const sizeClasses = size === 'sm' 
    ? "w-7 h-7" 
    : "w-8 h-8";
  const iconClasses = size === 'sm' 
    ? "w-3.5 h-3.5" 
    : "w-4 h-4";
  
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        sizeClasses,
        "rounded-full flex items-center justify-center transition-all duration-200",
        "hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/50",
        active 
          ? "bg-success/20 text-success hover:bg-success/30" 
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
      title={active ? "Clique para desativar" : "Clique para ativar"}
    >
      {active ? (
        <Eye className={iconClasses} />
      ) : (
        <EyeOff className={iconClasses} />
      )}
    </button>
  );
};
