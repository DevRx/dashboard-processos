-- ─────────────────────────────────────────────────────────
-- Documentos passam a ser do cliente, não do processo
--
-- RG, CPF, comprovante de residência e procuração são do titular:
-- valem para todos os casos dele e existem antes de qualquer
-- requerimento. Amarrados ao processo, criavam um impasse — não dava
-- para montar a pasta antes de abrir o caso, que é exatamente a ordem
-- em que o trabalho acontece.
--
-- O vínculo com o processo continua, agora opcional: laudo médico de
-- um requerimento específico merece ficar junto dele.
-- ─────────────────────────────────────────────────────────

create type "CategoriaDocumento" as enum (
  'PROCURACAO',
  'IDENTIFICACAO',
  'CPF',
  'COMPROVANTE_RESIDENCIA',
  'CNIS',
  'CARTEIRA_TRABALHO',
  'LAUDO_MEDICO',
  'EXAME',
  'CERTIDAO',
  'CARTA_BENEFICIO',
  'OUTRO'
);

alter table "documentos"
  add column "cliente_id" uuid references "clientes"("id") on delete cascade,
  add column "categoria" "CategoriaDocumento" not null default 'OUTRO',
  alter column "processo_id" drop not null;

-- Linhas existentes herdam o cliente do processo a que pertenciam.
update "documentos" d
   set "cliente_id" = p."cliente_id"
  from "processos" p
 where d."processo_id" = p."id"
   and d."cliente_id" is null;

create index "idx_documentos_cliente_id" on "documentos"("cliente_id");
create index "idx_documentos_categoria" on "documentos"("categoria");

-- Documento sem dono não deveria existir: sem cliente nem processo,
-- nada o alcançaria para exclusão nem para o expurgo da LGPD.
alter table "documentos"
  add constraint "documentos_tem_dono"
  check ("cliente_id" is not null or "processo_id" is not null);
