-- ─────────────────────────────────────────────────────────
-- Chaves de acesso do conector do Claude
--
-- O Claude trabalha nas tarefas do sistema pelo conector (rota
-- /api/mcp), como um responsável da equipe. Ele não tem cookie de
-- navegador: entra com uma chave, mandada no cabeçalho
-- "Authorization: Bearer …", e cada chave é ligada a uma conta da
-- equipe (a conta "Claude"). Tudo o que ele faz fica no histórico da
-- tarefa em nome dessa conta.
--
-- Só o resumo (SHA-256) da chave fica gravado: quem lê o banco não
-- consegue usar a chave. Ela aparece uma única vez, na hora em que o
-- administrador a gera em Configurações › Conectar o Claude. Revogar
-- é marcar a data — a linha fica, para saber quem usou o quê.
--
-- Idempotente, como as outras: rode uma vez no SQL Editor do Supabase.
-- ─────────────────────────────────────────────────────────

create table if not exists "chaves_api" (
  "id" uuid primary key default gen_random_uuid(),
  "usuario_id" uuid not null references "users"("id") on delete cascade,
  "nome" text not null,
  -- Os primeiros caracteres, para reconhecer a chave na lista.
  "prefixo" text not null,
  "hash" text not null unique,
  "criada_em" timestamptz not null default now(),
  "criada_por" uuid references "users"("id") on delete set null,
  "ultimo_uso_em" timestamptz,
  "revogada_em" timestamptz
);

create index if not exists "chaves_api_usuario_idx" on "chaves_api" ("usuario_id");

-- Só o servidor do sistema (chave secreta do Supabase) lê esta tabela.
alter table "chaves_api" enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table "chaves_api" from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table "chaves_api" from authenticated;
  end if;
end;
$$;

notify pgrst, 'reload schema';
