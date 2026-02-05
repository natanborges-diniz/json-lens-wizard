/**
 * ConsultativeNarrativePanel - Painel de narrativa consultiva
 * 
 * Exibe o resumo consultivo da recomendação, incluindo:
 * - Script de abertura baseado na anamnese
 * - Destaque do "Por que esta lente?"
 * - Pílulas de venda (sales_pills)
 * - Knowledge para o cliente
 */

import { MessageCircle, Lightbulb, Sparkles, ChevronRight, User, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import type { ConsultativeNarrative, NarrativeResult } from '@/lib/recommendationEngine/narrativeEngine';

interface ConsultativeNarrativePanelProps {
  narrativeResult: NarrativeResult;
  selectedFamilyId?: string;
}

export const ConsultativeNarrativePanel = ({
  narrativeResult,
  selectedFamilyId,
}: ConsultativeNarrativePanelProps) => {
  const { openingScript, familyNarratives, topRecommendationNarrative } = narrativeResult;

  // Get narrative for selected family or top recommendation
  const currentNarrative = selectedFamilyId 
    ? familyNarratives[selectedFamilyId] 
    : topRecommendationNarrative;

  if (!currentNarrative) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-background to-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          Resumo Consultivo
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Opening Script */}
        <div className="p-3 bg-primary/10 rounded-lg">
          <p className="text-sm text-foreground">
            {openingScript}
          </p>
        </div>

        {/* Why This Lens */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Por que esta lente?
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            {currentNarrative.whyThisLens}
          </p>
        </div>

        <Separator />

        {/* Benefits / Sales Pills */}
        {currentNarrative.benefits.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Destaques
            </div>
            <div className="flex flex-wrap gap-2">
              {currentNarrative.benefits.map((benefit, index) => (
                <Badge 
                  key={index} 
                  variant="secondary"
                  className="text-xs"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  {benefit}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Technologies */}
        {currentNarrative.technologies.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Tecnologias
            </div>
            <ul className="space-y-1.5">
              {currentNarrative.technologies.map((tech, index) => (
                <li 
                  key={index}
                  className="flex items-start gap-2 text-sm"
                >
                  <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">{tech.name}</span>
                    {tech.description && (
                      <span className="text-muted-foreground"> - {tech.description}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator />

        {/* Knowledge Tabs (Consumer vs Consultant) */}
        {(currentNarrative.knowledgeConsumer || currentNarrative.knowledgeConsultant) && (
          <Tabs defaultValue="consumer" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="consumer" className="text-xs">
                <User className="w-3 h-3 mr-1" />
                Para o Cliente
              </TabsTrigger>
              <TabsTrigger value="consultant" className="text-xs">
                <Briefcase className="w-3 h-3 mr-1" />
                Para o Vendedor
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="consumer" className="mt-2">
              <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                {currentNarrative.knowledgeConsumer || 'Informação não disponível no catálogo.'}
              </div>
            </TabsContent>
            
            <TabsContent value="consultant" className="mt-2">
              <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                {currentNarrative.knowledgeConsultant || 'Informação técnica não disponível no catálogo.'}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Upsell Hint */}
        {currentNarrative.upsellHint && (
          <div className="p-3 border border-dashed border-primary/30 rounded-lg bg-primary/5">
            <p className="text-xs text-primary">
              💡 {currentNarrative.upsellHint}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConsultativeNarrativePanel;
