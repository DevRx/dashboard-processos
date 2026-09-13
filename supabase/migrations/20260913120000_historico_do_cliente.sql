-- ─────────────────────────────────────────────────────────
-- O histórico de comentários do cliente
--
-- A ficha administrativa tinha um campo de texto só, `observacoes`.
-- Um campo só tem um defeito que ninguém vê na hora: ele guarda a
-- última versão, não o que aconteceu. Alguém escrevia "falta o
-- comprovante"; outra pessoa, no dia seguinte, apagava e escrevia
-- "ligar sexta" — e o primeiro recado sumia sem deixar rastro, sem
-- data e sem nome. Duas pessoas cuidando do mesmo cliente precisam
-- ver o que a outra registrou, e quando.
--
-- Por isso o comentário vira linha: uma por registro, com autor e
-- hora. E fica limitado aos 3 mais recentes, de propósito. A ficha é
-- para ser lida em cinco segundos antes de ligar para o cliente; o
-- que importa é o que foi combinado por último, não uma ata. Quem
-- precisar de mais do que isso tem a pasta do cliente.
-- ─────────────────────────────────────────────────────────

create table if not exists "historico_cliente" (
  "id" uuid primary key default gen_random_uuid(),
  -- `cascade`: comentário de cliente apagado não tem para quem servir.
  "cliente_id" uuid not null references "clientes"("id") on delete cascade,
  -- Quem escreveu. `set null` porque a saída de alguém do escritório
  -- não apaga o que ela registrou — o comentário continua, sem o nome.
  "autor_id" uuid references "users"("id") on delete set null,
  "texto" text not null,
  "created_at" timestamp with time zone not null default now()
);

-- A leitura é sempre "os comentários deste cliente, do mais novo ao
-- mais velho": o índice é composto para não ordenar em memória.
create index if not exists "idx_historico_cliente_cliente_id"
  on "historico_cliente"("cliente_id", "created_at" desc);

-- ── o limite de 3, garantido pelo banco ──────────────────
--
-- A poda mora aqui e não na rota de propósito: se ela ficasse no
-- código, um insert feito à mão no editor do Supabase (ou por um
-- script de teste) deixaria o histórico crescer sem ninguém notar.
-- No banco, todo caminho que insere passa pela mesma regra.
--
-- O desempate por `id` cobre dois comentários gravados no mesmo
-- instante: sem ele, o `limit 3` poderia escolher qualquer um.
create or replace function "podar_historico_cliente"() returns trigger as $$
begin
  delete from "historico_cliente"
  where "cliente_id" = new."cliente_id"
    and "id" not in (
      select "id" from "historico_cliente"
      where "cliente_id" = new."cliente_id"
      order by "created_at" desc, "id" desc
      limit 3
    );
  return null;
end;
$$ language plpgsql;

drop trigger if exists "trg_podar_historico_cliente" on "historico_cliente";
create trigger "trg_podar_historico_cliente"
  after insert on "historico_cliente"
  for each row execute function "podar_historico_cliente"();

-- ── o que já estava escrito ──────────────────────────────
--
-- O comentário que vivia em `clientes.observacoes` vira o primeiro
-- registro do histórico, sem autor (o campo antigo não guardava quem
-- escreveu) e com a data da última alteração do cadastro, que é a
-- melhor aproximação de quando ele foi escrito. A coluna antiga fica
-- como está: apagar dado não é trabalho de migration.
--
-- Só entra em cliente que ainda não tem histórico, para esta migration
-- poder ser reexecutada sem duplicar.
insert into "historico_cliente" ("cliente_id", "autor_id", "texto", "created_at")
select c."id", null, btrim(c."observacoes"), coalesce(c."updated_at", c."created_at", now())
from "clientes" c
where c."observacoes" is not null
  and btrim(c."observacoes") <> ''
  and not exists (
    select 1 from "historico_cliente" h where h."cliente_id" = c."id"
  );
