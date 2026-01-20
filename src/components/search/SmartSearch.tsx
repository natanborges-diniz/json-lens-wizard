import { useState, useMemo, useCallback } from 'react';
import { Search, Sparkles, X, Loader2, Bot, Filter, MessageCircle, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import type { Family, AnamnesisData, LensData } from '@/types/lens';
import { toast } from 'sonner';

export interface AIRecommendation {
  familyId: string;
  reason: string;
  priority: number;
}

export interface AIResponse {
  recommendations: AIRecommendation[];
  suggestedAddons?: string[];
  explanation: string;
}

interface SmartSearchProps {
  lensData: LensData | null;
  anamnesisData: AnamnesisData;
  lensCategory: 'PROGRESSIVA' | 'MONOFOCAL' | 'OCUPACIONAL';
  onHighlightFamilies: (familyIds: string[]) => void;
  onSuggestAddons: (addonIds: string[]) => void;
  onSelectAIRecommendation?: (recommendation: AIRecommendation, allRecommendations: AIRecommendation[], aiResponse: AIResponse) => void;
}

export const SmartSearch = ({
  lensData,
  anamnesisData,
  lensCategory,
  onHighlightFamilies,
  onSuggestAddons,
  onSelectAIRecommendation,
}: SmartSearchProps) => {
  const [localQuery, setLocalQuery] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);

  // Local search suggestions - includes current category AND occupational for smart suggestions
  const localSuggestions = useMemo(() => {
    if (!localQuery || localQuery.length < 2 || !lensData) return [];

    const query = localQuery.toLowerCase();
    const isOccupationalSearch = 
      query.includes('ocupacional') || 
      query.includes('escritorio') || 
      query.includes('escritório') ||
      query.includes('office') ||
      query.includes('computador') ||
      query.includes('tela') ||
      query.includes('eyezen') ||
      query.includes('sync') ||
      query.includes('workstyle');

    const families = lensData.families.filter(f => {
      if (!f.active) return false;
      
      // Include occupational if searching for it, otherwise include current category
      const matchesCategory = isOccupationalSearch 
        ? f.category === 'OCUPACIONAL'
        : (f.category === lensCategory || f.category === 'OCUPACIONAL');
      
      if (!matchesCategory) return false;

      return (
        f.name_original.toLowerCase().includes(query) ||
        f.supplier.toLowerCase().includes(query) ||
        f.category.toLowerCase().includes(query) ||
        f.attributes_display_base.some(attr => attr.toLowerCase().includes(query))
      );
    });

    return families.slice(0, 8);
  }, [localQuery, lensData, lensCategory]);

  // Quick filters for common searches - includes occupational
  const quickFilters = useMemo(() => {
    const filters = [
      { label: 'Ocupacional', query: 'ocupacional', icon: '🖥️' },
      { label: 'Luz Azul', query: 'blue', icon: '💙' },
      { label: 'Antirreflexo', query: 'antirreflexo', icon: '✨' },
      { label: 'Fotossensível', query: 'fotossensível', icon: '🌞' },
      { label: 'Alto Índice', query: '1.74', icon: '👓' },
    ];
    return filters;
  }, []);

  // AI query presets based on anamnesis
  const aiPresets = useMemo(() => {
    const presets = [];
    
    if (anamnesisData.screenHours === '6-8' || anamnesisData.screenHours === '8+') {
      presets.push('Melhor lente para quem usa muito o computador');
    }
    
    if (anamnesisData.nightDriving === 'frequent') {
      presets.push('Lente ideal para dirigir à noite');
    }
    
    if (anamnesisData.visualComplaints.includes('light_sensitivity')) {
      presets.push('Opções para sensibilidade à luz');
    }
    
    if (anamnesisData.aestheticPriority === 'high') {
      presets.push('Lentes mais finas e estéticas');
    }

    if (anamnesisData.outdoorTime === 'yes') {
      presets.push('Lentes para quem fica muito ao ar livre');
    }

    return presets.length > 0 ? presets : ['Qual a melhor lente para este cliente?'];
  }, [anamnesisData]);

  const handleLocalSearch = useCallback((query: string) => {
    setLocalQuery(query);
    
    if (!query || !lensData) {
      onHighlightFamilies([]);
      return;
    }

    const q = query.toLowerCase();
    const isOccupationalSearch = 
      q.includes('ocupacional') || 
      q.includes('escritorio') || 
      q.includes('escritório') ||
      q.includes('office') ||
      q.includes('computador') ||
      q.includes('tela') ||
      q.includes('eyezen') ||
      q.includes('sync') ||
      q.includes('workstyle');

    const matchingIds = lensData.families
      .filter(f => {
        if (!f.active) return false;
        
        // Include occupational if searching for it
        const matchesCategory = isOccupationalSearch 
          ? f.category === 'OCUPACIONAL'
          : (f.category === lensCategory || f.category === 'OCUPACIONAL');
        
        if (!matchesCategory) return false;

        return (
          f.name_original.toLowerCase().includes(q) ||
          f.supplier.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q) ||
          f.attributes_display_base.some(attr => attr.toLowerCase().includes(q))
        );
      })
      .map(f => f.id);

    onHighlightFamilies(matchingIds);
  }, [lensData, lensCategory, onHighlightFamilies]);

  const handleAiSearch = async () => {
    if (!aiQuery.trim() || !lensData) return;

    setIsLoading(true);
    setAiResponse(null);

    try {
      const { data, error } = await supabase.functions.invoke('smart-search', {
        body: {
          query: aiQuery,
          lensData: {
            families: lensData.families,
            addons: lensData.addons,
          },
          anamnesisData,
          lensCategory,
        },
      });

      if (error) throw error;

      console.log('AI Search result:', data);
      setAiResponse(data);

      // Highlight recommended families
      if (data.recommendations?.length > 0) {
        const familyIds = data.recommendations
          .sort((a: AIRecommendation, b: AIRecommendation) => b.priority - a.priority)
          .map((r: AIRecommendation) => r.familyId);
        onHighlightFamilies(familyIds);
      }

      // Suggest addons
      if (data.suggestedAddons?.length > 0) {
        onSuggestAddons(data.suggestedAddons);
      }

    } catch (error) {
      console.error('AI search error:', error);
      toast.error('Erro ao consultar IA. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresetClick = (preset: string) => {
    setAiQuery(preset);
  };

  const clearSearch = () => {
    setLocalQuery('');
    onHighlightFamilies([]);
  };

  const clearAiSearch = () => {
    setAiQuery('');
    setAiResponse(null);
    onHighlightFamilies([]);
    onSuggestAddons([]);
  };

  const getFamilyName = (familyId: string) => {
    return lensData?.families.find(f => f.id === familyId)?.name_original || familyId;
  };

  return (
    <div className="space-y-4">
      {/* Main Search Bar */}
      <div className="flex gap-2">
        {/* Local Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar lentes, fabricantes, características..."
            value={localQuery}
            onChange={(e) => handleLocalSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {localQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          
          {/* Local Suggestions Dropdown */}
          {localSuggestions.length > 0 && localQuery.length >= 2 && (
            <Card className="absolute top-full left-0 right-0 mt-1 z-50 p-2 max-h-64 overflow-auto">
              {localSuggestions.map(family => (
                <button
                  key={family.id}
                  onClick={() => {
                    onHighlightFamilies([family.id]);
                    setLocalQuery(family.name_original);
                  }}
                  className="w-full text-left p-2 rounded hover:bg-muted flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-medium text-sm">{family.name_original}</p>
                    <p className="text-xs text-muted-foreground">{family.supplier}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {family.macro.replace('PROG_', '').replace('MONO_', '')}
                  </Badge>
                </button>
              ))}
            </Card>
          )}
        </div>

        {/* AI Search Button */}
        <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2 shrink-0">
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Consultar IA</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                Consulta Inteligente
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Query Input */}
              <div className="space-y-2">
                <Textarea
                  placeholder="Faça uma pergunta sobre lentes... Ex: 'Qual a melhor lente para quem trabalha muito no computador?'"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleAiSearch} 
                    disabled={isLoading || !aiQuery.trim()}
                    className="flex-1 gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <MessageCircle className="w-4 h-4" />
                        Consultar
                      </>
                    )}
                  </Button>
                  
                  {aiResponse && (
                    <Button variant="outline" onClick={clearAiSearch}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Preset Suggestions */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Sugestões baseadas no perfil:</p>
                <div className="flex flex-wrap gap-2">
                  {aiPresets.map((preset, idx) => (
                    <Button
                      key={idx}
                      variant="secondary"
                      size="sm"
                      className="text-xs"
                      onClick={() => handlePresetClick(preset)}
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
              </div>

              {/* AI Response */}
              {aiResponse && (
                <Card className="p-4 bg-muted/30 space-y-3">
                  {/* Explanation */}
                  <p className="text-sm">{aiResponse.explanation}</p>

                  {/* Recommendations */}
                  {aiResponse.recommendations?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Recomendações (clique para ver detalhes):
                      </p>
                      <div className="space-y-2">
                        {aiResponse.recommendations
                          .sort((a, b) => b.priority - a.priority)
                          .map((rec, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                if (onSelectAIRecommendation) {
                                  onSelectAIRecommendation(rec, aiResponse.recommendations, aiResponse);
                                  setIsAiDialogOpen(false);
                                }
                              }}
                              className="w-full p-2 bg-background rounded-lg border flex items-start gap-2 hover:border-primary hover:bg-primary/5 transition-all text-left group"
                            >
                              <Badge 
                                variant={idx === 0 ? 'default' : 'outline'} 
                                className="shrink-0 mt-0.5"
                              >
                                {idx + 1}º
                              </Badge>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm group-hover:text-primary transition-colors">
                                  {getFamilyName(rec.familyId)}
                                </p>
                                <p className="text-xs text-muted-foreground">{rec.reason}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Addons */}
                  {aiResponse.suggestedAddons && aiResponse.suggestedAddons.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Complementos sugeridos:</p>
                      <div className="flex flex-wrap gap-1">
                        {aiResponse.suggestedAddons.map(addonId => (
                          <Badge key={addonId} variant="secondary" className="text-xs">
                            {lensData?.addons.find(a => a.id === addonId)?.name_common || addonId}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Apply Button */}
                  <Button 
                    className="w-full" 
                    size="sm"
                    onClick={() => setIsAiDialogOpen(false)}
                  >
                    Ver recomendações
                  </Button>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Filters */}
      <div className="flex gap-2 flex-wrap">
        {quickFilters.map((filter, idx) => (
          <Button
            key={idx}
            variant={localQuery.toLowerCase().includes(filter.query) ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => handleLocalSearch(filter.query)}
          >
            <span>{filter.icon}</span>
            {filter.label}
          </Button>
        ))}
      </div>
    </div>
  );
};
