-- Storage RLS: bucket documents (fotos RG no wizard de cadastro/regularização).
-- Sem políticas, upload via supabase.storage.from('documents').upload() falha com RLS.

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "documents_operator_insert" ON storage.objects;
CREATE POLICY "documents_operator_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.is_active_operator()
  );

DROP POLICY IF EXISTS "documents_operator_select" ON storage.objects;
CREATE POLICY "documents_operator_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_active_operator()
  );

DROP POLICY IF EXISTS "documents_public_read" ON storage.objects;
CREATE POLICY "documents_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'documents');
