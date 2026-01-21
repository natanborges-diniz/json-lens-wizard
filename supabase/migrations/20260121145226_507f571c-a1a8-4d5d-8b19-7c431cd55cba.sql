-- Primeiro verificar se o bucket existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('catalogs', 'catalogs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Allow public read access on catalogs" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload catalogs" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update catalogs" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete catalogs" ON storage.objects;

-- Política de leitura pública
CREATE POLICY "Allow public read access on catalogs"
ON storage.objects FOR SELECT
USING (bucket_id = 'catalogs');

-- Política de upload para usuários autenticados
CREATE POLICY "Allow authenticated users to upload catalogs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'catalogs');

-- Política de update para usuários autenticados  
CREATE POLICY "Allow authenticated users to update catalogs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'catalogs');

-- Política de delete para usuários autenticados
CREATE POLICY "Allow authenticated users to delete catalogs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'catalogs');