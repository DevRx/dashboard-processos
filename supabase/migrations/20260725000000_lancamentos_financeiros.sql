-- ─────────────────────────────────────────────────────────
-- Financeiro: lançamentos (entrada/saída)
-- ─────────────────────────────────────────────────────────

create type "LancamentoTipo" as enum ('ENTRADA', 'SAIDA');

create table "lancamentos_financeiros" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid not null references "users"("id") on delete cascade,
  "descricao" text not null,
  "valor" numeric(12,2) not null,
  "tipo" "LancamentoTipo" not null,
  "data" date not null,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);

create index "idx_lancamentos_financeiros_user_id" on "lancamentos_financeiros"("user_id");

create trigger update_lancamentos_financeiros_updated_at
    before update on "lancamentos_financeiros"
    for each row execute function update_updated_at_column();
