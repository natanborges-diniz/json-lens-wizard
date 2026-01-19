import { useState, useCallback, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  GripVertical, 
  Play,
  Settings2,
  CheckCircle,
  AlertTriangle,
  Copy,
  ToggleLeft,
  ToggleRight,
  Wand2,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  type MatchingRule, 
  type MatchingCondition,
  type FamilyMatchingEngine,
  normalizeDescription
} from '@/lib/skuClassificationEngine';
import type { FamilyExtended, Price } from '@/types/lens';
import { toast } from 'sonner';

interface MatchingRulesEditorProps {
  engine: FamilyMatchingEngine | null;
  families: FamilyExtended[];
  prices: Price[];
  onSaveEngine: (engine: FamilyMatchingEngine) => void;
}

// Field labels for UI
const FIELD_LABELS: Record<MatchingCondition['field'], string> = {
  description: 'Descrição',
  supplier: 'Fornecedor',
  lens_category_raw: 'Categoria Raw',
  manufacturing_type: 'Tipo Fabricação',
  index: 'Índice'
};

// Operator labels for UI
const OPERATOR_LABELS: Record<MatchingCondition['operator'], string> = {
  contains: 'Contém',
  not_contains: 'Não Contém',
  equals: 'Igual a',
  starts_with: 'Começa com',
  ends_with: 'Termina com',
  regex: 'Regex'
};

// Default rule template
const createDefaultRule = (): MatchingRule => ({
  id: `rule_${Date.now()}`,
  name: 'Nova Regra',
  priority: 100,
  conditions: [{
    field: 'description',
    operator: 'contains',
    value: '',
    case_sensitive: false
  }],
  match_type: 'all',
  target_family_id: '',
  enabled: true
});

// Default engine template
const createDefaultEngine = (): FamilyMatchingEngine => ({
  version: '1.0',
  fallback_family_id: '',
  normalization_rules: [],
  matching_rules: [],
  auto_deactivate_empty_families: true
});

