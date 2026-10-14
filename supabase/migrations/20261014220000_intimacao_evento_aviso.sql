-- ─────────────────────────────────────────────────────────
-- Perícia e audiência lidas da intimação, e o aviso ao cliente
--
-- Até aqui a intimação só virava tarefa quando trazia prazo em dias.
-- Perícia e audiência trazem dia e hora — e eram só um registro.
-- Agora o motor (regra + IA) lê o evento, guarda aqui, e a rotina abre
-- duas tarefas: a do evento (Vermelho › Andamentos, no dia e na hora)
-- e a de avisar o cliente (Amarelo › Judicial › Andamentos, na
-- véspera), já com a mensagem pronta.
--
-- O envio da mensagem ao cliente NÃO acontece sozinho: fica travado na
-- configuração `aviso_cliente_whatsapp` até o Zeca liberar.
-- ─────────────────────────────────────────────────────────

alter table "comunicacoes_djen"
  add column if not exists "ia_evento_tipo" text,
  add column if not exists "ia_evento_data" date,
  add column if not exists "ia_evento_hora" text,
  add column if not exists "ia_evento_local" text,
  add column if not exists "ia_mensagem_cliente" text,
  -- A tarefa "avisar o cliente", quando houve evento. Separada de
  -- `tarefa_id` (a do prazo/evento) para a rotina não duplicar nenhuma.
  add column if not exists "aviso_tarefa_id" uuid references "tarefas"("id") on delete set null;

create index if not exists "comunicacoes_djen_aviso_tarefa_idx"
  on "comunicacoes_djen" ("aviso_tarefa_id") where "aviso_tarefa_id" is not null;

-- Configurações do escritório: chave → valor. Nasce com uma chave só,
-- a trava do aviso automático ao cliente, desligada.
create table if not exists "configuracoes" (
  "chave" text primary key,
  "valor" jsonb not null,
  "descricao" text,
  "atualizada_em" timestamptz not null default now(),
  "atualizada_por" uuid references "users"("id") on delete set null
);

insert into "configuracoes" ("chave", "valor", "descricao")
values (
  'aviso_cliente_whatsapp',
  'false'::jsonb,
  'Enviar ao cliente, pelo WhatsApp, o aviso de perícia/audiência lido da intimação. Desligado: a tarefa de aviso nasce com a mensagem pronta, mas ninguém envia sozinho.'
)
on conflict ("chave") do nothing;

-- Só o servidor do sistema lê e escreve configurações.
alter table "configuracoes" enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table "configuracoes" from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table "configuracoes" from authenticated;
  end if;
end;
$$;

notify pgrst, 'reload schema';
