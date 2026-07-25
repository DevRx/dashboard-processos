-- Adiciona campo de prazo/vencimento ao processo (usado no board Kanban)
alter table "processos" add column if not exists "prazo" date;
