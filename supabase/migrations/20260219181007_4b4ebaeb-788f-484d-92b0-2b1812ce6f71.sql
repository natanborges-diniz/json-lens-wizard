-- Adiciona unique constraint para permitir upsert no dialog de resolução
ALTER TABLE public.catalog_pending_skus 
ADD CONSTRAINT catalog_pending_skus_erp_code_sync_run_id_key 
UNIQUE (erp_code, sync_run_id);