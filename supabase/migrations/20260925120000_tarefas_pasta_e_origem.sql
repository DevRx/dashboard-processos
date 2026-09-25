-- ─────────────────────────────────────────────────────────
-- Pasta da tarefa e origem de importação
--
-- A equipe vem do TickTick, onde cada tarefa mora numa lista
-- ("JUDICIAL › ANDAMENTO", "CONCESSÃO › COM DATA-URGENTE"). O time
-- responde "de quem é"; a pasta responde "que tipo de trabalho é", e
-- sem ela as centenas de tarefas de um time viram uma coluna só.
--
-- `origem_id` é o que torna a importação repetível: a mesma planilha
-- importada duas vezes não duplica nada. Nula para tarefa criada aqui.
--
-- Idempotente, como as outras: rode uma vez no SQL Editor do Supabase.
-- ─────────────────────────────────────────────────────────

alter table "tarefas" add column if not exists "pasta" text;
alter table "tarefas" add column if not exists "origem_id" text;

create unique index if not exists "tarefas_origem_id_key" on "tarefas" ("origem_id");
create index if not exists "tarefas_status_idx" on "tarefas" ("status");
