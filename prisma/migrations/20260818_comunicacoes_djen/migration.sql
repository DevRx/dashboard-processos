-- Caixa de entrada do DJEN.
--
-- A consulta ao diário é por intervalo de datas e relê tudo a cada
-- busca; o que não existe lá é "já tratei isso". Por isso as
-- comunicações moram aqui, com a chave do DJEN garantindo que a mesma
-- intimação não entre duas vezes.

-- `id` com default no banco, como nas demais tabelas: quem grava é o
-- PostgREST, e ele insere sem informar a chave.
CREATE TABLE IF NOT EXISTS "comunicacoes_djen" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
  "user_id" TEXT NOT NULL,
  "djen_id" BIGINT NOT NULL,
  "numero_processo" TEXT,
  "numero_processo_mascara" TEXT,
  "sigla_tribunal" TEXT,
  "nome_orgao" TEXT,
  "tipo_comunicacao" TEXT,
  "tipo_documento" TEXT,
  "nome_classe" TEXT,
  "destinatario" TEXT,
  "data_disponibilizacao" DATE NOT NULL,
  "texto" TEXT NOT NULL,
  "link" TEXT,
  "prazo_dias" INTEGER,
  "prazo_trecho" TEXT,
  "prazo_estimado" DATE,
  "processo_id" TEXT,
  "tarefa_id" TEXT,
  "tratada_em" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "comunicacoes_djen_pkey" PRIMARY KEY ("id")
);

-- Uma intimação por escritório: é o que torna a busca repetível sem
-- duplicar a caixa de entrada.
CREATE UNIQUE INDEX IF NOT EXISTS "comunicacoes_djen_user_id_djen_id_key"
  ON "comunicacoes_djen" ("user_id", "djen_id");

CREATE INDEX IF NOT EXISTS "comunicacoes_djen_data_disponibilizacao_idx"
  ON "comunicacoes_djen" ("data_disponibilizacao");

DO $$
BEGIN
  ALTER TABLE "comunicacoes_djen"
    ADD CONSTRAINT "comunicacoes_djen_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Apagar o processo ou a tarefa não apaga a intimação: ela é registro
-- do diário oficial, e continua valendo sem o vínculo.
DO $$
BEGIN
  ALTER TABLE "comunicacoes_djen"
    ADD CONSTRAINT "comunicacoes_djen_processo_id_fkey"
    FOREIGN KEY ("processo_id") REFERENCES "processos"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "comunicacoes_djen"
    ADD CONSTRAINT "comunicacoes_djen_tarefa_id_fkey"
    FOREIGN KEY ("tarefa_id") REFERENCES "tarefas"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- PostgREST/Supabase só enxerga a tabela nova depois de recarregar o cache.
NOTIFY pgrst, 'reload schema';
