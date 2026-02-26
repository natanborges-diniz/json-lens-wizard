import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { AnamnesisData, Prescription, FrameMeasurements, ClinicalType } from '@/types/lens';

export interface DraftData {
  serviceId: string;
  customerId: string;
  customerName: string;
  storeId: string | null;
  anamnesisData: AnamnesisData;
  prescriptionData: Partial<Prescription>;
  frameData: Partial<FrameMeasurements>;
  lensCategory: ClinicalType;
  currentStep?: string;
}

interface UseDraftPersistenceOptions {
  storeId: string | null;
}

export const useDraftPersistence = ({ storeId }: UseDraftPersistenceOptions) => {
  const { user } = useAuth();
  const [existingDraft, setExistingDraft] = useState<DraftData | null>(null);
  const [isCheckingDraft, setIsCheckingDraft] = useState(true);

  // Use refs for IDs to avoid stale closures in debounced callbacks
  const draftServiceIdRef = useRef<string | null>(null);
  const draftCustomerIdRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  // Expose IDs as state too (for consumers that need reactivity)
  const [draftServiceId, setDraftServiceId] = useState<string | null>(null);
  const [draftCustomerId, setDraftCustomerId] = useState<string | null>(null);

  const setIds = useCallback((serviceId: string | null, customerId: string | null) => {
    draftServiceIdRef.current = serviceId;
    draftCustomerIdRef.current = customerId;
    setDraftServiceId(serviceId);
    setDraftCustomerId(customerId);
  }, []);

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
          .select('id, customer_id, anamnesis_data, prescription_data, frame_data, lens_category, notes, customers!services_customer_id_fkey(name)')
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
          // Parse step from notes if stored
          let currentStep: string | undefined;
          try {
            const notesObj = data.notes ? JSON.parse(data.notes) : null;
            currentStep = notesObj?.currentStep;
          } catch { /* ignore */ }

          const draft: DraftData = {
            serviceId: data.id,
            customerId: data.customer_id,
            customerName: customerData?.name || 'Cliente',
            storeId: null,
            anamnesisData: (data.anamnesis_data as any) || null,
            prescriptionData: (data.prescription_data as any) || {},
            frameData: (data.frame_data as any) || {},
            lensCategory: (data.lens_category as ClinicalType) || 'PROGRESSIVA',
            currentStep,
          };
          setExistingDraft(draft);
          // Pre-load IDs so that if user resumes, we already have them
          setIds(data.id, data.customer_id);
        }
      } catch (err) {
        console.error('[DraftPersistence] Unexpected error:', err);
      } finally {
        setIsCheckingDraft(false);
      }
    };

    checkDraft();
  }, [user, setIds]);

  // Resume an existing draft — returns data for hydration
  const resumeDraft = useCallback((): DraftData | null => {
    if (!existingDraft) return null;
    setIds(existingDraft.serviceId, existingDraft.customerId);
    return existingDraft;
  }, [existingDraft, setIds]);

  // Discard (soft-delete) the existing draft
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
    setIds(null, null);
  }, [existingDraft, setIds]);

  // Save draft — debounced, creates or updates, prevents duplicates
  const saveDraft = useCallback(async (
    customerName: string,
    anamnesisData: AnamnesisData,
    prescriptionData: Partial<Prescription>,
    frameData: Partial<FrameMeasurements>,
    lensCategory: ClinicalType,
    currentStep?: string,
  ) => {
    if (!user) return;

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      // Prevent concurrent saves
      if (isSavingRef.current) return;
      isSavingRef.current = true;

      try {
        let customerId = draftCustomerIdRef.current;
        let serviceId = draftServiceIdRef.current;

        // Create customer if needed
        if (!customerId) {
          const { data: customer, error: custError } = await supabase
            .from('customers')
            .insert({ name: customerName || 'Cliente', created_by: user.id })
            .select('id')
            .single();
          if (custError) throw custError;
          customerId = customer.id;
          setIds(serviceId, customerId);
        } else {
          // Update customer name if changed
          await supabase
            .from('customers')
            .update({ name: customerName || 'Cliente' })
            .eq('id', customerId);
        }

        const notesObj = currentStep ? JSON.stringify({ currentStep }) : null;

        const servicePayload = {
          customer_id: customerId,
          seller_id: user.id,
          status: 'draft' as any,
          anamnesis_data: JSON.parse(JSON.stringify(anamnesisData)),
          prescription_data: JSON.parse(JSON.stringify(prescriptionData)),
          frame_data: JSON.parse(JSON.stringify(frameData)),
          lens_category: lensCategory,
          notes: notesObj,
        };

        if (!serviceId) {
          // Before creating, double-check no other draft exists for this seller
          const { data: existingCheck } = await supabase
            .from('services')
            .select('id')
            .eq('seller_id', user.id)
            .eq('status', 'draft' as any)
            .limit(1)
            .maybeSingle();

          if (existingCheck) {
            // Reuse existing draft instead of creating duplicate
            serviceId = existingCheck.id;
            setIds(serviceId, customerId);
            const { error } = await supabase
              .from('services')
              .update(servicePayload)
              .eq('id', serviceId);
            if (error) throw error;
            console.log('[DraftPersistence] Reused existing draft:', serviceId);
          } else {
            const { data: service, error } = await supabase
              .from('services')
              .insert([servicePayload])
              .select('id')
              .single();
            if (error) throw error;
            serviceId = service.id;
            setIds(serviceId, customerId);
            console.log('[DraftPersistence] Draft created:', serviceId);
          }
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
      } finally {
        isSavingRef.current = false;
      }
    }, 1500);
  }, [user, setIds]);

  // Promote draft to in_progress (when finalizing budget)
  const promoteDraft = useCallback(async () => {
    const serviceId = draftServiceIdRef.current;
    const customerId = draftCustomerIdRef.current;
    if (!serviceId) return { serviceId: null, customerId: null };
    try {
      // Flush any pending save first
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      await supabase
        .from('services')
        .update({ status: 'in_progress' as any })
        .eq('id', serviceId);
      return { serviceId, customerId };
    } catch (err) {
      console.error('[DraftPersistence] Promote error:', err);
      return { serviceId, customerId };
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

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
