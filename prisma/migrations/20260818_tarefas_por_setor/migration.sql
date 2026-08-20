-- Quadro de tarefas por setor.
--
-- Idempotente pelo mesmo motivo da migração anterior: o banco local e
-- o Supabase são aplicados à mão, em momentos diferentes.

DO $$
BEGIN
  CREATE TYPE "SetorTarefa" AS ENUM ('VERMELHO', 'PRETO', 'AZUL', 'AMARELO', 'VERDE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "tarefas" ADD COLUMN IF NOT EXISTS "setor" "SetorTarefa";
ALTER TABLE "tarefas" ADD COLUMN IF NOT EXISTS "responsavel_id" TEXT;

-- Sem cascade: apagar um usuário não deve apagar a tarefa dele, só
-- deixá-la sem responsável para alguém reassumir.
DO $$
BEGIN
  ALTER TABLE "tarefas"
    ADD CONSTRAINT "tarefas_responsavel_id_fkey"
    FOREIGN KEY ("responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS "tarefas_setor_idx" ON "tarefas" ("setor");

-- PostgREST/Supabase só enxerga colunas novas depois de recarregar o cache.
NOTIFY pgrst, 'reload schema';