export function MatchingRulesEditor({ 
  engine, 
  families, 
  prices,
  onSaveEngine 
}: MatchingRulesEditorProps) {
  const [localEngine, setLocalEngine] = useState<FamilyMatchingEngine>(
    engine || createDefaultEngine()
  );
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testText, setTestText] = useState('');
  const [testResults, setTestResults] = useState<{
    normalized: string;
    matchedRule: MatchingRule | null;
    matchedFamily: FamilyExtended | null;
  } | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Active families sorted by name
  const activeFamilies = useMemo(() => 
    families
      .filter(f => f.active)
      .sort((a, b) => a.name_original.localeCompare(b.name_original)),
    [families]
  );

  // Get family by ID
  const getFamilyById = useCallback((id: string) => 
    families.find(f => f.id === id),
    [families]
  );

  // Toggle rule expansion
  const toggleExpanded = useCallback((ruleId: string) => {
    setExpandedRules(prev => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  }, []);

  // Add new rule
  const handleAddRule = useCallback(() => {
    const newRule = createDefaultRule();
    setLocalEngine(prev => ({
      ...prev,
      matching_rules: [...prev.matching_rules, newRule]
    }));
    setExpandedRules(prev => new Set([...prev, newRule.id]));
    setHasUnsavedChanges(true);
    toast.success('Nova regra criada');
  }, []);

  // Duplicate rule
  const handleDuplicateRule = useCallback((rule: MatchingRule) => {
    const newRule: MatchingRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      name: `${rule.name} (cópia)`,
      priority: rule.priority + 1
    };
    setLocalEngine(prev => ({
      ...prev,
      matching_rules: [...prev.matching_rules, newRule]
    }));
    setExpandedRules(prev => new Set([...prev, newRule.id]));
    setHasUnsavedChanges(true);
    toast.success('Regra duplicada');
  }, []);

  // Delete rule
  const handleDeleteRule = useCallback((ruleId: string) => {
    setLocalEngine(prev => ({
      ...prev,
      matching_rules: prev.matching_rules.filter(r => r.id !== ruleId)
    }));
    setHasUnsavedChanges(true);
    toast.success('Regra removida');
  }, []);

  // Toggle rule enabled
  const handleToggleRule = useCallback((ruleId: string) => {
    setLocalEngine(prev => ({
      ...prev,
      matching_rules: prev.matching_rules.map(r => 
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      )
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Update rule property
  const handleUpdateRule = useCallback((ruleId: string, updates: Partial<MatchingRule>) => {
    setLocalEngine(prev => ({
      ...prev,
      matching_rules: prev.matching_rules.map(r => 
        r.id === ruleId ? { ...r, ...updates } : r
      )
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Add condition to rule
  const handleAddCondition = useCallback((ruleId: string) => {
    const newCondition: MatchingCondition = {
      field: 'description',
      operator: 'contains',
      value: '',
      case_sensitive: false
    };
    setLocalEngine(prev => ({
      ...prev,
      matching_rules: prev.matching_rules.map(r => 
        r.id === ruleId 
          ? { ...r, conditions: [...r.conditions, newCondition] } 
          : r
      )
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Remove condition from rule
  const handleRemoveCondition = useCallback((ruleId: string, conditionIndex: number) => {
    setLocalEngine(prev => ({
      ...prev,
      matching_rules: prev.matching_rules.map(r => 
        r.id === ruleId 
          ? { ...r, conditions: r.conditions.filter((_, i) => i !== conditionIndex) } 
          : r
      )
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Update condition
  const handleUpdateCondition = useCallback((
    ruleId: string, 
    conditionIndex: number, 
    updates: Partial<MatchingCondition>
  ) => {
    setLocalEngine(prev => ({
      ...prev,
      matching_rules: prev.matching_rules.map(r => 
        r.id === ruleId 
          ? { 
              ...r, 
              conditions: r.conditions.map((c, i) => 
                i === conditionIndex ? { ...c, ...updates } : c
              ) 
            } 
          : r
      )
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Move rule (change priority)
  const handleMoveRule = useCallback((ruleId: string, direction: 'up' | 'down') => {
    setLocalEngine(prev => {
      const rules = [...prev.matching_rules];
      const index = rules.findIndex(r => r.id === ruleId);
      if (index < 0) return prev;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= rules.length) return prev;
      
      // Swap priorities
      const temp = rules[index].priority;
      rules[index] = { ...rules[index], priority: rules[newIndex].priority };
      rules[newIndex] = { ...rules[newIndex], priority: temp };
      
      return {
        ...prev,
        matching_rules: rules.sort((a, b) => a.priority - b.priority)
      };
    });
    setHasUnsavedChanges(true);
  }, []);

  // Update fallback family
  const handleUpdateFallback = useCallback((familyId: string) => {
    setLocalEngine(prev => ({
      ...prev,
      fallback_family_id: familyId
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Test rule against text
  const handleTest = useCallback(() => {
    if (!testText.trim()) {
      toast.error('Digite um texto para testar');
      return;
    }

    // Normalize the test text
    const normalized = normalizeDescription(testText, localEngine.normalization_rules);
    
    // Find matching rule
    const sortedRules = [...localEngine.matching_rules]
      .filter(r => r.enabled)
      .sort((a, b) => a.priority - b.priority);
    
    let matchedRule: MatchingRule | null = null;
    
    for (const rule of sortedRules) {
      const results = rule.conditions.map(condition => {
        let fieldValue = normalized;
        if (condition.field !== 'description') {
          fieldValue = ''; // Can't test other fields with text alone
        }
        
        const compareValue = condition.case_sensitive 
          ? condition.value 
          : condition.value.toLowerCase();
        const compareField = condition.case_sensitive 
          ? fieldValue 
          : fieldValue.toLowerCase();
        
        switch (condition.operator) {
          case 'contains':
            return compareField.includes(compareValue);
          case 'not_contains':
            return !compareField.includes(compareValue);
          case 'equals':
            return compareField === compareValue;
          case 'starts_with':
            return compareField.startsWith(compareValue);
          case 'ends_with':
            return compareField.endsWith(compareValue);
          case 'regex':
            try {
              const regex = new RegExp(condition.value, condition.case_sensitive ? '' : 'i');
              return regex.test(fieldValue);
            } catch {
              return false;
            }
          default:
            return false;
        }
      });
      
      const matches = rule.match_type === 'all' 
        ? results.every(r => r)
        : results.some(r => r);
      
      if (matches) {
        matchedRule = rule;
        break;
      }
    }

    const matchedFamily = matchedRule 
      ? getFamilyById(matchedRule.target_family_id)
      : localEngine.fallback_family_id 
        ? getFamilyById(localEngine.fallback_family_id)
        : null;

    setTestResults({
      normalized,
      matchedRule,
      matchedFamily: matchedFamily || null
    });
  }, [testText, localEngine, getFamilyById]);

  // Save engine
  const handleSave = useCallback(() => {
    // Validate rules
    const invalidRules = localEngine.matching_rules.filter(r => 
      !r.target_family_id || r.conditions.some(c => !c.value.trim())
    );

    if (invalidRules.length > 0) {
      toast.error(`${invalidRules.length} regra(s) incompleta(s)`);
      return;
    }

    setShowSaveConfirm(true);
  }, [localEngine]);

  const confirmSave = useCallback(() => {
    onSaveEngine(localEngine);
    setHasUnsavedChanges(false);
    setShowSaveConfirm(false);
    toast.success('Regras de classificação salvas');
  }, [localEngine, onSaveEngine]);

  // Stats
  const stats = useMemo(() => ({
    total: localEngine.matching_rules.length,
    enabled: localEngine.matching_rules.filter(r => r.enabled).length,
    disabled: localEngine.matching_rules.filter(r => !r.enabled).length
  }), [localEngine]);

  // Sorted rules
  const sortedRules = useMemo(() => 
    [...localEngine.matching_rules].sort((a, b) => a.priority - b.priority),
    [localEngine.matching_rules]
  );

  return (
    <div className="space-y-4">
      {/* Header with Stats and Actions */}
      <Card className="bg-card/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-primary" />
                <span className="font-medium">Regras de Matching</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {stats.total} regras
                </Badge>
                <Badge variant="default" className="bg-success/10 text-success">
                  {stats.enabled} ativas
                </Badge>
                {stats.disabled > 0 && (
                  <Badge variant="outline">
                    {stats.disabled} inativas
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowTestDialog(true)}
              >
                <Play className="w-4 h-4 mr-2" />
                Testar Regras
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleAddRule}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Regra
              </Button>
              {hasUnsavedChanges && (
                <Button 
                  size="sm"
                  onClick={handleSave}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fallback Family Setting */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Família Fallback</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quando nenhuma regra combinar, os SKUs serão atribuídos a esta família
              </p>
            </div>
            <Select 
              value={localEngine.fallback_family_id} 
              onValueChange={handleUpdateFallback}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecione a família fallback" />
              </SelectTrigger>
              <SelectContent>
                {activeFamilies.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name_original}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rules List */}
      <ScrollArea className="h-[calc(100vh-420px)]">
        <div className="space-y-3 pr-4">
          {sortedRules.length === 0 ? (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="p-8 text-center">
                <Settings2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">
                  Nenhuma regra de classificação configurada
                </p>
                <Button onClick={handleAddRule}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Regra
                </Button>
              </CardContent>
            </Card>
          ) : (
            sortedRules.map((rule, index) => {
              const isExpanded = expandedRules.has(rule.id);
              const targetFamily = getFamilyById(rule.target_family_id);
              const hasInvalidConditions = rule.conditions.some(c => !c.value.trim());
              
              return (
                <Card 
                  key={rule.id} 
                  className={`${!rule.enabled ? 'opacity-60' : ''} ${hasInvalidConditions ? 'border-warning' : ''}`}
                >
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(rule.id)}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="p-3 cursor-pointer hover:bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col items-center gap-1 text-muted-foreground">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveRule(rule.id, 'up');
                                }}
                                disabled={index === 0}
                              >
                                <ChevronUp className="w-3 h-3" />
                              </Button>
                              <span className="text-xs font-mono">{rule.priority}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveRule(rule.id, 'down');
                                }}
                                disabled={index === sortedRules.length - 1}
                              >
                                <ChevronDown className="w-3 h-3" />
                              </Button>
                            </div>
                            
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{rule.name}</span>
                                <Badge variant={rule.enabled ? 'default' : 'secondary'} className="text-xs">
                                  {rule.enabled ? 'Ativa' : 'Inativa'}
                                </Badge>
                                {hasInvalidConditions && (
                                  <Badge variant="outline" className="text-warning border-warning text-xs">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Incompleta
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {rule.conditions.length} condição(ões)
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {rule.match_type === 'all' ? 'E (AND)' : 'OU (OR)'}
                                </Badge>
                                {targetFamily && (
                                  <span className="text-xs text-muted-foreground">
                                    → {targetFamily.name_original}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleRule(rule.id);
                              }}
                            >
                              {rule.enabled 
                                ? <ToggleRight className="w-4 h-4 text-success" />
                                : <ToggleLeft className="w-4 h-4" />
                              }
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateRule(rule);
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRule(rule.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            {isExpanded 
                              ? <ChevronUp className="w-4 h-4" />
                              : <ChevronDown className="w-4 h-4" />
                            }
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <CardContent className="p-4 pt-0 space-y-4 border-t">
                        {/* Rule Name and Match Type */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Nome da Regra</Label>
                            <Input
                              value={rule.name}
                              onChange={(e) => handleUpdateRule(rule.id, { name: e.target.value })}
                              placeholder="Nome descritivo"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Tipo de Match</Label>
                            <Select 
                              value={rule.match_type}
                              onValueChange={(v) => handleUpdateRule(rule.id, { match_type: v as 'all' | 'any' })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todas (AND)</SelectItem>
                                <SelectItem value="any">Qualquer (OR)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Target Family */}
                        <div className="space-y-2">
                          <Label>Família Destino</Label>
                          <Select 
                            value={rule.target_family_id}
                            onValueChange={(v) => handleUpdateRule(rule.id, { target_family_id: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a família de destino" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeFamilies.map(f => (
                                <SelectItem key={f.id} value={f.id}>
                                  <span>{f.name_original}</span>
                                  <span className="text-muted-foreground ml-2">({f.supplier})</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Conditions */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>Condições</Label>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleAddCondition(rule.id)}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Condição
                            </Button>
                          </div>
                          
                          {rule.conditions.map((condition, condIndex) => (
                            <Card key={condIndex} className="bg-muted/30 p-3">
                              <div className="grid grid-cols-12 gap-2 items-end">
                                <div className="col-span-3 space-y-1">
                                  <Label className="text-xs">Campo</Label>
                                  <Select
                                    value={condition.field}
                                    onValueChange={(v) => handleUpdateCondition(
                                      rule.id, 
                                      condIndex, 
                                      { field: v as MatchingCondition['field'] }
                                    )}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(FIELD_LABELS).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>{label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div className="col-span-3 space-y-1">
                                  <Label className="text-xs">Operador</Label>
                                  <Select
                                    value={condition.operator}
                                    onValueChange={(v) => handleUpdateCondition(
                                      rule.id, 
                                      condIndex, 
                                      { operator: v as MatchingCondition['operator'] }
                                    )}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(OPERATOR_LABELS).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>{label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div className="col-span-4 space-y-1">
                                  <Label className="text-xs">Valor</Label>
                                  <Input
                                    value={condition.value}
                                    onChange={(e) => handleUpdateCondition(
                                      rule.id, 
                                      condIndex, 
                                      { value: e.target.value }
                                    )}
                                    placeholder={condition.operator === 'regex' ? 'Expressão regular' : 'Texto para comparar'}
                                    className="h-9"
                                  />
                                </div>
                                
                                <div className="col-span-1 flex items-center gap-1">
                                  <div className="flex items-center gap-1" title="Case sensitive">
                                    <Checkbox
                                      checked={condition.case_sensitive}
                                      onCheckedChange={(checked) => handleUpdateCondition(
                                        rule.id, 
                                        condIndex, 
                                        { case_sensitive: !!checked }
                                      )}
                                    />
                                    <span className="text-xs">Aa</span>
                                  </div>
                                </div>
                                
                                <div className="col-span-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-destructive hover:text-destructive"
                                    onClick={() => handleRemoveCondition(rule.id, condIndex)}
                                    disabled={rule.conditions.length === 1}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Testar Regras de Classificação
            </DialogTitle>
            <DialogDescription>
              Digite uma descrição de produto para testar qual regra será aplicada
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição do Produto</Label>
              <Input
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Ex: VARILUX COMFORT MAX CRIZAL ROCK 1.67"
                onKeyDown={(e) => e.key === 'Enter' && handleTest()}
              />
            </div>
            
            <Button onClick={handleTest} className="w-full">
              <Play className="w-4 h-4 mr-2" />
              Testar
            </Button>
            
            {testResults && (
              <Card className="bg-muted/30">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Texto Normalizado</Label>
                    <code className="block mt-1 text-sm font-mono bg-background p-2 rounded">
                      {testResults.normalized}
                    </code>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground">Regra Aplicada</Label>
                    <div className="mt-1 flex items-center gap-2">
                      {testResults.matchedRule ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-success" />
                          <span className="text-sm font-medium">{testResults.matchedRule.name}</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-warning" />
                          <span className="text-sm text-muted-foreground">
                            Nenhuma regra combinou (fallback)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground">Família Destino</Label>
                    <div className="mt-1">
                      {testResults.matchedFamily ? (
                        <Badge variant="default">
                          {testResults.matchedFamily.name_original}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          Sem família definida
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Confirmation Dialog */}
      <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar Regras de Classificação</AlertDialogTitle>
            <AlertDialogDescription>
              Isso salvará {localEngine.matching_rules.length} regra(s) no catálogo.
              As regras serão usadas na próxima execução da classificação automática.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSave}>
              Salvar Regras
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
