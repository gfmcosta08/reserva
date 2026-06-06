-- Execute no SQL Editor do projeto TESTE após copiar dados + storage.
-- Ajuste os dois refs se necessário.

-- Ref produção (confirmado no deploy e .env.local)
-- mxlgkpfiugbodocyleij (prod) → ajyvznrmbuistlcfckuh (teste)
UPDATE public.persons
SET
  rg_front_url = replace(rg_front_url, 'mxlgkpfiugbodocyleij', 'ajyvznrmbuistlcfckuh'),
  rg_back_url  = replace(rg_back_url,  'mxlgkpfiugbodocyleij', 'ajyvznrmbuistlcfckuh')
WHERE rg_front_url IS NOT NULL OR rg_back_url IS NOT NULL;
