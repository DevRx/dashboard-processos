-- ─────────────────────────────────────────────────────────
-- Documento sobrevive à exclusão do caso
--
-- Quando `documentos` pertencia ao processo, cascatear fazia sentido.
-- Agora que o dono é o cliente, não faz: o RG anexado e por acaso
-- vinculado a um requerimento sumiria junto com o requerimento
-- excluído, levando embora um documento que vale para todos os casos
-- do titular.
--
-- Com SET NULL o documento perde só o vínculo e continua na pasta do
-- cliente, que é onde ele sempre deveria ter estado.
-- ─────────────────────────────────────────────────────────

alter table "documentos"
  drop constraint "documentos_processo_id_fkey";

alter table "documentos"
  add constraint "documentos_processo_id_fkey"
  foreign key ("processo_id") references "processos"("id")
  on delete set null;
