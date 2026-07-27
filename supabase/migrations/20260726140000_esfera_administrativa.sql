-- ─────────────────────────────────────────────────────────
-- Fase administrativa do INSS como cidadã de primeira classe
--
-- A tabela `processos` nasceu inteiramente judicial: numero CNJ,
-- tribunal, vara, comarca. Mas o trabalho previdenciário começa no
-- administrativo — requerimento no Meu INSS/GERID — e ali não existe
-- número CNJ, existe protocolo. Exigir um processo judicial para
-- registrar um requerimento administrativo inverte a ordem real dos
-- fatos: o judicial é a exceção que só aparece depois do
-- indeferimento.
--
-- Em vez de uma tabela nova, um discriminador. Kanban, agenda,
-- andamentos, tarefas, documentos e financeiro já giram em torno de
-- `processos`; separar a fase administrativa em outra entidade
-- obrigaria a duplicar todos eles.
-- ─────────────────────────────────────────────────────────

create type "EsferaProcesso" as enum ('ADMINISTRATIVO', 'JUDICIAL');

alter table "processos"
  add column "esfera" "EsferaProcesso" not null default 'ADMINISTRATIVO',
  -- Identificador do requerimento no INSS. É o que o GERID mostra.
  add column "protocolo_inss" text,
  -- NB, presente na carta de concessão e no extrato de pagamento.
  add column "numero_beneficio" text;

-- Linhas existentes com número CNJ preenchido são judiciais. As demais
-- ficam no padrão administrativo, que é onde a maioria de fato está.
update "processos" set "esfera" = 'JUDICIAL' where "numero" is not null;

create index "idx_processos_esfera" on "processos"("esfera");
create index "idx_processos_protocolo_inss" on "processos"("protocolo_inss");
