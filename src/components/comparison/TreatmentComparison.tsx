import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { SupplierTreatment } from '@/types/supplier';
import { SUPPORTED_SUPPLIERS } from '@/types/supplier';

interface Props {
  treatments: SupplierTreatment[];
}

const typeLabels: Record<string, string> = {
  ar_coating: 'Antirreflexo',
  blue_filter: 'Filtro Blue Light',
  photochromic: 'Fotossensível',
  polarized: 'Polarizado',
  scratch_resistant: 'Resistência a Riscos',
  easy_clean: 'Fácil Limpeza',
  uv_filter: 'Filtro UV',
};

const typeIcons: Record<string, string> = {
  ar_coating: '✨',
  blue_filter: '🔵',
  photochromic: '🌗',
  polarized: '🕶️',
  scratch_resistant: '💎',
  easy_clean: '💧',
  uv_filter: '☀️',
};

const PerformanceBar = ({ level, label }: { level: number; label: string }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-muted-foreground w-16 truncate">{label}</span>
    <div className="flex gap-0.5 flex-1">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={`h-2.5 flex-1 rounded-sm ${i <= level ? 'bg-primary' : 'bg-muted'}`}
        />
      ))}
    </div>
  </div>
);

const TreatmentComparison = ({ treatments }: Props) => {
  // Group by treatment type
  const types = Array.from(new Set(treatments.map(t => t.treatment_type)));
  const groups = types.map(type => ({
    type,
    treatments: treatments.filter(t => t.treatment_type === type),
  }));

  if (treatments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum tratamento cadastrado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map(({ type, treatments: typeTreatments }) => (
        <div key={type}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">{typeIcons[type] || '🔬'}</span>
            <h2 className="text-lg font-bold">{typeLabels[type] || type}</h2>
            <Badge variant="secondary" className="text-xs">{typeTreatments.length} opções</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SUPPORTED_SUPPLIERS.map(supplier => {
              const supplierTreatments = typeTreatments
                .filter(t => t.supplier_code === supplier.code)
                .sort((a, b) => (a.performance_level || 0) - (b.performance_level || 0));

              if (supplierTreatments.length === 0) {
                return (
                  <Card key={supplier.code} className="border-dashed opacity-50">
                    <CardContent className="py-6 text-center text-xs text-muted-foreground">
                      {supplier.name} — sem opção nesta categoria
                    </CardContent>
                  </Card>
                );
              }

              return (
                <Card key={supplier.code}>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: supplier.color }}>
                      {supplier.name}
                    </span>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {supplierTreatments.map((treatment, idx) => (
                      <div key={treatment.id}>
                        {idx > 0 && <Separator className="mb-3" />}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm">
                              {treatment.display_name || treatment.original_name}
                            </h3>
                            {treatment.performance_level && (
                              <Badge variant="outline" className="text-[10px] font-mono">
                                Nível {treatment.performance_level}
                              </Badge>
                            )}
                          </div>

                          {treatment.key_benefit && (
                            <p className="text-xs text-muted-foreground italic">
                              {treatment.key_benefit}
                            </p>
                          )}

                          {/* Performance metrics */}
                          <div className="space-y-1">
                            {treatment.anti_reflective_level && (
                              <PerformanceBar level={treatment.anti_reflective_level} label="AR" />
                            )}
                            {treatment.scratch_resistance_level && (
                              <PerformanceBar level={treatment.scratch_resistance_level} label="Riscos" />
                            )}
                            {treatment.easy_clean_level && (
                              <PerformanceBar level={treatment.easy_clean_level} label="Limpeza" />
                            )}
                            {treatment.blue_light_filter_percent && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground w-16">Blue %</span>
                                <div className="flex-1 h-2.5 bg-blue-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-500 rounded-full" 
                                    style={{ width: `${treatment.blue_light_filter_percent}%` }} 
                                  />
                                </div>
                                <span className="text-[10px] font-mono">{treatment.blue_light_filter_percent}%</span>
                              </div>
                            )}
                            {treatment.photochromic_darkening_percent && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground w-16">Escurece</span>
                                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-slate-700 rounded-full" 
                                      style={{ width: `${treatment.photochromic_darkening_percent}%` }} 
                                    />
                                  </div>
                                  <span className="text-[10px] font-mono">{treatment.photochromic_darkening_percent}%</span>
                                </div>
                                {treatment.photochromic_speed && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-muted-foreground w-16">Velocidade</span>
                                    <Badge variant="secondary" className="text-[10px] capitalize">
                                      {treatment.photochromic_speed === 'very_fast' ? 'Muito Rápido' :
                                       treatment.photochromic_speed === 'fast' ? 'Rápido' :
                                       treatment.photochromic_speed === 'medium' ? 'Médio' : treatment.photochromic_speed}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TreatmentComparison;
