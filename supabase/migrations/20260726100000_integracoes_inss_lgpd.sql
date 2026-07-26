-- ─────────────────────────────────────────────────────────
-- Integrações INSS (Meu INSS / GERID) + camada LGPD
--
-- Meu INSS e GERID não expõem API para terceiros. O acesso do
-- advogado depende de procuração cadastrada no Meu INSS, e a
-- autenticação no GERID usa certificado A3 (hardware, não
-- transferível para servidor). Por isso a integração é por
-- importação assistida: o operador puxa o documento oficial já
-- autenticado e o sistema estrutura o conteúdo.
--
-- Consequência para a LGPD: todo dado importado é dado pessoal
-- sensível (saúde/previdenciário, art. 5º II). Cada importação
-- exige base legal registrada e vira registro de tratamento
-- (art. 37).
-- ─────────────────────────────────────────────────────────

create type "FonteIntegracao" as enum ('DATAJUD', 'MEU_INSS', 'GERID');

create type "BaseLegalLGPD" as enum (
  -- art. 11, I — consentimento específico e destacado
  'CONSENTIMENTO',
  -- art. 11, II, "a" — cumprimento de obrigação legal
  'OBRIGACAO_LEGAL',
  -- art. 11, II, "d" — exercício regular de direitos, inclusive
  -- em contrato e em processo judicial/administrativo. É a base
  -- típica da procuração previdenciária.
  'EXERCICIO_DIREITOS'
);

create type "DocumentoINSS" as enum (
  'CNIS',
  'CARTA_CONCESSAO',
  'CARTA_INDEFERIMENTO',
  'EXTRATO_PAGAMENTO',
  'REQUERIMENTO_GERID'
);

-- ─────────────────────────────────────────────────────────
-- Base legal por titular. Sem uma linha vigente aqui, a
-- importação é recusada pela API.
-- ─────────────────────────────────────────────────────────
create table "consentimentos_lgpd" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid not null references "users"("id") on delete cascade,
  "cliente_id" uuid not null references "clientes"("id") on delete cascade,
  "base_legal" "BaseLegalLGPD" not null,
  -- Finalidade específica (art. 6º, I). Texto livre porque a
  -- finalidade é declarada caso a caso pelo escritório.
  "finalidade" text not null,
  -- Identificação da procuração/termo que sustenta a base legal.
  "procuracao_ref" text,
  -- Fontes que esta base legal autoriza. Restringe o escopo da
  -- importação (minimização, art. 6º, III).
  "fontes" "FonteIntegracao"[] not null default '{}',
  "vigente_desde" timestamp with time zone not null default now(),
  -- Prazo de retenção acordado; alimenta o expurgo automático.
  "retencao_ate" date,
  -- Revogação (art. 8º, §5º). Nunca deletamos a linha: a prova
  -- de que houve base legal no passado é o que protege o
  -- escritório numa fiscalização.
  "revogado_em" timestamp with time zone,
  "revogado_motivo" text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);

create index "idx_consentimentos_lgpd_cliente_id" on "consentimentos_lgpd"("cliente_id");
create index "idx_consentimentos_lgpd_user_id" on "consentimentos_lgpd"("user_id");

-- Um único consentimento vigente por cliente. Revogados não
-- entram no índice, então o histórico continua acumulando.
create unique index "idx_consentimentos_lgpd_vigente"
  on "consentimentos_lgpd"("cliente_id")
  where "revogado_em" is null;

create trigger update_consentimentos_lgpd_updated_at
    before update on "consentimentos_lgpd"
    for each row execute function update_updated_at_column();

-- ─────────────────────────────────────────────────────────
-- Registro de cada importação. Guarda o resultado estruturado,
-- nunca o documento bruto — o PDF original fica no GERID/Meu
-- INSS, que é a fonte autoritativa.
-- ─────────────────────────────────────────────────────────
create table "importacoes_integracao" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid not null references "users"("id") on delete cascade,
  "cliente_id" uuid references "clientes"("id") on delete cascade,
  "processo_id" uuid references "processos"("id") on delete set null,
  "consentimento_id" uuid references "consentimentos_lgpd"("id") on delete set null,
  "fonte" "FonteIntegracao" not null,
  "documento" "DocumentoINSS",
  -- Campos extraídos, já minimizados pelo parser.
  "dados" jsonb not null,
  -- SHA-256 do texto de origem. Permite provar que o registro
  -- corresponde ao documento oficial e detectar reimportação,
  -- sem guardar o conteúdo bruto.
  "hash_origem" text not null,
  -- Data-limite de retenção, copiada do consentimento no momento
  -- da importação para que a revogação não apague o prazo.
  "expurgar_em" date,
  "expurgado_em" timestamp with time zone,
  "created_at" timestamp with time zone not null default now()
);

create index "idx_importacoes_integracao_cliente_id" on "importacoes_integracao"("cliente_id");
create index "idx_importacoes_integracao_processo_id" on "importacoes_integracao"("processo_id");
create index "idx_importacoes_integracao_expurgar_em"
  on "importacoes_integracao"("expurgar_em")
  where "expurgado_em" is null;
