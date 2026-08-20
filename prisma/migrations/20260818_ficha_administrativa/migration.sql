-- Ficha administrativa do cliente + etiqueta de perícia.
--
-- Escrito para rodar mais de uma vez sem quebrar (IF NOT EXISTS): o
-- banco local de desenvolvimento e o Supabase são aplicados à mão,
-- em momentos diferentes.

-- Cliente: senha do Meu INSS (armazenada cifrada) e comentários da equipe.
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "senha_meu_inss" TEXT;
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "observacoes" TEXT;

-- Processo: acompanhamento da perícia no auxílio por incapacidade.
DO $$
BEGIN
  CREATE TYPE "SituacaoPericia" AS ENUM ('MARCAR_PERICIA', 'PERICIA_MARCADA', 'PRORROGACAO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "processos" ADD COLUMN IF NOT EXISTS "situacao_pericia" "SituacaoPericia";

-- PostgREST/Supabase só enxerga colunas novas depois de recarregar o cache.
NOTIFY pgrst, 'reload schema';
