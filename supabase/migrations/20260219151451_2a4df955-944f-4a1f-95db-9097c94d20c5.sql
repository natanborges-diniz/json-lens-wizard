
-- Seed initial supplier profiles (bypass RLS via migration)
INSERT INTO public.supplier_profiles (supplier_code, display_name, column_mapping, family_dictionary, index_parsing, keywords_photo, is_active)
VALUES
('ESSILOR', 'Essilor', '{
  "codigo": ["Codigo", "COD", "ERP_CODE", "codigo"],
  "descricao": ["DescricaoCadunif", "Descricao", "DESCRICAO", "descricao"],
  "tipo_lente": ["TipoLente", "TIPO_LENTE", "tipo_lente"],
  "esferico_min": ["ESFERICO_MIN", "EsfericoMin", "sph_min", "esf_min"],
  "esferico_max": ["ESFERICO_MAX", "EsfericoMax", "sph_max", "esf_max"],
  "cilindrico_min": ["CILINDRICO_MIN", "CilindricoMin", "cyl_min", "cil_min"],
  "cilindrico_max": ["CILINDRICO_MAX", "CilindricoMax", "cyl_max", "cil_max"],
  "adicao_min": ["ADICAO_MIN", "AdicaoMin", "add_min"],
  "adicao_max": ["ADICAO_MAX", "AdicaoMax", "add_max"],
  "diametro_min": ["DIAMETRO_MIN", "DiametroMin", "diam_min"],
  "diametro_max": ["DIAMETRO_MAX", "DiametroMax", "diam_max"],
  "ativo": ["Ativo", "ATIVO", "ativo", "active"],
  "bloqueado": ["Bloqueado", "BLOQUEADO", "bloqueado", "blocked"],
  "preco": ["PrecoVendaMeioPar", "PRECO", "preco", "price"]
}'::jsonb, '[
  {"contains": ["varilux", "comfort", "max"], "family_id": "essilor-varilux-comfort-max", "priority": 1},
  {"contains": ["varilux", "comfort"], "family_id": "essilor-varilux-comfort", "priority": 5},
  {"contains": ["varilux", "physio", "3.0"], "family_id": "essilor-varilux-physio-3", "priority": 1},
  {"contains": ["varilux", "physio"], "family_id": "essilor-varilux-physio", "priority": 5},
  {"contains": ["varilux", "liberty"], "family_id": "essilor-varilux-liberty", "priority": 5},
  {"contains": ["varilux", "xr"], "family_id": "essilor-varilux-xr-series", "priority": 3},
  {"contains": ["varilux", "x track"], "family_id": "essilor-varilux-x-track", "priority": 3},
  {"contains": ["varilux", "x design"], "family_id": "essilor-varilux-x-design", "priority": 3},
  {"contains": ["eyezen", "start"], "family_id": "essilor-eyezen-start", "priority": 3},
  {"contains": ["eyezen", "kids"], "family_id": "essilor-eyezen-kids", "priority": 1},
  {"contains": ["eyezen"], "family_id": "essilor-eyezen", "priority": 10},
  {"contains": ["stellest"], "family_id": "essilor-stellest", "priority": 1},
  {"contains": ["crizal", "sapphire"], "family_id": "essilor-crizal-sapphire", "priority": 1},
  {"contains": ["crizal", "rock"], "family_id": "essilor-crizal-rock", "priority": 1},
  {"contains": ["crizal", "easy"], "family_id": "essilor-crizal-easy", "priority": 1},
  {"contains": ["transitions", "xtractive"], "family_id": "essilor-transitions-xtractive", "priority": 1},
  {"contains": ["transitions", "signature"], "family_id": "essilor-transitions-signature", "priority": 3},
  {"contains": ["transitions"], "family_id": "essilor-transitions", "priority": 10},
  {"contains": ["kodak", "clean"], "family_id": "essilor-kodak-cleann-view", "priority": 3},
  {"contains": ["kodak", "precise"], "family_id": "essilor-kodak-precise", "priority": 3}
]'::jsonb, '{"regex": "1\\.\\d{2}"}'::jsonb, ARRAY['photo', 'transitions', 'fotossensivel', 'xtractive'], true),

('ZEISS', 'ZEISS', '{
  "codigo": ["Codigo", "COD", "ERP_CODE"],
  "descricao": ["DescricaoCadunif", "Descricao", "DESCRICAO"],
  "esferico_min": ["ESFERICO_MIN"],
  "esferico_max": ["ESFERICO_MAX"],
  "cilindrico_min": ["CILINDRICO_MIN"],
  "cilindrico_max": ["CILINDRICO_MAX"],
  "adicao_min": ["ADICAO_MIN"],
  "adicao_max": ["ADICAO_MAX"],
  "diametro_min": ["DIAMETRO_MIN"],
  "diametro_max": ["DIAMETRO_MAX"],
  "ativo": ["Ativo", "ATIVO"],
  "bloqueado": ["Bloqueado", "BLOQUEADO"],
  "preco": ["PrecoVendaMeioPar", "PRECO"]
}'::jsonb, '[
  {"contains": ["smartlife"], "family_id": "zeiss-smartlife", "priority": 10},
  {"contains": ["precision", "pure"], "family_id": "zeiss-precision-pure", "priority": 3},
  {"contains": ["precision", "plus"], "family_id": "zeiss-precision-plus", "priority": 3},
  {"contains": ["energizeme"], "family_id": "zeiss-energizeme", "priority": 5},
  {"contains": ["photofusion"], "family_id": "zeiss-photofusion", "priority": 5}
]'::jsonb, '{"regex": "1\\.\\d{2}"}'::jsonb, ARRAY['photo', 'photofusion'], true),

('HOYA', 'Hoya', '{
  "codigo": ["Codigo", "COD", "ERP_CODE"],
  "descricao": ["DescricaoCadunif", "Descricao", "DESCRICAO"],
  "esferico_min": ["ESFERICO_MIN"],
  "esferico_max": ["ESFERICO_MAX"],
  "cilindrico_min": ["CILINDRICO_MIN"],
  "cilindrico_max": ["CILINDRICO_MAX"],
  "adicao_min": ["ADICAO_MIN"],
  "adicao_max": ["ADICAO_MAX"],
  "diametro_min": ["DIAMETRO_MIN"],
  "diametro_max": ["DIAMETRO_MAX"],
  "ativo": ["Ativo", "ATIVO"],
  "bloqueado": ["Bloqueado", "BLOQUEADO"],
  "preco": ["PrecoVendaMeioPar", "PRECO"]
}'::jsonb, '[
  {"contains": ["hoyalux", "id"], "family_id": "hoya-hoyalux-id", "priority": 5},
  {"contains": ["sensity"], "family_id": "hoya-sensity", "priority": 5},
  {"contains": ["sync", "iii"], "family_id": "hoya-sync-iii", "priority": 3},
  {"contains": ["nulux", "ep"], "family_id": "hoya-nulux-ep", "priority": 5}
]'::jsonb, '{"regex": "1\\.\\d{2}"}'::jsonb, ARRAY['photo', 'sensity'], true)
ON CONFLICT (supplier_code) DO NOTHING;
