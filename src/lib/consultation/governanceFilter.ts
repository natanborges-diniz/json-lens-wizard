/**
 * Governance Filter
 * 
 * Filters out unreviewed/rejected data from the recommendation pipeline.
 * Only data with sufficient confidence and review status can feed
 * the commercial recommendation engine.
 */

type DataConfidence = 'explicit' | 'inferred' | 'manual' | 'ai_extracted';
type ReviewStatus = 'draft' | 'reviewed' | 'approved' | 'rejected';

export interface GovernanceRecord {
  id: string;
  confidence: DataConfidence;
  review_status: ReviewStatus;
  active: boolean;
}

export interface GovernanceFilterResult<T extends GovernanceRecord> {
  eligible: T[];
  blocked: Array<{ record: T; reason: string }>;
  stats: {
    total: number;
    eligible: number;
    blocked: number;
    byReason: Record<string, number>;
  };
}

/**
 * Filter records based on governance rules.
 * 
 * Rules:
 * - rejected → always blocked
 * - inactive → always blocked
 * - draft + inferred/ai_extracted → blocked (unreliable provenance + unreviewed)
 * - draft + explicit/manual → allowed with caution (operator-entered, pending review)
 * - reviewed/approved → allowed
 */
export function applyGovernanceFilter<T extends GovernanceRecord>(
  records: T[],
  mode: 'strict' | 'permissive' = 'permissive'
): GovernanceFilterResult<T> {
  const eligible: T[] = [];
  const blocked: Array<{ record: T; reason: string }> = [];
  const byReason: Record<string, number> = {};

  const addBlocked = (record: T, reason: string) => {
    blocked.push({ record, reason });
    byReason[reason] = (byReason[reason] || 0) + 1;
  };

  for (const record of records) {
    // Inactive is always blocked
    if (!record.active) {
      addBlocked(record, 'inactive');
      continue;
    }

    // Rejected is always blocked
    if (record.review_status === 'rejected') {
      addBlocked(record, 'rejected');
      continue;
    }

    // Draft handling
    if (record.review_status === 'draft') {
      if (mode === 'strict') {
        addBlocked(record, 'draft_strict_mode');
        continue;
      }
      // Permissive: block only inferred/ai_extracted drafts
      if (record.confidence === 'inferred' || record.confidence === 'ai_extracted') {
        addBlocked(record, 'draft_low_confidence');
        continue;
      }
    }

    eligible.push(record);
  }

  return {
    eligible,
    blocked,
    stats: {
      total: records.length,
      eligible: eligible.length,
      blocked: blocked.length,
      byReason,
    },
  };
}

/**
 * Quick check: is a single record eligible for recommendations?
 */
export function isEligibleForRecommendation(
  record: GovernanceRecord,
  mode: 'strict' | 'permissive' = 'permissive'
): boolean {
  if (!record.active) return false;
  if (record.review_status === 'rejected') return false;
  if (record.review_status === 'draft') {
    if (mode === 'strict') return false;
    if (record.confidence === 'inferred' || record.confidence === 'ai_extracted') return false;
  }
  return true;
}
