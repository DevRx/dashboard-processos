-- ─────────────────────────────────────────────────────────
-- Varredura do INSS — metadados de acompanhamento
--
-- Dá à Central do INSS (app/(dashboard)/inss/varredura) o que ela
-- precisa guardar: como o escritório alcança o INSS de cada cliente,
-- a cessação a vencer (para a fila de prorrogação) e o histórico de
-- cada leitura feita.
--
-- NÃO cria armazenamento de senha nenhum. A senha do Meu INSS já mora
-- cifrada em clientes.senha_meu_inss (AES-256-GCM, ver
-- lib/seguranca/cofre.ts) e é lida por uma pessoa — nada aqui a
-- consome para login automático.
--
-- A leitura é alimentada pelo fluxo assistido que já existe
-- (components/integracoes/painel-inss) ou pela procuração eletrônica:
-- quem está logado lê, o sistema registra. Situação PENDENTE é o
-- cliente cujo acesso parou num captcha/código; BLOQUEADO é o GERID
-- suspenso.
--
-- Idempotente, como as outras: rode uma vez no SQL Editor do Supabase.
-- ─────────────────────────────────────────────────────────

-- Como o escritório alcança o INSS deste cliente.
alter table "clientes"
  add column if not exists "acesso_inss" text
  check ("acesso_inss" in ('PROCURACAO', 'COFRE', 'GERID'));

-- Data de cessação do benefício (DCB) — base da fila de prorrogação.
alter table "processos"
  add column if not exists "dcb" date;

-- Uma linha por leitura do INSS. O resumo é o que mudou desde a
-- leitura anterior; nulo quando não houve novidade.
create table if not exists "varredura_leituras" (
  "id"          uuid primary key default gen_random_uuid(),
  "user_id"     text not null,
  "cliente_id"  uuid not null references "clientes" ("id") on delete cascade,
  "processo_id" uuid references "processos" ("id") on delete set null,
  "lida_em"     timestamptz not null default now(),
  "situacao"    text not null default 'OK'
                check ("situacao" in ('OK', 'PENDENTE', 'BLOQUEADO')),
  "resumo"      text,
  "created_at"  timestamptz not null default now()
);

create index if not exists "varredura_leituras_cliente_idx"
  on "varredura_leituras" ("cliente_id", "lida_em" desc);

create index if not exists "varredura_leituras_user_idx"
  on "varredura_leituras" ("user_id", "lida_em" desc);
