/**
 * Audit Logger - Registra decisões de recomendação
 * 
 * Cria logs detalhados para debug e auditoria:
 * - Scores calculados
 * - Motivos de seleção/rejeição
 * - Fallbacks aplicados
 */

import type { 
  RecommendationAuditLog, 
  ScoredFamily, 
  TierRecommendation,
  TierKey,
  RecommendationInput 
} from './types';

// ============================================
// STORAGE
// ============================================

/** Logs em memória (últimos 50) */
const auditLogs: RecommendationAuditLog[] = [];
const MAX_LOGS = 50;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Gera ID único para auditoria
 */
function generateAuditId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Resume dados de prescrição
 */
function summarizePrescription(prescription: any): string {
  const parts: string[] = [];
  
  if (prescription.rightSphere || prescription.leftSphere) {
    const maxSphere = Math.max(
      Math.abs(prescription.rightSphere || 0),
      Math.abs(prescription.leftSphere || 0)
    );
    parts.push(`Esf: ±${maxSphere.toFixed(2)}`);
  }
  
  if (prescription.rightCylinder || prescription.leftCylinder) {
    const maxCyl = Math.max(
      Math.abs(prescription.rightCylinder || 0),
      Math.abs(prescription.leftCylinder || 0)
    );
    parts.push(`Cil: -${maxCyl.toFixed(2)}`);
  }
  
  if (prescription.rightAddition || prescription.leftAddition) {
    const maxAdd = Math.max(
      prescription.rightAddition || 0,
      prescription.leftAddition || 0
    );
    parts.push(`Add: +${maxAdd.toFixed(2)}`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'Não informada';
}

/**
 * Resume dados de anamnese
 */
function summarizeAnamnesis(anamnesis: any): string {
  const parts: string[] = [];
  
  if (anamnesis.primaryUse) {
    parts.push(`Uso: ${anamnesis.primaryUse}`);
  }
  
  if (anamnesis.screenHours) {
    parts.push(`Tela: ${anamnesis.screenHours}h`);
  }
  
  if (anamnesis.visualComplaints?.length > 0) {
    parts.push(`Queixas: ${anamnesis.visualComplaints.length}`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'Básica';
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Cria um log de auditoria completo
 */
export function createAuditLog(
  input: RecommendationInput,
  scoredFamilies: ScoredFamily[],
  tiers: Record<TierKey, TierRecommendation>
): RecommendationAuditLog {
  const auditId = generateAuditId();
  const timestamp = Date.now();
  
  // Resumo do input
  const inputSummary = {
    clinicalType: input.clinicalType,
    prescriptionSummary: summarizePrescription(input.prescription),
    anamnesisSummary: summarizeAnamnesis(input.anamnesis),
    familyCount: input.families.length,
  };
  
  // Decisões para cada família
  const decisions = scoredFamilies
    .slice(0, 20) // Limitar a 20 para não sobrecarregar
    .map(sf => ({
      familyId: sf.family.id,
      familyName: sf.family.name_original,
      tierKey: sf.score.tierKey,
      finalScore: sf.score.final,
      clinicalScore: sf.score.clinical.total,
      commercialScore: sf.score.commercial.total,
      isEligible: sf.score.isEligible,
      reasons: [
        ...sf.score.clinical.reasons.slice(0, 3),
        ...sf.score.commercial.reasons.slice(0, 3),
      ],
    }));
  
  // Fallbacks aplicados
  const fallbacks: Array<{ tierKey: TierKey; reason: string; action: string }> = [];
  const tierOrder: TierKey[] = ['essential', 'comfort', 'advanced', 'top'];
  
  tierOrder.forEach(tierKey => {
    const tier = tiers[tierKey];
    if (tier.isFallback) {
      fallbacks.push({
        tierKey,
        reason: tier.fallbackReason || 'Não especificado',
        action: tier.primary 
          ? `Exibindo ${tier.primary.family.name_original}` 
          : 'Nenhuma opção disponível',
      });
    }
  });
  
  // Resultado final
  const topRecommendation = scoredFamilies
    .filter(sf => sf.score.isEligible)
    .sort((a, b) => b.score.final - a.score.final)[0];
  
  const result = {
    topRecommendationId: topRecommendation?.family.id || null,
    tiersWithData: tierOrder.filter(t => tiers[t].primary !== null),
    tiersWithFallback: tierOrder.filter(t => tiers[t].isFallback),
  };
  
  const log: RecommendationAuditLog = {
    auditId,
    timestamp,
    input: inputSummary,
    decisions,
    fallbacks,
    result,
  };
  
  // Armazenar log
  auditLogs.unshift(log);
  if (auditLogs.length > MAX_LOGS) {
    auditLogs.pop();
  }
  
  // Log no console para debug
  console.log('[RecommendationEngine] Audit Log:', {
    auditId,
    clinicalType: input.clinicalType,
    familiesAnalyzed: input.families.length,
    eligible: scoredFamilies.filter(sf => sf.score.isEligible).length,
    fallbackCount: fallbacks.length,
    topRecommendation: topRecommendation?.family.name_original || 'Nenhuma',
  });
  
  return log;
}

/**
 * Retorna os últimos logs de auditoria
 */
export function getRecentAuditLogs(count: number = 10): RecommendationAuditLog[] {
  return auditLogs.slice(0, count);
}

/**
 * Busca log por ID
 */
export function getAuditLogById(auditId: string): RecommendationAuditLog | null {
  return auditLogs.find(log => log.auditId === auditId) || null;
}

/**
 * Limpa todos os logs (para testes)
 */
export function clearAuditLogs(): void {
  auditLogs.length = 0;
}

/**
 * Exporta logs para análise
 */
export function exportAuditLogs(): string {
  return JSON.stringify(auditLogs, null, 2);
}

/**
 * Log resumido para console (útil durante desenvolvimento)
 */
export function logRecommendationSummary(
  scoredFamilies: ScoredFamily[],
  tiers: Record<TierKey, TierRecommendation>
): void {
  console.group('[RecommendationEngine] Summary');
  
  console.log('📊 Total Analyzed:', scoredFamilies.length);
  console.log('✅ Eligible:', scoredFamilies.filter(sf => sf.score.isEligible).length);
  
  const tierOrder: TierKey[] = ['essential', 'comfort', 'advanced', 'top'];
  tierOrder.forEach(tier => {
    const tierData = tiers[tier];
    const emoji = tierData.isFallback ? '⚠️' : '✓';
    const name = tierData.primary?.family.name_original || 'VAZIO';
    const score = tierData.primary?.score.final.toFixed(1) || '-';
    const price = tierData.primary?.startingPrice 
      ? `R$ ${tierData.primary.startingPrice.toFixed(2)}` 
      : '-';
    
    console.log(`${emoji} ${tier.toUpperCase()}: ${name} (Score: ${score}, ${price})`);
  });
  
  console.groupEnd();
}

export default {
  createAuditLog,
  getRecentAuditLogs,
  getAuditLogById,
  clearAuditLogs,
  exportAuditLogs,
  logRecommendationSummary,
};
