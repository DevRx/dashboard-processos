-- ─────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────

create type "UserRole" as enum ('ADMIN', 'ADVOGADO', 'ASSISTENTE', 'USER');

create type "ProcessoStatus" as enum (
  'EM_ANALISE',
  'AGUARDANDO_INSS',
  'PERICIA_MARCADA',
  'PERICIA_CONCLUIDA',
  'BENEFICIO_CONCEDIDO',
  'RECUSADO',
  'CONCLUIDO',
  'ARQUIVADO'
);

create type "TarefaStatus" as enum ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

create type "TarefaPrioridade" as enum ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- ─────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────

create table "users" (
  "id" uuid primary key default gen_random_uuid(),
  "name" text not null,
  "email" text unique not null,
  "password" text not null,
  "role" "UserRole" not null default 'USER',
  "telefone" text,
  "matricula" text unique,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);

create table "clientes" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid not null references "users"("id") on delete cascade,
  "nome" text not null,
  "cpf" text unique,
  "email" text,
  "telefone" text,
  "endereco" text,
  "data_nascimento" date,
  "beneficio" text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);

create table "processos" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid not null references "users"("id") on delete cascade,
  "cliente_id" uuid not null references "clientes"("id") on delete cascade,
  "beneficio" text not null,
  "numero" text,
  "status" "ProcessoStatus" not null default 'EM_ANALISE',
  "responsavel_id" uuid references "users"("id") on delete set null,
  "data_entrada" date,
  "data_conclusao" date,
  "valor_causa" numeric(12,2),
  "tribunal" text,
  "vara" text,
  "comarca" text,
  "observacoes" text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);

create table "andamentos" (
  "id" uuid primary key default gen_random_uuid(),
  "processo_id" uuid not null references "processos"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "data" date not null,
  "descricao" text not null,
  "status" "ProcessoStatus" not null,
  "created_at" timestamp with time zone not null default now()
);

create table "tarefas" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid not null references "users"("id") on delete cascade,
  "processo_id" uuid references "processos"("id") on delete set null,
  "titulo" text not null,
  "descricao" text,
  "data" date not null,
  "hora" text,
  "status" "TarefaStatus" not null default 'PENDENTE',
  "prioridade" "TarefaPrioridade" not null default 'MEDIA',
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);

create table "documentos" (
  "id" uuid primary key default gen_random_uuid(),
  "processo_id" uuid not null references "processos"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "nome" text not null,
  "url" text not null,
  "tipo" text,
  "tamanho" integer,
  "created_at" timestamp with time zone not null default now()
);

create table "auditorias" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid not null references "users"("id") on delete cascade,
  "acao" text not null,
  "entidade" text not null,
  "entidade_id" text,
  "detalhes" jsonb,
  "ip" text,
  "created_at" timestamp with time zone not null default now()
);

-- ─────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────

create index "idx_clientes_user_id" on "clientes"("user_id");
create index "idx_processos_user_id" on "processos"("user_id");
create index "idx_processos_cliente_id" on "processos"("cliente_id");
create index "idx_andamentos_processo_id" on "andamentos"("processo_id");
create index "idx_tarefas_user_id" on "tarefas"("user_id");
create index "idx_tarefas_processo_id" on "tarefas"("processo_id");
create index "idx_documentos_processo_id" on "documentos"("processo_id");
create index "idx_auditorias_user_id" on "auditorias"("user_id");

-- ─────────────────────────────────────────────────────────
-- Triggers for updated_at
-- ─────────────────────────────────────────────────────────

create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

create trigger update_users_updated_at
    before update on "users"
    for each row execute function update_updated_at_column();

create trigger update_clientes_updated_at
    before update on "clientes"
    for each row execute function update_updated_at_column();

create trigger update_processos_updated_at
    before update on "processos"
    for each row execute function update_updated_at_column();

create trigger update_tarefas_updated_at
    before update on "tarefas"
    for each row execute function update_updated_at_column();
