import { ReactNode } from 'react';
import { Check } from 'lucide-react';

interface OptionCardProps {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  label: string;
  description?: string;
  multiSelect?: boolean;
}

export const OptionCard = ({ selected, onClick, icon, label, description, multiSelect = false }: OptionCardProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border hover:border-primary/50 bg-card hover:bg-muted/30'
      }`}
    >
      {/* Selection indicator */}
      <div className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
        selected 
          ? 'border-primary bg-primary' 
          : 'border-muted-foreground/30'
      }`}>
        {selected && <Check className="w-4 h-4 text-primary-foreground" />}
      </div>
      
      {/* Icon */}
      {icon && (
        <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${
          selected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        }`}>
          {icon}
        </div>
      )}
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={`font-medium ${selected ? 'text-primary' : 'text-foreground'}`}>
          {label}
        </div>
        {description && (
          <div className="text-sm text-muted-foreground mt-0.5 truncate">
            {description}
          </div>
        )}
      </div>
    </button>
  );
};
