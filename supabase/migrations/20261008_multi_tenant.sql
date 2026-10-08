-- ─────────────────────────────────────────────────────────
-- Multi-tenant — escritórios
--
-- Até aqui a instalação é de um escritório só, e o escopo é "todo
-- mundo que tem conta" (lib/escritorio.ts). Esta migração cria a noção
-- de escritório e liga cada usuário a um, sem mudar o comportamento de
-- quem já usa: o escritório-sede recebe todos os usuários de hoje.
--
-- A chave de IA de cada escritório é guardada CIFRADA (mesmo cofre do
-- senha_meu_inss, lib/seguranca/cofre). Nunca em texto puro.
--
-- Isolamento real passa a valer no caminho logado assim que os
-- usuários têm escritorio_id. Rotinas de fundo (cron DJEN) seguem no
-- escopo de hoje — no multi-tenant de verdade o cron roda por
-- escritório (pendência anotada no PR).
--
-- Idempotente: rode uma vez no SQL Editor do Supabase.
-- ─────────────────────────────────────────────────────────

create table if not exists "escritorios" (
  "id"            uuid primary key default gen_random_uuid(),
  "nome"          text not null,
  "plano"         text not null default 'ESSENCIAL',
  -- Chave da Anthropic do escritório, cifrada (AES-256-GCM). Null = usa
  -- o ambiente (escritório-sede) ou fica sem IA.
  "anthropic_key" text,
  -- Modelo por plano. Null = o padrão do código (claude-opus-5).
  "modelo_ia"     text,
  "ativo"         boolean not null default true,
  "created_at"    timestamptz not null default now(),
  "updated_at"    timestamptz not null default now()
);

alter table "users"
  add column if not exists "escritorio_id" uuid references "escritorios" ("id");

create index if not exists "users_escritorio_idx" on "users" ("escritorio_id");

-- Cria o escritório-sede se ainda não houver nenhum, e liga nele todos
-- os usuários que ainda não têm escritório.
insert into "escritorios" ("nome", "plano")
  select 'Escritório-sede', 'INTERNO'
  where not exists (select 1 from "escritorios");

update "users"
  set "escritorio_id" = (select "id" from "escritorios" order by "created_at" limit 1)
  where "escritorio_id" is null;
