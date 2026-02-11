import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { AnamnesisData, Prescription, FrameMeasurements, ClinicalType } from '@/types/lens';

interface DraftData {
  serviceId: string;
  customerId: string;
  customerName: string;
  storeId: string | null;
  anamnesisData: AnamnesisData;
  prescriptionData: Partial<Prescription>;
  frameData: Partial<FrameMeasurements>;
  lensCategory: ClinicalType;
}

interface UseDraftPersistenceOptions {
  storeId: string | null;
}

export const useDraftPersistence = ({ storeId }: UseDraftPersistenceOptions) => {
  const { user } = useAuth();
  const [existingDraft, setExistingDraft] = useState<DraftData | null>(null);
  const [draftServiceId, setDraftServiceId] = useState<string | null>(null);
  const [draftCustomerId, setDraftCustomerId] = useState<string | null>(null);
  const [isCheckingDraft, setIsCheckingDraft] = useState(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for existing draft on mount
  useEffect(() => {
    if (!user) {
      setIsCheckingDraft(false);
      return;
    }

    const checkDraft = async () => {
      try {
        const { data, error } = await supabase
          .from('services')
          .select('id, customer_id, anamnesis_data, prescription_data, frame_data, lens_category, customers!services_customer_id_fkey(name)')
          .eq('seller_id', user.id)
          .eq('status', 'draft' as any)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.warn('[DraftPersistence] Error checking draft:', error.message);
          setIsCheckingDraft(false);
          return;
        }

        if (data) {
          const customerData = data.customers as any;
          setExistingDraft({
            serviceId: data.id,
            customerId: data.customer_id,
            customerName: customerData?.name || 'Cliente',
            storeId: null,
            anamnesisData: (data.anamnesis_data as any) || null,
            prescriptionData: (data.prescription_data as any) || {},
            frameData: (data.frame_data as any) || {},
            lensCategory: (data.lens_category as ClinicalType) || 'PROGRESSIVA',
          });
        }
      } catch (err) {
        console.error('[DraftPersistence] Unexpected error:', err);
      } finally {
        setIsCheckingDraft(false);
      }
    };

    checkDraft();
  }, [user]);

  // Resume an existing draft
  const resumeDraft = useCallback(() => {
    if (!existingDraft) return null;
    setDraftServiceId(existingDraft.serviceId);
    setDraftCustomerId(existingDraft.customerId);
    return existingDraft;
  }, [existingDraft]);

  // Discard (delete) the existing draft
  const discardDraft = useCallback(async () => {
    if (!existingDraft) return;
    try {
      await supabase
        .from('services')
        .update({ status: 'lost' as any })
        .eq('id', existingDraft.serviceId);
    } catch (err) {
      console.warn('[DraftPersistence] Error discarding draft:', err);
    }
    setExistingDraft(null);
  }, [existingDraft]);

  // Save draft (debounced) - creates or updates service + customer
  const saveDraft = useCallback(async (
    customerName: string,
    anamnesisData: AnamnesisData,
    prescriptionData: Partial<Prescription>,
    frameData: Partial<FrameMeasurements>,
    lensCategory: ClinicalType,
  ) => {
    if (!user) return;

    // Debounce: clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        let customerId = draftCustomerId;
        let serviceId = draftServiceId;

        // Create customer if needed
        if (!customerId) {
          const { data: customer, error: custError } = await supabase
            .from('customers')
            .insert({ name: customerName || 'Cliente', created_by: user.id })
            .select('id')
            .single();
          if (custError) throw custError;
          customerId = customer.id;
          setDraftCustomerId(customerId);
        } else {
          // Update customer name
          await supabase
            .from('customers')
            .update({ name: customerName || 'Cliente' })
            .eq('id', customerId);
        }

        const servicePayload = {
          customer_id: customerId,
          seller_id: user.id,
          status: 'draft' as any,
          anamnesis_data: JSON.parse(JSON.stringify(anamnesisData)),
          prescription_data: JSON.parse(JSON.stringify(prescriptionData)),
          frame_data: JSON.parse(JSON.stringify(frameData)),
          lens_category: lensCategory,
        };

        if (!serviceId) {
          // Create new draft
          const { data: service, error } = await supabase
            .from('services')
            .insert([servicePayload])
            .select('id')
            .single();
          if (error) throw error;
          serviceId = service.id;
          setDraftServiceId(serviceId);
          console.log('[DraftPersistence] Draft created:', serviceId);
        } else {
          // Update existing draft
          const { error } = await supabase
            .from('services')
            .update(servicePayload)
            .eq('id', serviceId);
          if (error) throw error;
          console.log('[DraftPersistence] Draft updated:', serviceId);
        }
      } catch (err) {
        console.error('[DraftPersistence] Save error:', err);
      }
    }, 1500); // 1.5s debounce
  }, [user, draftServiceId, draftCustomerId]);

  // Promote draft to in_progress (when finalizing budget)
  const promoteDraft = useCallback(async () => {
    if (!draftServiceId) return { serviceId: null, customerId: null };
    try {
      await supabase
        .from('services')
        .update({ status: 'in_progress' as any })
        .eq('id', draftServiceId);
      return { serviceId: draftServiceId, customerId: draftCustomerId };
    } catch (err) {
      console.error('[DraftPersistence] Promote error:', err);
      return { serviceId: draftServiceId, customerId: draftCustomerId };
    }
  }, [draftServiceId, draftCustomerId]);

  return {
    existingDraft,
    isCheckingDraft,
    draftServiceId,
    draftCustomerId,
    resumeDraft,
    discardDraft,
    saveDraft,
    promoteDraft,
  };
};
