-- ─────────────────────────────────────────────────────────
-- O que o código sempre esperou e o banco nunca teve
--
-- `prisma/schema.prisma` é o desenho do banco neste projeto, mas quem
-- fala com o banco em produção é o PostgREST, não o Prisma. O efeito
-- disso é que o schema podia ganhar campos sem que ninguém escrevesse
-- a migration correspondente — e nada reclamava até alguém abrir a
-- tela que usava aquele campo.
--
-- Foi o que aconteceu, em quatro lugares de uma vez. Comparando o
-- schema com o banco, faltavam:
--
--   processos.situacao_pericia     etiqueta de perícia do auxílio-doença
--   clientes.senha_meu_inss        senha do gov.br, cifrada
--   clientes.observacoes           comentários da equipe na ficha
--   clientes.latitude/longitude    ponto no mapa de atendimento
--   tarefas.setor                  o time dono da tarefa
--   tarefas.responsavel_id         quem executa
--   comunicacoes_djen              a tabela inteira das intimações
--
-- O estrago era maior do que a lista sugere, por causa de como o
-- PostgREST responde: um `select` que nomeia coluna inexistente não
-- devolve a linha sem aquele campo — ele **falha inteiro**. Então
-- /api/administrativo, que pede `observacoes` e `senha_meu_inss` junto
-- do resto, respondia 500 sempre. A fila chegava vazia na tela, e o
-- quadro do Administrativo aparecia com as sete colunas zeradas: um
-- escritório com clientes cadastrados parecendo um escritório vazio,
-- sem uma linha de erro em lugar nenhum.
-- ─────────────────────────────────────────────────────────

-- ── perícia ──────────────────────────────────────────────
do $$ begin
  create type "SituacaoPericia" as enum (
    'MARCAR_PERICIA', 'PERICIA_MARCADA', 'PRORROGACAO'
  );
exception when duplicate_object then null;
end $$;

-- Nulo é estado de verdade, não ausência de dado: significa "a
-- etiqueta ainda não foi posta à mão", e a tela deriva uma sugestão do
-- status do processo — ver periciaSugerida em lib/domain/processo.
alter table "processos"
  add column if not exists "situacao_pericia" "SituacaoPericia";

-- Esparso: a maioria dos processos não tem perícia. O índice parcial
-- cobre só as linhas que existem.
create index if not exists "idx_processos_situacao_pericia"
  on "processos"("situacao_pericia") where "situacao_pericia" is not null;

-- ── ficha do cliente ─────────────────────────────────────
alter table "clientes"
  -- Cifrada em AES-256-GCM — ver lib/seguranca/cofre.ts. A cifra
  -- protege dump e backup; a tela interna mostra em claro.
  add column if not exists "senha_meu_inss" text,
  add column if not exists "observacoes" text,
  add column if not exists "latitude" double precision,
  add column if not exists "longitude" double precision;

-- ── time e responsável da tarefa ─────────────────────────
do $$ begin
  create type "SetorTarefa" as enum (
    'VERMELHO', 'PRETO', 'AZUL', 'AMARELO', 'VERDE'
  );
exception when duplicate_object then null;
end $$;

alter table "tarefas"
  add column if not exists "setor" "SetorTarefa",
  -- `set null`: a saída de alguém não apaga a tarefa, só a deixa sem
  -- dono — que é exatamente o que o quadro precisa mostrar.
  add column if not exists "responsavel_id" uuid
    references "users"("id") on delete set null;

create index if not exists "idx_tarefas_responsavel_id" on "tarefas"("responsavel_id");

-- ── intimações do DJEN ───────────────────────────────────
create table if not exists "comunicacoes_djen" (
  "id" uuid primary key default gen_random_uuid(),
  "user_id" uuid not null references "users"("id") on delete cascade,
  -- Chave que impede a mesma intimação de entrar duas vezes. É ela que
  -- permite rodar a rotina de manhã e de tarde sem duplicar nada.
  "djen_id" bigint not null,
  "numero_processo" text,
  "numero_processo_mascara" text,
  "sigla_tribunal" text,
  "nome_orgao" text,
  "tipo_comunicacao" text,
  "tipo_documento" text,
  "nome_classe" text,
  "destinatario" text,
  "data_disponibilizacao" date not null,
  "texto" text not null,
  "link" text,
  -- Prazo lido do texto e a data-limite em dias úteis. Estimativa,
  -- não cálculo oficial — ver lib/integracoes/djen.ts.
  "prazo_dias" integer,
  "prazo_trecho" text,
  "prazo_estimado" date,
  "processo_id" uuid references "processos"("id") on delete set null,
  "tarefa_id" uuid references "tarefas"("id") on delete set null,
  -- Triagem por IA — ver lib/ia/analista-intimacao.ts.
  "ia_tipo_ato" text,
  "ia_resumo" text,
  "ia_providencia" text,
  "ia_urgencia" text,
  "ia_prazo_de_quem" text,
  "ia_alertas" jsonb,
  "ia_modelo" text,
  "ia_analisada_em" timestamp with time zone,
  "tratada_em" timestamp with time zone,
  "created_at" timestamp with time zone not null default now(),
  constraint "comunicacoes_djen_user_id_djen_id_key" unique ("user_id", "djen_id")
);

create index if not exists "idx_comunicacoes_djen_data"
  on "comunicacoes_djen"("data_disponibilizacao");
