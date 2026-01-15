import { useState, useRef } from 'react';
import { 
  MessageCircle, 
  Download, 
  Copy, 
  Check, 
  X,
  Loader2,
  ExternalLink
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BudgetDocument, BudgetDocumentData, CompanySettings } from './BudgetDocument';
import html2pdf from 'html2pdf.js';

interface BudgetSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: BudgetDocumentData;
  companySettings: CompanySettings;
  customerPhone?: string;
  onNavigateToManagement?: () => void;
}

export const BudgetSummaryDialog = ({
  open,
  onOpenChange,
  data,
  companySettings,
  customerPhone,
  onNavigateToManagement,
}: BudgetSummaryDialogProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const documentRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleExportPDF = async () => {
    if (!documentRef.current) return;
    
    setIsExporting(true);
    try {
      const element = documentRef.current;
      const opt = {
        margin: 10,
        filename: `orcamento-${data.customerName?.replace(/\s+/g, '-').toLowerCase() || 'cliente'}-${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      };
      
      await html2pdf().set(opt).from(element).save();
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao exportar PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const generateWhatsAppText = () => {
    const paymentLabels: Record<string, string> = {
      'pix': 'PIX',
      'cash': 'Dinheiro',
      'debit': 'Débito',
      'credit_1x': 'Crédito 1x',
      'credit_3x': 'Crédito 3x',
      'credit_6x': 'Crédito 6x',
      'credit_10x': 'Crédito 10x',
      'credit_12x': 'Crédito 12x',
    };

    const techList = data.technologies.length > 0 
      ? `\n✨ *Tecnologias:*\n${data.technologies.map(t => `• ${t.name_common}`).join('\n')}\n`
      : '';

    const treatmentsList = data.selectedTreatments.length > 0
      ? `\n🔬 *Tratamentos:* ${data.selectedTreatments.join(', ')}`
      : '';

    const aiSummary = data.aiDescription 
      ? `\n💡 *Por que esta lente?*\n${data.aiDescription.replace(/\*\*/g, '*').slice(0, 500)}${data.aiDescription.length > 500 ? '...' : ''}\n`
      : '';

    return `👓 *ORÇAMENTO - ${companySettings.company_name.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━━

Olá *${data.customerName || 'Cliente'}*! 👋

Segue seu orçamento personalizado:

📋 *Produto:* ${data.familyName}
🏭 *Fornecedor:* ${data.supplier}
📐 *Índice:* ${data.selectedIndex}
${treatmentsList}
${techList}
${aiSummary}
💰 *Valores:*
${data.secondPairEnabled && data.secondPairPrice > 0 ? `• Lentes: R$ ${formatCurrency(data.basePrice)}\n• 2º Par: R$ ${formatCurrency(data.secondPairPrice)}\n` : ''}${data.totalDiscount > 0 ? `• Desconto: -R$ ${formatCurrency(data.totalDiscount)}\n` : ''}
*TOTAL: R$ ${formatCurrency(data.finalTotal)}*
📅 Pagamento: ${paymentLabels[data.paymentMethod] || data.paymentMethod}

📅 *Orçamento válido por 14 dias*

Ficou com alguma dúvida? Estou à disposição! 😊

━━━━━━━━━━━━━━━━━━━━━
_${companySettings.company_name}_
${companySettings.phone ? `📞 ${companySettings.phone}` : ''}`;
  };

  const handleSendWhatsApp = () => {
    const phone = customerPhone?.replace(/\D/g, '');
    
    if (!phone) {
      // If no phone, just copy text and show message
      const text = generateWhatsAppText();
      navigator.clipboard.writeText(text);
      toast.success('Texto copiado! Cole no WhatsApp manualmente.');
      return;
    }
    
    const text = encodeURIComponent(generateWhatsAppText());
    const whatsappUrl = `https://wa.me/55${phone}?text=${text}`;
    window.open(whatsappUrl, '_blank');
    toast.success('Abrindo WhatsApp...');
  };

  const handleCopyText = () => {
    const text = generateWhatsAppText();
    navigator.clipboard.writeText(text);
    toast.success('Texto copiado para a área de transferência!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-success" />
            Orçamento Finalizado
          </DialogTitle>
        </DialogHeader>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 py-4 border-b shrink-0">
          <Button onClick={handleSendWhatsApp} className="gap-2 bg-green-600 hover:bg-green-700">
            <MessageCircle className="w-4 h-4" />
            Enviar por WhatsApp
          </Button>
          <Button 
            onClick={handleExportPDF} 
            variant="outline" 
            className="gap-2"
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Exportar PDF
          </Button>
          <Button onClick={handleCopyText} variant="outline" className="gap-2">
            <Copy className="w-4 h-4" />
            Copiar Texto
          </Button>
          {onNavigateToManagement && (
            <Button onClick={onNavigateToManagement} variant="ghost" className="gap-2 ml-auto">
              <ExternalLink className="w-4 h-4" />
              Ir para Gerenciamento
            </Button>
          )}
        </div>

        {/* Document Preview */}
        <div className="flex-1 overflow-y-auto bg-gray-100 rounded-lg p-4">
          <BudgetDocument 
            ref={documentRef} 
            data={data} 
            companySettings={companySettings} 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
