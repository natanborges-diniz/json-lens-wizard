import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { FamilyExtended, Price, MacroExtended, Technology } from '@/types/lens';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';

interface FamilyWithPrices extends FamilyExtended {
  prices: Price[];
  priceCount: number;
  activePriceCount: number;
  minPrice: number;
  maxPrice: number;
  indices: string[];
}

interface ExportDialogProps {
  families: FamilyWithPrices[];
  macros: MacroExtended[];
  technologies: Record<string, Technology>;
}

type ExportFormat = 'pdf' | 'excel';
type ExportMode = 'compact' | 'detailed';

const tierDisplayNames: Record<string, string> = {
  'essential': 'Essencial',
  'comfort': 'Conforto',
  'advanced': 'Avançado',
  'top': 'Premium',
};

export const ExportDialog = ({ families, macros, technologies }: ExportDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('excel');
  const [mode, setMode] = useState<ExportMode>('compact');
  const [isExporting, setIsExporting] = useState(false);

  const getMacroInfo = (macroId: string) => {
    const macro = macros.find(m => m.id === macroId);
    return {
      name: macro?.name_client || macroId,
      tier: macro?.tier_key || 'essential',
      tierLabel: tierDisplayNames[macro?.tier_key || 'essential'] || 'Essencial'
    };
  };

  const getTechName = (techId: string) => {
    return technologies[techId]?.name_common || techId;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    if (mode === 'compact') {
      // Compact: One row per family
      const data = families.map(family => {
        const macroInfo = getMacroInfo(family.macro);
        return {
          'ID': family.id,
          'Nome': family.name_original,
          'Fornecedor': family.supplier,
          'Categoria': family.category,
          'Tier': macroInfo.tierLabel,
          'Macro': macroInfo.name,
          'Preço Mín': family.minPrice > 0 ? family.minPrice : '',
          'Preço Máx': family.maxPrice > 0 ? family.maxPrice : '',
          'SKUs Ativos': family.activePriceCount,
          'SKUs Total': family.priceCount,
          'Índices': family.indices.join(', '),
          'Ativo': family.active ? 'Sim' : 'Não',
          'Tecnologias': (family.technology_refs || []).map(t => getTechName(t)).join(', '),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 25 }, // ID
        { wch: 35 }, // Nome
        { wch: 15 }, // Fornecedor
        { wch: 15 }, // Categoria
        { wch: 12 }, // Tier
        { wch: 20 }, // Macro
        { wch: 12 }, // Preço Mín
        { wch: 12 }, // Preço Máx
        { wch: 10 }, // SKUs Ativos
        { wch: 10 }, // SKUs Total
        { wch: 20 }, // Índices
        { wch: 8 },  // Ativo
        { wch: 40 }, // Tecnologias
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Famílias');
    } else {
      // Detailed: Multiple sheets - Families + SKUs
      
      // Families sheet
      const familiesData = families.map(family => {
        const macroInfo = getMacroInfo(family.macro);
        return {
          'ID': family.id,
          'Nome': family.name_original,
          'Fornecedor': family.supplier,
          'Categoria': family.category,
          'Tier': macroInfo.tierLabel,
          'Macro': macroInfo.name,
          'Preço Mín': family.minPrice > 0 ? family.minPrice : '',
          'Preço Máx': family.maxPrice > 0 ? family.maxPrice : '',
          'SKUs Ativos': family.activePriceCount,
          'SKUs Total': family.priceCount,
          'Índices': family.indices.join(', '),
          'Ativo': family.active ? 'Sim' : 'Não',
          'Tecnologias': (family.technology_refs || []).map(t => getTechName(t)).join(', '),
          'Atributos': family.attributes_display_base?.join(', ') || '',
        };
      });

      const familiesSheet = XLSX.utils.json_to_sheet(familiesData);
      familiesSheet['!cols'] = [
        { wch: 25 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
        { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
        { wch: 20 }, { wch: 8 }, { wch: 40 }, { wch: 40 },
      ];
      XLSX.utils.book_append_sheet(workbook, familiesSheet, 'Famílias');

      // SKUs sheet
      const skusData: any[] = [];
      families.forEach(family => {
        family.prices.forEach(price => {
          skusData.push({
            'Família ID': family.id,
            'Família Nome': family.name_original,
            'Código ERP': price.erp_code,
            'Descrição': price.description,
            'Índice': price.index,
            'Preço Compra (Par)': price.price_purchase_half_pair,
            'Preço Venda (Par)': price.price_sale_half_pair,
            'Ativo': price.active ? 'Sim' : 'Não',
            'Bloqueado': price.blocked ? 'Sim' : 'Não',
          });
        });
      });

      if (skusData.length > 0) {
        const skusSheet = XLSX.utils.json_to_sheet(skusData);
        skusSheet['!cols'] = [
          { wch: 25 }, { wch: 35 }, { wch: 20 }, { wch: 40 }, { wch: 10 },
          { wch: 12 }, { wch: 15 }, { wch: 8 }, { wch: 10 },
        ];
        XLSX.utils.book_append_sheet(workbook, skusSheet, 'SKUs');
      }

      // Technologies sheet
      const techsData = families
        .flatMap(f => f.technology_refs || [])
        .filter((v, i, a) => a.indexOf(v) === i)
        .map(techId => {
          const tech = technologies[techId];
          return {
            'ID': techId,
            'Nome': tech?.name_common || techId,
            'Descrição Curta': tech?.description_short || '',
            'Descrição Longa': tech?.description_long || '',
            'Usado em Famílias': families.filter(f => f.technology_refs?.includes(techId)).length,
          };
        });

      if (techsData.length > 0) {
        const techsSheet = XLSX.utils.json_to_sheet(techsData);
        techsSheet['!cols'] = [
          { wch: 25 }, { wch: 30 }, { wch: 40 }, { wch: 60 }, { wch: 15 },
        ];
        XLSX.utils.book_append_sheet(workbook, techsSheet, 'Tecnologias');
      }
    }

    // Generate filename with date
    const date = new Date().toISOString().slice(0, 10);
    const filename = `catalogo-lentes-${mode === 'compact' ? 'compacto' : 'detalhado'}-${date}.xlsx`;
    
    XLSX.writeFile(workbook, filename);
    toast.success(`Arquivo ${filename} exportado com sucesso!`);
  };

  const exportToPDF = async () => {
    // Create HTML content for PDF
    const container = document.createElement('div');
    container.style.padding = '20px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.fontSize = '10px';
    container.style.lineHeight = '1.4';

    // Header
    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-size: 18px; margin: 0;">Catálogo de Lentes</h1>
        <p style="color: #666; margin: 5px 0;">Exportado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        <p style="color: #666; margin: 5px 0;">${families.length} famílias ${mode === 'compact' ? '(Compacto)' : '(Detalhado)'}</p>
      </div>
    `;

    if (mode === 'compact') {
      // Compact table
      let tableHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Nome</th>
              <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Fornecedor</th>
              <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Categoria</th>
              <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Tier</th>
              <th style="border: 1px solid #ddd; padding: 6px; text-align: right;">Preço Mín</th>
              <th style="border: 1px solid #ddd; padding: 6px; text-align: right;">Preço Máx</th>
              <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">SKUs</th>
              <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">Ativo</th>
            </tr>
          </thead>
          <tbody>
      `;

      families.forEach((family, index) => {
        const macroInfo = getMacroInfo(family.macro);
        const bgColor = index % 2 === 0 ? '#fff' : '#f9fafb';
        tableHtml += `
          <tr style="background: ${bgColor};">
            <td style="border: 1px solid #ddd; padding: 6px;">${family.name_original}</td>
            <td style="border: 1px solid #ddd; padding: 6px;">${family.supplier}</td>
            <td style="border: 1px solid #ddd; padding: 6px;">${family.category}</td>
            <td style="border: 1px solid #ddd; padding: 6px;">${macroInfo.tierLabel}</td>
            <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">${family.minPrice > 0 ? formatCurrency(family.minPrice) : '-'}</td>
            <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">${family.maxPrice > 0 ? formatCurrency(family.maxPrice) : '-'}</td>
            <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${family.activePriceCount}/${family.priceCount}</td>
            <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${family.active ? '✓' : '✗'}</td>
          </tr>
        `;
      });

      tableHtml += '</tbody></table>';
      container.innerHTML += tableHtml;
    } else {
      // Detailed view - each family as a card
      families.forEach((family, index) => {
        const macroInfo = getMacroInfo(family.macro);
        const techs = (family.technology_refs || []).map(t => getTechName(t)).join(', ');
        const attrs = family.attributes_display_base?.join(', ') || '';

        let familyHtml = `
          <div style="border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-bottom: 16px; page-break-inside: avoid;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
              <div>
                <h3 style="font-size: 12px; margin: 0; font-weight: bold;">${family.name_original}</h3>
                <p style="font-size: 9px; color: #666; margin: 2px 0; font-family: monospace;">${family.id}</p>
              </div>
              <div style="text-align: right;">
                <span style="background: ${family.active ? '#dcfce7' : '#fee2e2'}; color: ${family.active ? '#166534' : '#991b1b'}; padding: 2px 8px; border-radius: 4px; font-size: 9px;">
                  ${family.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px;">
              <div>
                <p style="color: #666; font-size: 8px; margin: 0;">Fornecedor</p>
                <p style="font-weight: 500; margin: 0;">${family.supplier}</p>
              </div>
              <div>
                <p style="color: #666; font-size: 8px; margin: 0;">Categoria</p>
                <p style="font-weight: 500; margin: 0;">${family.category}</p>
              </div>
              <div>
                <p style="color: #666; font-size: 8px; margin: 0;">Tier</p>
                <p style="font-weight: 500; margin: 0;">${macroInfo.tierLabel}</p>
              </div>
              <div>
                <p style="color: #666; font-size: 8px; margin: 0;">Preço</p>
                <p style="font-weight: 500; margin: 0;">${family.minPrice > 0 ? formatCurrency(family.minPrice) : '-'}${family.maxPrice > family.minPrice ? ` - ${formatCurrency(family.maxPrice)}` : ''}</p>
              </div>
            </div>
            
            ${techs ? `<p style="font-size: 9px; margin: 4px 0;"><strong>Tecnologias:</strong> ${techs}</p>` : ''}
            ${attrs ? `<p style="font-size: 9px; margin: 4px 0;"><strong>Atributos:</strong> ${attrs}</p>` : ''}
        `;

        // Add SKUs table if has prices
        if (family.prices.length > 0) {
          familyHtml += `
            <div style="margin-top: 8px;">
              <p style="font-size: 9px; font-weight: bold; margin: 4px 0;">SKUs (${family.prices.length}):</p>
              <table style="width: 100%; border-collapse: collapse; font-size: 8px;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="border: 1px solid #ddd; padding: 4px; text-align: left;">Código</th>
                    <th style="border: 1px solid #ddd; padding: 4px; text-align: left;">Descrição</th>
                    <th style="border: 1px solid #ddd; padding: 4px; text-align: center;">Índice</th>
                    <th style="border: 1px solid #ddd; padding: 4px; text-align: right;">Preço</th>
                    <th style="border: 1px solid #ddd; padding: 4px; text-align: center;">Ativo</th>
                  </tr>
                </thead>
                <tbody>
          `;

          family.prices.forEach((price, pi) => {
            const bgColor = pi % 2 === 0 ? '#fff' : '#f9fafb';
            familyHtml += `
              <tr style="background: ${bgColor};">
                <td style="border: 1px solid #ddd; padding: 4px; font-family: monospace;">${price.erp_code}</td>
                <td style="border: 1px solid #ddd; padding: 4px;">${price.description}</td>
                <td style="border: 1px solid #ddd; padding: 4px; text-align: center;">${price.index}</td>
                <td style="border: 1px solid #ddd; padding: 4px; text-align: right;">${formatCurrency(price.price_sale_half_pair)}</td>
                <td style="border: 1px solid #ddd; padding: 4px; text-align: center;">${price.active && !price.blocked ? '✓' : '✗'}</td>
              </tr>
            `;
          });

          familyHtml += '</tbody></table></div>';
        }

        familyHtml += '</div>';
        container.innerHTML += familyHtml;
      });
    }

    // Generate PDF
    const date = new Date().toISOString().slice(0, 10);
    const filename = `catalogo-lentes-${mode === 'compact' ? 'compacto' : 'detalhado'}-${date}.pdf`;

    const options = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: mode === 'compact' ? 'landscape' : 'portrait' }
    };

    await html2pdf().set(options).from(container).save();
    toast.success(`Arquivo ${filename} exportado com sucesso!`);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (format === 'excel') {
        exportToExcel();
      } else {
        await exportToPDF();
      }
      setIsOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar arquivo');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Exportar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Catálogo</DialogTitle>
          <DialogDescription>
            Exportar {families.length} famílias filtradas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Formato</Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as ExportFormat)}
              className="grid grid-cols-2 gap-3"
            >
              <div className="flex items-center space-x-2 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="excel" id="excel" />
                <Label htmlFor="excel" className="flex items-center gap-2 cursor-pointer flex-1">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium">Excel</p>
                    <p className="text-xs text-muted-foreground">.xlsx</p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="flex items-center gap-2 cursor-pointer flex-1">
                  <FileText className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="font-medium">PDF</p>
                    <p className="text-xs text-muted-foreground">.pdf</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Mode Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Modo de Exportação</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as ExportMode)}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="compact" id="compact" className="mt-1" />
                <Label htmlFor="compact" className="cursor-pointer flex-1">
                  <p className="font-medium">Compacto</p>
                  <p className="text-xs text-muted-foreground">
                    Uma linha por família. Ideal para visão geral rápida.
                  </p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="detailed" id="detailed" className="mt-1" />
                <Label htmlFor="detailed" className="cursor-pointer flex-1">
                  <p className="font-medium">Detalhado</p>
                  <p className="text-xs text-muted-foreground">
                    Inclui todos os SKUs, tecnologias e atributos de cada família.
                    {format === 'excel' && ' Gera múltiplas abas.'}
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
