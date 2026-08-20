-- Ponto do cliente no mapa de atendimento.
--
-- Coordenada de município, não de porta: a tela responde "onde
-- estamos atendendo", e endereço exato de titular de benefício é dado
-- pessoal que não precisa sair do cadastro para desenhar um pin.

ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- PostgREST/Supabase só enxerga colunas novas depois de recarregar o cache.
NOTIFY pgrst, 'reload schema';
