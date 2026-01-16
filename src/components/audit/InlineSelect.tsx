import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
  color?: string;
}

interface InlineSelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  displayLabel?: string;
  className?: string;
  colorClass?: string;
}

export const InlineSelect = ({ 
  value, 
  options, 
  onChange, 
  displayLabel,
  className,
  colorClass 
}: InlineSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const selectedOption = options.find(o => o.value === value);
  const display = displayLabel || selectedOption?.label || value;
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium",
          "transition-all duration-150 cursor-pointer",
          "hover:ring-2 hover:ring-primary/30 hover:shadow-sm",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          colorClass || "bg-muted text-foreground",
          isOpen && "ring-2 ring-primary/50",
          className
        )}
      >
        <span>{display}</span>
        <ChevronDown className={cn(
          "w-3 h-3 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 min-w-[180px] max-h-[300px] overflow-y-auto
          bg-popover border border-border rounded-lg shadow-lg py-1
          animate-in fade-in-0 zoom-in-95 duration-100">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
                "hover:bg-muted transition-colors",
                value === option.value && "bg-primary/10"
              )}
            >
              {option.color && (
                <span className={cn("w-2 h-2 rounded-full", option.color)} />
              )}
              <span className="flex-1">{option.label}</span>
              {value === option.value && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
