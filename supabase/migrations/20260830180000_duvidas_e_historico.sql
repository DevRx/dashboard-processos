-- ─────────────────────────────────────────────────────────
-- Dúvidas como clones da tarefa, e o histórico que as guarda
--
-- Uma dúvida no escritório não é um comentário: é trabalho parado.
-- Alguém montou a pasta, esbarrou numa pergunta que só quem responde
-- pelo caso resolve, e o caso ficou onde estava. Guardar isso num
-- campo de texto da própria tarefa esconderia justamente o que
-- precisa aparecer — que existe uma pergunta esperando resposta, com
-- dono e com data.
--
-- Por isso a dúvida vira uma tarefa de verdade, filha da que a
-- originou. Ela entra no quadro, tem responsável, tem prazo e some de
-- lá quando é respondida, como qualquer outra. O laço com a mãe é o
-- que a mantém "integrada à tarefa principal": quem abre a tarefa
-- grande vê as perguntas que saíram dela; quem abre a dúvida vê de
-- onde ela veio.
-- ─────────────────────────────────────────────────────────

-- `create type` não aceita IF NOT EXISTS. O bloco existe para esta
-- migration poder ser reexecutada sem quebrar: ela é aplicada à mão no
-- editor do Supabase, e colar de novo depois de uma falha no meio é o
-- caminho normal de quem está consertando, não um descuido.
do $$ begin
  create type "TarefaTipo" as enum ('NORMAL', 'DUVIDA');
exception when duplicate_object then null;
end $$;

alter table "tarefas"
  add column if not exists "tipo" "TarefaTipo" not null default 'NORMAL',
  -- `cascade`: dúvida sem a tarefa que a originou não significa nada,
  -- e deixá-la órfã no quadro seria pior do que perdê-la.
  add column if not exists "tarefa_pai_id" uuid references "tarefas"("id") on delete cascade,
  -- A resposta mora na dúvida, não num evento solto: é ela que a
  -- fecha, e quem reabre a tarefa meses depois procura a resposta
  -- junto da pergunta.
  add column if not exists "resposta" text,
  add column if not exists "respondida_em" timestamp with time zone,
  add column if not exists "respondida_por" uuid references "users"("id") on delete set null;

create index if not exists "idx_tarefas_tarefa_pai_id" on "tarefas"("tarefa_pai_id");
create index if not exists "idx_tarefas_tipo" on "tarefas"("tipo");

-- Só dúvida tem mãe. Sem isso, `tarefa_pai_id` viraria um campo de
-- "relacionada a", e o histórico da tarefa principal passaria a puxar
-- coisas que não são perguntas.
--
-- A regra irmã — dúvida não gera dúvida, para o fio ter fim — não cabe
-- num CHECK, que não enxerga a linha da mãe. Ela é conferida em
-- app/api/tarefas/[id]/duvidas/route.ts, antes de inserir.
do $$ begin
  alter table "tarefas"
    add constraint "so_duvida_tem_mae" check (
      "tarefa_pai_id" is null or "tipo" = 'DUVIDA'
    );
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────────────────────
-- O histórico
--
-- Append-only de propósito: um histórico que se edita não é
-- histórico. Nada aqui tem UPDATE — quem errou o registro corrige
-- acrescentando, como em qualquer livro de ocorrências.
--
-- O evento da dúvida é gravado no clone, não na mãe. É uma linha só,
-- num lugar só; a tela da tarefa principal alcança as perguntas pelo
-- laço `tarefa_pai_id`, em vez de manter uma segunda cópia que um dia
-- discorda da primeira.
-- ─────────────────────────────────────────────────────────

do $$ begin
  create type "EventoTarefaTipo" as enum (
    'DUVIDA_ABERTA',
    'DUVIDA_RESPONDIDA',
    'STATUS_ALTERADO'
  );
exception when duplicate_object then null;
end $$;

create table if not exists "eventos_tarefa" (
  "id" uuid primary key default gen_random_uuid(),
  "tarefa_id" uuid not null references "tarefas"("id") on delete cascade,
  "tipo" "EventoTarefaTipo" not null,
  -- Quem fez. `set null` porque a saída de alguém do escritório não
  -- pode apagar o que aconteceu — o evento continua, sem o nome.
  "autor_id" uuid references "users"("id") on delete set null,
  -- A pergunta, em DUVIDA_ABERTA; a resposta, em DUVIDA_RESPONDIDA.
  -- Vazio em STATUS_ALTERADO, que fala pelos dois campos abaixo.
  "texto" text,
  "status_de" "TarefaStatus",
  "status_para" "TarefaStatus",
  "created_at" timestamp with time zone not null default now()
);

-- A leitura é sempre "os eventos desta tarefa, do mais novo ao mais
-- velho": o índice é composto para não ordenar em memória.
create index if not exists "idx_eventos_tarefa_tarefa_id" on "eventos_tarefa"("tarefa_id", "created_at" desc);
