-- Leitura da intimação por IA.
--
-- Guardada junto da comunicação porque é derivada dela: reprocessar
-- custa uma chamada de modelo, e a tela precisa do resultado a cada
-- abertura. `ia_modelo` registra quem leu — a extração muda entre
-- versões de modelo, como já acontece em `documentos`.

ALTER TABLE "comunicacoes_djen" ADD COLUMN IF NOT EXISTS "ia_tipo_ato" TEXT;
ALTER TABLE "comunicacoes_djen" ADD COLUMN IF NOT EXISTS "ia_resumo" TEXT;
ALTER TABLE "comunicacoes_djen" ADD COLUMN IF NOT EXISTS "ia_providencia" TEXT;
ALTER TABLE "comunicacoes_djen" ADD COLUMN IF NOT EXISTS "ia_urgencia" TEXT;
-- De quem é o prazo do texto: do escritório ou de outra parte. É o que
-- separa "manifeste-se em 15 dias" do "o INSS implantará em 60 dias".
ALTER TABLE "comunicacoes_djen" ADD COLUMN IF NOT EXISTS "ia_prazo_de_quem" TEXT;
ALTER TABLE "comunicacoes_djen" ADD COLUMN IF NOT EXISTS "ia_alertas" JSONB;
ALTER TABLE "comunicacoes_djen" ADD COLUMN IF NOT EXISTS "ia_modelo" TEXT;
ALTER TABLE "comunicacoes_djen" ADD COLUMN IF NOT EXISTS "ia_analisada_em" TIMESTAMP(3);

-- PostgREST/Supabase só enxerga colunas novas depois de recarregar o cache.
NOTIFY pgrst, 'reload schema';
