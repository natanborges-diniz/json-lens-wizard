import { useState, useRef, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface EditableBadgeListProps {
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxDisplay?: number;
}

export const EditableBadgeList = ({ 
  values, 
  onChange, 
  suggestions = [],
  placeholder = "Adicionar...",
  maxDisplay = 5
}: EditableBadgeListProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const displayValues = values.slice(0, maxDisplay);
  const hiddenCount = values.length - maxDisplay;
  
  const filteredSuggestions = suggestions.filter(s => 
    !values.includes(s) && s.toLowerCase().includes(search.toLowerCase())
  );
  
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsAdding(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const removeValue = (val: string) => {
    onChange(values.filter(v => v !== val));
  };
  
  const addValue = (val: string) => {
    if (!values.includes(val)) {
      onChange([...values, val]);
    }
    setSearch('');
    setIsAdding(false);
  };
  
  return (
    <div ref={containerRef} className="flex flex-wrap gap-1 items-center">
      {displayValues.map((val) => (
        <Badge 
          key={val} 
          variant="outline" 
          className="text-xs group cursor-pointer hover:bg-destructive/10 hover:border-destructive/50 pr-1"
        >
          {val}
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeValue(val);
            }}
            className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      
      {hiddenCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          +{hiddenCount}
        </Badge>
      )}
      
      <div className="relative">
        {isAdding ? (
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-24 h-6 px-2 text-xs border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder={placeholder}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim()) {
                  addValue(search.trim());
                }
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setSearch('');
                }
              }}
            />
            {filteredSuggestions.length > 0 && (
              <div className="absolute z-50 mt-1 w-48 max-h-40 overflow-y-auto
                bg-popover border border-border rounded-lg shadow-lg py-1">
                {filteredSuggestions.slice(0, 8).map((sug) => (
                  <button
                    key={sug}
                    onClick={() => addValue(sug)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-muted"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center",
              "bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary",
              "transition-colors"
            )}
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
