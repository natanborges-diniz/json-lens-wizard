import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { FamilyExtended, Price } from '@/types/lens';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';

interface IntegrityIssues {
  familiesWithoutPrices: FamilyExtended[];
  orphanedPrices: Price[];
  invalidMacros: FamilyExtended[];
  total: number;
}

interface IntegrityExportButtonProps {
  integrityIssues: IntegrityIssues;
}

export const IntegrityExportButton = ({ integrityIssues }: IntegrityExportButtonProps) => {
  const [isExporting, setIsExporting] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    const date = new Date().toISOString().slice(0, 10);

    // Families without prices sheet
    if (integrityIssues.familiesWithoutPrices.length > 0) {
      const familiesData = integrityIssues.familiesWithoutPrices.map(family => ({
        'ID': family.id,
        'Nome': family.name_original,
        'Fornecedor': family.supplier,
        'Categoria': family.category,
        'Macro': family.macro,
        'Status': family.active ? 'Ativo' : 'Inativo',
        'Problema': 'Sem preços cadastrados',
      }));

      const familiesSheet = XLSX.utils.json_to_sheet(familiesData);
      familiesSheet['!cols'] = [
        { wch: 30 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 25 },
      ];
      XLSX.utils.book_append_sheet(workbook, familiesSheet, 'Famílias Sem Preços');
    }

    // Invalid macros sheet
    if (integrityIssues.invalidMacros.length > 0) {
      const invalidData = integrityIssues.invalidMacros.map(family => ({
        'ID': family.id,
        'Nome': family.name_original,
        'Fornecedor': family.supplier,
        'Categoria': family.category,
        'Macro Inválido': family.macro,
        'Status': family.active ? 'Ativo' : 'Inativo',
        'Problema': 'Macro não existe no catálogo',
      }));

      const invalidSheet = XLSX.utils.json_to_sheet(invalidData);
      invalidSheet['!cols'] = [
        { wch: 30 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(workbook, invalidSheet, 'Macros Inválidos');
    }

    // Orphaned prices sheet
    if (integrityIssues.orphanedPrices.length > 0) {
      const orphanedData = integrityIssues.orphanedPrices.map(price => ({
        'Código ERP': price.erp_code,
        'Descrição': price.description,
        'Family ID Órfão': price.family_id,
        'Fornecedor': price.supplier,
        'Índice': price.index,
        'Preço Venda': price.price_sale_half_pair,
        'Ativo': price.active ? 'Sim' : 'Não',
        'Problema': 'Family ID não existe no catálogo',
      }));

      const orphanedSheet = XLSX.utils.json_to_sheet(orphanedData);
      orphanedSheet['!cols'] = [
        { wch: 15 }, { wch: 40 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 8 }, { wch: 35 },
      ];
      XLSX.utils.book_append_sheet(workbook, orphanedSheet, 'Preços Órfãos');
    }

    // Summary sheet
    const summaryData = [
      { 'Tipo de Problema': 'Famílias sem preços', 'Quantidade': integrityIssues.familiesWithoutPrices.length },
      { 'Tipo de Problema': 'Macros inválidos', 'Quantidade': integrityIssues.invalidMacros.length },
      { 'Tipo de Problema': 'Preços órfãos', 'Quantidade': integrityIssues.orphanedPrices.length },
      { 'Tipo de Problema': 'TOTAL', 'Quantidade': integrityIssues.total },
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 25 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');

    const filename = `relatorio-integridade-${date}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success(`Relatório exportado: ${filename}`);
  };

  const exportToPDF = async () => {
    const container = document.createElement('div');
    container.style.padding = '20px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.fontSize = '10px';
    container.style.lineHeight = '1.4';
    container.style.color = '#333';

    const date = new Date();

    // Header
    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px;">
        <h1 style="font-size: 20px; margin: 0; color: #111;">Relatório de Integridade do Catálogo</h1>
        <p style="color: #666; margin: 8px 0 0;">Exportado em ${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR')}</p>
      </div>
    `;

    // Summary section
    container.innerHTML += `
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <h2 style="font-size: 14px; margin: 0 0 12px; color: #374151;">Resumo</h2>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
          <div style="background: ${integrityIssues.familiesWithoutPrices.length > 0 ? '#fef3c7' : '#d1fae5'}; border-radius: 6px; padding: 12px; text-align: center;">
            <p style="font-size: 24px; font-weight: bold; margin: 0; color: ${integrityIssues.familiesWithoutPrices.length > 0 ? '#92400e' : '#065f46'};">${integrityIssues.familiesWithoutPrices.length}</p>
            <p style="font-size: 10px; margin: 4px 0 0; color: #666;">Famílias sem preços</p>
          </div>
          <div style="background: ${integrityIssues.invalidMacros.length > 0 ? '#fee2e2' : '#d1fae5'}; border-radius: 6px; padding: 12px; text-align: center;">
            <p style="font-size: 24px; font-weight: bold; margin: 0; color: ${integrityIssues.invalidMacros.length > 0 ? '#991b1b' : '#065f46'};">${integrityIssues.invalidMacros.length}</p>
            <p style="font-size: 10px; margin: 4px 0 0; color: #666;">Macros inválidos</p>
          </div>
          <div style="background: ${integrityIssues.orphanedPrices.length > 0 ? '#fef3c7' : '#d1fae5'}; border-radius: 6px; padding: 12px; text-align: center;">
            <p style="font-size: 24px; font-weight: bold; margin: 0; color: ${integrityIssues.orphanedPrices.length > 0 ? '#92400e' : '#065f46'};">${integrityIssues.orphanedPrices.length}</p>
            <p style="font-size: 10px; margin: 4px 0 0; color: #666;">Preços órfãos</p>
          </div>
        </div>
      </div>
    `;

    // Families without prices
    if (integrityIssues.familiesWithoutPrices.length > 0) {
      container.innerHTML += `
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 14px; margin: 0 0 12px; color: #92400e; display: flex; align-items: center; gap: 8px;">
            ⚠️ Famílias Ativas Sem Preços (${integrityIssues.familiesWithoutPrices.length})
          </h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Nome</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Fornecedor</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Categoria</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">ID</th>
              </tr>
            </thead>
            <tbody>
              ${integrityIssues.familiesWithoutPrices.map((f, i) => `
                <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9fafb'};">
                  <td style="border: 1px solid #ddd; padding: 8px;">${f.name_original}</td>
                  <td style="border: 1px solid #ddd; padding: 8px;">${f.supplier}</td>
                  <td style="border: 1px solid #ddd; padding: 8px;">${f.category}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; font-family: monospace; font-size: 8px;">${f.id}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Invalid macros
    if (integrityIssues.invalidMacros.length > 0) {
      container.innerHTML += `
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 14px; margin: 0 0 12px; color: #991b1b; display: flex; align-items: center; gap: 8px;">
            ❌ Macros Inválidos (${integrityIssues.invalidMacros.length})
          </h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Nome</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Fornecedor</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Macro Inválido</th>
              </tr>
            </thead>
            <tbody>
              ${integrityIssues.invalidMacros.map((f, i) => `
                <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9fafb'};">
                  <td style="border: 1px solid #ddd; padding: 8px;">${f.name_original}</td>
                  <td style="border: 1px solid #ddd; padding: 8px;">${f.supplier}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; color: #991b1b; font-weight: bold;">${f.macro}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Orphaned prices (show first 50)
    if (integrityIssues.orphanedPrices.length > 0) {
      const displayPrices = integrityIssues.orphanedPrices.slice(0, 50);
      container.innerHTML += `
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 14px; margin: 0 0 12px; color: #92400e; display: flex; align-items: center; gap: 8px;">
            🔗 Preços Órfãos (${integrityIssues.orphanedPrices.length})
          </h2>
          <p style="font-size: 9px; color: #666; margin: 0 0 8px;">SKUs com family_id que não existe no catálogo${integrityIssues.orphanedPrices.length > 50 ? ` (mostrando primeiros 50 de ${integrityIssues.orphanedPrices.length})` : ''}</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Código ERP</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Family ID</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Fornecedor</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Preço</th>
              </tr>
            </thead>
            <tbody>
              ${displayPrices.map((p, i) => `
                <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9fafb'};">
                  <td style="border: 1px solid #ddd; padding: 8px; font-family: monospace;">${p.erp_code}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; font-family: monospace; font-size: 8px;">${p.family_id}</td>
                  <td style="border: 1px solid #ddd; padding: 8px;">${p.supplier}</td>
                  <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatCurrency(p.price_sale_half_pair)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Status footer
    if (integrityIssues.total === 0) {
      container.innerHTML += `
        <div style="background: #d1fae5; border-radius: 8px; padding: 24px; text-align: center;">
          <p style="font-size: 24px; margin: 0;">✅</p>
          <p style="font-size: 14px; font-weight: bold; color: #065f46; margin: 8px 0 0;">Catálogo Íntegro</p>
          <p style="font-size: 10px; color: #666; margin: 4px 0 0;">Nenhum problema encontrado</p>
        </div>
      `;
    }

    const filename = `relatorio-integridade-${date.toISOString().slice(0, 10)}.pdf`;

    const options = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    await html2pdf().set(options).from(container).save();
    toast.success(`Relatório exportado: ${filename}`);
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    setIsExporting(true);
    try {
      if (format === 'excel') {
        exportToExcel();
      } else {
        await exportToPDF();
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar relatório');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Exportar Relatório
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-2">
          <FileSpreadsheet className="w-4 h-4 text-green-600" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2">
          <FileText className="w-4 h-4 text-red-600" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
