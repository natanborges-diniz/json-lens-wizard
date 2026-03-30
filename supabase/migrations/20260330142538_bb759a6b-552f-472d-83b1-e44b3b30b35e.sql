
-- Passo 1: Remover os 3 registros de teste incompatíveis (family_id em formato string descritivo)
DELETE FROM public.supplier_final_prices 
WHERE source = 'seed-test';

-- Passo 2: Remover constraint única antiga (erp_code-based, inutilizável)
ALTER TABLE public.supplier_final_prices 
DROP CONSTRAINT IF EXISTS supplier_final_prices_supplier_code_erp_code_key;

-- Passo 3: Migrar 66 registros ativos de supplier_prices → supplier_final_prices
-- Usa DISTINCT ON para resolver 2 duplicatas (mantém maior preço)
-- family_id permanece como UUID string (cast de uuid para text), compatível com supplier_families
INSERT INTO public.supplier_final_prices (
  supplier_code, family_id, material_index, lens_state, 
  price_value, treatment_combo, confidence, source, active
)
SELECT DISTINCT ON (sp.supplier_code, sp.family_id::text, sp.material_index, sp.lens_state)
  sp.supplier_code,
  sp.family_id::text,
  sp.material_index,
  sp.lens_state,
  sp.price_value,
  COALESCE(sp.treatment_combo, '{}'::text[]),
  sp.confidence::text,
  'legacy-migration',
  sp.active
FROM public.supplier_prices sp
WHERE sp.active = true
ORDER BY sp.supplier_code, sp.family_id::text, sp.material_index, sp.lens_state, sp.price_value DESC;

-- Passo 4: Criar nova constraint única com chave natural
ALTER TABLE public.supplier_final_prices 
ADD CONSTRAINT supplier_final_prices_natural_key 
UNIQUE (supplier_code, family_id, material_index, lens_state);
