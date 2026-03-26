import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { SupplierMaterial } from '@/types/supplier';
import { SUPPORTED_SUPPLIERS } from '@/types/supplier';

interface Props {
  materials: SupplierMaterial[];
}

const indexGroups = [1.50, 1.53, 1.56, 1.59, 1.60, 1.67, 1.74];

const ThicknessBar = ({ percent }: { percent: number }) => (
  <div className="flex items-center gap-2">
    <div className="w-20 h-3 bg-muted rounded-full overflow-hidden">
      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
    <span className="text-xs font-mono">{percent}%</span>
  </div>
);

const AestheticDots = ({ score }: { score: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <div
        key={i}
        className={`w-2.5 h-2.5 rounded-full ${i <= score ? 'bg-primary' : 'bg-muted'}`}
      />
    ))}
  </div>
);

const MaterialComparison = ({ materials }: Props) => {
  // Group by refractive index
  const groups = indexGroups.map(idx => ({
    index: idx,
    materials: materials.filter(m => m.refractive_index === idx),
  })).filter(g => g.materials.length > 0);

  if (materials.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum material cadastrado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Visual thickness comparison */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Comparativo de Espessura por Índice</CardTitle>
          <p className="text-xs text-muted-foreground">Redução de espessura em relação ao índice 1.50 base</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {groups.map(({ index, materials: mats }) => (
              <div key={index} className="flex items-center gap-4">
                <Badge variant="outline" className="font-mono w-12 justify-center">{index.toFixed(2)}</Badge>
                <div className="flex-1 grid grid-cols-3 gap-4">
                  {SUPPORTED_SUPPLIERS.map(supplier => {
                    const mat = mats.find(m => m.supplier_code === supplier.code);
                    return (
                      <div key={supplier.code} className="flex items-center gap-2">
                        <span className="text-[10px] w-14 truncate" style={{ color: supplier.color }}>
                          {supplier.name}
                        </span>
                        {mat ? (
                          <div className="flex-1 flex items-center gap-2">
                            {/* Thickness visualization - thicker bar = thicker lens */}
                            <div className="flex-1 relative h-4">
                              <div 
                                className="absolute inset-y-0 left-0 bg-primary/20 rounded"
                                style={{ width: `${100 - (mat.thickness_reduction_percent || 0)}%` }}
                              />
                              <div 
                                className="absolute inset-y-0 left-0 bg-primary rounded"
                                style={{ width: `${100 - (mat.thickness_reduction_percent || 0)}%`, opacity: 0.6 }}
                              />
                            </div>
                            <span className="text-[10px] font-mono w-10 text-right">
                              {mat.thickness_reduction_percent ? `-${mat.thickness_reduction_percent}%` : '—'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalhamento Técnico</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Índice</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Abbe</TableHead>
                <TableHead>UV</TableHead>
                <TableHead>Impacto</TableHead>
                <TableHead>Estética</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map(({ index, materials: mats }) => (
                mats.map((mat, i) => {
                  const supplier = SUPPORTED_SUPPLIERS.find(s => s.code === mat.supplier_code);
                  return (
                    <TableRow key={mat.id}>
                      {i === 0 && (
                        <TableCell rowSpan={mats.length} className="font-mono font-bold text-center align-middle">
                          {index.toFixed(2)}
                        </TableCell>
                      )}
                      <TableCell>
                        <span className="text-xs font-semibold" style={{ color: supplier?.color }}>
                          {supplier?.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{mat.original_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{mat.material_type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{mat.abbe_number || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{mat.uv_protection_percent ? `${mat.uv_protection_percent}%` : '—'}</TableCell>
                      <TableCell className="text-xs capitalize">{mat.impact_resistance || '—'}</TableCell>
                      <TableCell><AestheticDots score={mat.aesthetic_score || 0} /></TableCell>
                    </TableRow>
                  );
                })
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MaterialComparison;
