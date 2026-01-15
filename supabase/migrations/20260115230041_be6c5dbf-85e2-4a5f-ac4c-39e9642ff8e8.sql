-- Criar bucket para catálogos de lentes
INSERT INTO storage.buckets (id, name, public)
VALUES ('catalogs', 'catalogs', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: usuários autenticados podem ler catálogos
CREATE POLICY "Authenticated users can read catalogs"
ON storage.objects FOR SELECT
USING (bucket_id = 'catalogs' AND auth.role() = 'authenticated');

-- Policy: usuários autenticados podem fazer upload de catálogos
CREATE POLICY "Authenticated users can upload catalogs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'catalogs' AND auth.role() = 'authenticated');

-- Policy: usuários autenticados podem atualizar catálogos
CREATE POLICY "Authenticated users can update catalogs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'catalogs' AND auth.role() = 'authenticated');

-- Policy: usuários autenticados podem deletar catálogos
CREATE POLICY "Authenticated users can delete catalogs"
ON storage.objects FOR DELETE
USING (bucket_id = 'catalogs' AND auth.role() = 'authenticated');