
-- Add noise_tokens and abbreviation_map columns to supplier_profiles
ALTER TABLE public.supplier_profiles
  ADD COLUMN IF NOT EXISTS noise_tokens text[] DEFAULT ARRAY['BLUE','UV','CZ','CVP','AR','INC','CLE','FOTO','TRIO','EASY','ROCK','SAPPHIRE','OPTIFOG','PREV','TRANS','EXT','EAYS','PHOTO'],
  ADD COLUMN IF NOT EXISTS abbreviation_map jsonb DEFAULT '{"LIBE":"liberty","PHY":"physio","EXTE":"extensee","DMAX":"dmax","GEN":"gen","OC":"ocupacional","XR":"xr series","EXTEN":"extensee"}'::jsonb;

-- Seed ESSILOR with specific tokens and abbreviation_map
UPDATE public.supplier_profiles
SET
  noise_tokens = ARRAY['BLUE','UV','CZ','CVP','AR','INC','CLE','FOTO','TRIO','EASY','ROCK','SAPPHIRE','OPTIFOG','PREV','TRANS','EXT','EAYS','PHOTO','INC'],
  abbreviation_map = '{"LIBE":"liberty","PHY":"physio","EXTE":"extensee","EXTEN":"extensee","DMAX":"dmax","GEN":"gen","OC":"ocupacional","XR":"xr","VAR":"varilux","COMFORT":"comfort","MAX":"max","TRACK":"track","NEAR":"near","MID":"mid"}'::jsonb
WHERE supplier_code = 'ESSILOR';
