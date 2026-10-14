-- ─────────────────────────────────────────────────────────
-- Fluxo novo das tarefas: atribuições por time, etapa e responsável
--
-- Regras do Zeca (13/10/2026):
--
--  1. Uma tarefa pode estar em mais de um lugar ao mesmo tempo — o
--     cliente que está no ADM pode estar também no Judicial — e pode
--     voltar no fluxo (do amarelo para o Acompanhamento do azul, por
--     exemplo, esperando laudo atualizado).
--  2. Cada etapa diz quem são os responsáveis. Quando há mais de um,
--     cada um conclui a sua parte, e a tarefa NÃO some para os outros:
--     ela só sai da etapa quando o último responsável concluir, e só
--     fecha de vez quando não sobrar parte aberta em lugar nenhum.
--  3. O TickTick fica de fora: as tarefas que vieram de lá entram no
--     fluxo pela pasta em que estavam, e daí em diante só o sistema
--     manda. Nada aqui escreve no TickTick.
--
-- Como isso fica no banco:
--
--   tarefa_atribuicoes — uma linha por pessoa, por etapa, por tarefa:
--   "fulano tem esta tarefa nesta etapa deste time". A linha aberta
--   (fim_em nulo) é trabalho pendente. Ninguém apaga linha: concluir,
--   mudar de etapa ou tirar alguém da tarefa encerra a linha com o
--   motivo — e o caminho inteiro da tarefa fica registrado.
--
--   Os campos `setor`, `responsavel_id` e `status` da tarefa viram um
--   resumo das linhas, mantido por gatilho: o resto do sistema (agenda,
--   dashboard, intimações) continua lendo a tarefa como sempre.
--
--   Mudança feita por fora (concluir pela agenda, arrastar no quadro
--   geral, trocar o responsável no formulário) é traduzida para as
--   linhas por outro gatilho, para as duas pontas nunca discordarem.
--
--   Tarefa sem nenhuma linha ainda segue a pasta do TickTick (a tela
--   calcula onde ela fica). A primeira ação do fluxo — ou o botão de
--   trazer tudo para o fluxo novo — grava as linhas.
--
-- As ações do fluxo são funções (mover, adicionar, concluir, trocar
-- responsáveis): cada uma trava a tarefa antes de mexer, então duas
-- pessoas mexendo no mesmo cartão ao mesmo tempo não se atropelam — a
-- segunda encontra o cartão já mudado e recebe "já saiu daqui".
--
-- Idempotente, como as outras: rode uma vez no SQL Editor do Supabase.
-- Enquanto não rodar, o sistema continua funcionando pelas pastas do
-- TickTick e as ações novas avisam que falta esta migration.
-- ─────────────────────────────────────────────────────────

create table if not exists "tarefa_atribuicoes" (
  "id" uuid primary key default gen_random_uuid(),
  "tarefa_id" uuid not null references "tarefas"("id") on delete cascade,
  "setor" "SetorTarefa" not null,
  -- Etapa do fluxo (lib/domain/tarefa/fluxo.ts): 'analise', 'jud-protocolo'…
  -- Nula quando a tarefa está no time mas ainda sem etapa.
  "etapa" text,
  "responsavel_id" uuid references "users"("id") on delete set null,
  "criada_em" timestamptz not null default now(),
  "criada_por" uuid references "users"("id") on delete set null,
  "fim_em" timestamptz,
  "fim_por" uuid references "users"("id") on delete set null,
  "fim_motivo" text,
  constraint "tarefa_atribuicoes_fim_coerente" check (("fim_em" is null) = ("fim_motivo" is null)),
  constraint "tarefa_atribuicoes_fim_motivo" check (
    "fim_motivo" is null or "fim_motivo" in ('CONCLUIDA', 'MOVIDA', 'REMOVIDA', 'TAREFA_FECHADA')
  )
);

create index if not exists "tarefa_atribuicoes_tarefa_idx" on "tarefa_atribuicoes" ("tarefa_id");
create index if not exists "tarefa_atribuicoes_abertas_idx"
  on "tarefa_atribuicoes" ("tarefa_id", "setor", "etapa") where "fim_em" is null;
create index if not exists "tarefa_atribuicoes_responsavel_idx"
  on "tarefa_atribuicoes" ("responsavel_id") where "fim_em" is null;
create index if not exists "tarefa_atribuicoes_fim_idx" on "tarefa_atribuicoes" ("fim_em");

-- A mesma pessoa não fica duas vezes, em aberto, na mesma etapa da mesma
-- tarefa. É o que deixa as funções abaixo usarem "on conflict do nothing"
-- sem medo de cliques repetidos ou de duas abas fazendo a mesma coisa.
create unique index if not exists "tarefa_atribuicoes_aberta_unica"
  on "tarefa_atribuicoes" (
    "tarefa_id",
    "setor",
    coalesce("etapa", ''),
    coalesce("responsavel_id", '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where "fim_em" is null;

-- Só o servidor do sistema (chave secreta, que passa por cima do RLS)
-- mexe nesta tabela. RLS ligado e nenhuma política: a chave pública do
-- Supabase não lê nem escreve nada aqui.
alter table "tarefa_atribuicoes" enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table "tarefa_atribuicoes" from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table "tarefa_atribuicoes" from authenticated;
  end if;
end;
$$;

-- ── Resumo na tarefa ─────────────────────────────────────

-- Recalcula setor, responsável e status da tarefa a partir das linhas.
--   • há linha aberta → o time é o da linha aberta mais antiga (o lugar
--     "principal"); o responsável, o primeiro com nome nesse time; e a
--     tarefa está aberta.
--   • não há linha aberta → a tarefa está concluída.
-- A marca fluxo.interno avisa o gatilho da tarefa que esta mudança veio
-- daqui, e não de fora.
create or replace function "fluxo_resumir"(p_tarefa uuid) returns void
language plpgsql as $$
declare
  v_abertas integer;
  v_total integer;
  v_setor "SetorTarefa";
  v_resp uuid;
  v_antigo text;
begin
  select count(*) filter (where "fim_em" is null), count(*)
    into v_abertas, v_total
    from "tarefa_atribuicoes" where "tarefa_id" = p_tarefa;

  if v_total = 0 then
    return;
  end if;

  v_antigo := coalesce(current_setting('fluxo.interno', true), '');
  perform set_config('fluxo.interno', '1', true);

  if v_abertas > 0 then
    select "setor" into v_setor
      from "tarefa_atribuicoes"
      where "tarefa_id" = p_tarefa and "fim_em" is null
      order by "criada_em", "id"
      limit 1;

    select "responsavel_id" into v_resp
      from "tarefa_atribuicoes"
      where "tarefa_id" = p_tarefa and "fim_em" is null and "responsavel_id" is not null
      order by ("setor" = v_setor) desc, "criada_em", "id"
      limit 1;

    update "tarefas"
      set "setor" = v_setor,
          "responsavel_id" = v_resp,
          "status" = case when "status" in ('CONCLUIDA', 'CANCELADA') then 'PENDENTE'::"TarefaStatus" else "status" end
      where "id" = p_tarefa
        and ("setor" is distinct from v_setor
             or "responsavel_id" is distinct from v_resp
             or "status" in ('CONCLUIDA', 'CANCELADA'));
  else
    update "tarefas"
      set "status" = 'CONCLUIDA'
      where "id" = p_tarefa and "status" not in ('CONCLUIDA', 'CANCELADA');
  end if;

  perform set_config('fluxo.interno', v_antigo, true);
end;
$$;

create or replace function "fluxo_atribuicao_mudou"() returns trigger
language plpgsql as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform "fluxo_resumir"(old."tarefa_id");
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new."tarefa_id" <> old."tarefa_id") then
    perform "fluxo_resumir"(new."tarefa_id");
  end if;
  return null;
end;
$$;

drop trigger if exists "fluxo_atribuicao_mudou" on "tarefa_atribuicoes";
create trigger "fluxo_atribuicao_mudou"
  after insert or update or delete on "tarefa_atribuicoes"
  for each row execute function "fluxo_atribuicao_mudou"();

-- Etapa com responsável de nome não fica com a vaga "sem responsável"
-- aberta ao lado: a vaga é só para quando não há ninguém.
create or replace function "fluxo_limpar_vaga"(p_tarefa uuid, p_setor "SetorTarefa", p_etapa text)
returns void
language plpgsql as $$
begin
  update "tarefa_atribuicoes" v
    set "fim_em" = now(), "fim_motivo" = 'REMOVIDA'
    where v."tarefa_id" = p_tarefa and v."fim_em" is null
      and v."setor" = p_setor and v."etapa" is not distinct from p_etapa
      and v."responsavel_id" is null
      and exists (
        select 1 from "tarefa_atribuicoes" n
        where n."tarefa_id" = p_tarefa and n."fim_em" is null
          and n."setor" = p_setor and n."etapa" is not distinct from p_etapa
          and n."responsavel_id" is not null
      );
end;
$$;

-- ── Mudança feita por fora, na própria tarefa ────────────

create or replace function "fluxo_tarefa_mudou"() returns trigger
language plpgsql as $$
declare
  v_ultimo timestamptz;
  v_principal uuid;
begin
  if coalesce(current_setting('fluxo.interno', true), '') = '1' then
    return null;
  end if;
  if not exists (select 1 from "tarefa_atribuicoes" where "tarefa_id" = new."id") then
    return null;
  end if;

  -- Fechou por fora (agenda, quadro geral, formulário): fecha tudo o
  -- que estava aberto. Quem fecha a tarefa inteira escolheu fechar.
  if new."status" in ('CONCLUIDA', 'CANCELADA') and old."status" not in ('CONCLUIDA', 'CANCELADA') then
    update "tarefa_atribuicoes"
      set "fim_em" = now(), "fim_motivo" = 'TAREFA_FECHADA'
      where "tarefa_id" = new."id" and "fim_em" is null;
    return null;
  end if;

  -- Reabriu por fora: volta o último lugar em que ela estava.
  if new."status" not in ('CONCLUIDA', 'CANCELADA') and old."status" in ('CONCLUIDA', 'CANCELADA') then
    if not exists (select 1 from "tarefa_atribuicoes" where "tarefa_id" = new."id" and "fim_em" is null) then
      select max("fim_em") into v_ultimo from "tarefa_atribuicoes" where "tarefa_id" = new."id";
      update "tarefa_atribuicoes"
        set "fim_em" = null, "fim_por" = null, "fim_motivo" = null
        where "tarefa_id" = new."id" and "fim_em" = v_ultimo;
    end if;
    return null;
  end if;

  -- Time trocado por fora (arrastar no quadro geral): as partes abertas
  -- vão para o time novo, ainda sem etapa.
  if new."setor" is distinct from old."setor" and new."setor" is not null
     and exists (select 1 from "tarefa_atribuicoes"
                 where "tarefa_id" = new."id" and "fim_em" is null and "setor" <> new."setor") then
    with saindo as (
      update "tarefa_atribuicoes"
        set "fim_em" = now(), "fim_motivo" = 'MOVIDA'
        where "tarefa_id" = new."id" and "fim_em" is null and "setor" <> new."setor"
        returning "responsavel_id"
    ),
    nomes as (
      select distinct "responsavel_id" from saindo where "responsavel_id" is not null
    )
    insert into "tarefa_atribuicoes" ("tarefa_id", "setor", "etapa", "responsavel_id")
      select new."id", new."setor", null::text, "responsavel_id" from nomes
      union all
      select new."id", new."setor", null::text, null::uuid where not exists (select 1 from nomes)
      on conflict do nothing;
    perform "fluxo_limpar_vaga"(new."id", new."setor", null);
  end if;

  -- Responsável trocado por fora: a parte principal passa para ele.
  if new."responsavel_id" is distinct from old."responsavel_id"
     and not exists (select 1 from "tarefa_atribuicoes"
                     where "tarefa_id" = new."id" and "fim_em" is null
                       and "responsavel_id" is not distinct from new."responsavel_id") then
    select "id" into v_principal
      from "tarefa_atribuicoes"
      where "tarefa_id" = new."id" and "fim_em" is null
      order by "criada_em", "id"
      limit 1;
    if v_principal is not null then
      update "tarefa_atribuicoes" set "responsavel_id" = new."responsavel_id" where "id" = v_principal;
      -- "Sem responsável" numa etapa que tem outros nomes: sai só quem
      -- era o principal; os outros continuam.
      perform "fluxo_limpar_vaga"(new."id", a."setor", a."etapa")
        from "tarefa_atribuicoes" a where a."id" = v_principal;
    end if;
  end if;

  -- Seja qual for a mudança de fora, a tarefa volta a dizer o que as
  -- linhas dizem (tirar o time por fora, por exemplo, não vale: o time
  -- é o da parte aberta).
  if new."setor" is distinct from old."setor" or new."responsavel_id" is distinct from old."responsavel_id" then
    perform "fluxo_resumir"(new."id");
  end if;

  return null;
end;
$$;

drop trigger if exists "fluxo_tarefa_mudou" on "tarefas";
create trigger "fluxo_tarefa_mudou"
  after update of "status", "setor", "responsavel_id" on "tarefas"
  for each row execute function "fluxo_tarefa_mudou"();

-- ── Ações do fluxo ───────────────────────────────────────
-- Todas travam a tarefa primeiro (select … for update): mexidas
-- simultâneas no mesmo cartão viram uma fila, nunca uma corrida.

-- Trava a tarefa e diz se ela existe e está aberta.
create or replace function "fluxo_travar"(p_tarefa uuid) returns boolean
language plpgsql as $$
declare
  v_status "TarefaStatus";
begin
  select "status" into v_status from "tarefas" where "id" = p_tarefa for update;
  if not found then
    raise exception 'tarefa_inexistente' using errcode = 'P0002';
  end if;
  return v_status not in ('CONCLUIDA', 'CANCELADA');
end;
$$;

-- Põe responsáveis numa etapa. Com nome: entra quem ainda não está, e
-- sai a vaga "sem responsável" que houver. Sem nome: só garante que a
-- etapa tenha uma vaga aberta. Devolve quantas linhas entraram.
create or replace function "fluxo_inserir_grupo"(
  p_tarefa uuid, p_setor "SetorTarefa", p_etapa text, p_responsaveis uuid[], p_usuario uuid
) returns integer
language plpgsql as $$
declare
  v_nomes uuid[];
  v_n integer := 0;
begin
  select coalesce(array_agg(distinct r), '{}') into v_nomes
    from unnest(coalesce(p_responsaveis, '{}'::uuid[])) as r
    where r is not null;

  if array_length(v_nomes, 1) is not null then
    insert into "tarefa_atribuicoes" ("tarefa_id", "setor", "etapa", "responsavel_id", "criada_por")
      select p_tarefa, p_setor, p_etapa, r, p_usuario from unnest(v_nomes) as r
      on conflict do nothing;
    get diagnostics v_n = row_count;

    update "tarefa_atribuicoes"
      set "fim_em" = now(), "fim_por" = p_usuario, "fim_motivo" = 'REMOVIDA'
      where "tarefa_id" = p_tarefa and "fim_em" is null and "setor" = p_setor
        and "etapa" is not distinct from p_etapa and "responsavel_id" is null;
  elsif not exists (
    select 1 from "tarefa_atribuicoes"
      where "tarefa_id" = p_tarefa and "fim_em" is null and "setor" = p_setor
        and "etapa" is not distinct from p_etapa
  ) then
    insert into "tarefa_atribuicoes" ("tarefa_id", "setor", "etapa", "responsavel_id", "criada_por")
      values (p_tarefa, p_setor, p_etapa, null, p_usuario)
      on conflict do nothing;
    get diagnostics v_n = row_count;
  end if;

  return v_n;
end;
$$;

-- Primeira entrada da tarefa no fluxo: grava as linhas calculadas pela
-- pasta do TickTick. Não faz nada se ela já tem linhas (idempotente) ou
-- se já está fechada. Devolve quantas linhas gravou.
create or replace function "fluxo_materializar"(p_tarefa uuid, p_linhas jsonb, p_usuario uuid default null)
returns integer
language plpgsql as $$
declare
  l jsonb;
  v_n integer := 0;
  v_k integer;
begin
  if not "fluxo_travar"(p_tarefa) then
    return 0;
  end if;
  if exists (select 1 from "tarefa_atribuicoes" where "tarefa_id" = p_tarefa) then
    return 0;
  end if;

  for l in select * from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) loop
    insert into "tarefa_atribuicoes" ("tarefa_id", "setor", "etapa", "responsavel_id", "criada_por")
      values (
        p_tarefa,
        (l->>'setor')::"SetorTarefa",
        nullif(l->>'etapa', ''),
        nullif(l->>'responsavelId', '')::uuid,
        p_usuario
      )
      on conflict do nothing;
    get diagnostics v_k = row_count;
    v_n := v_n + v_k;
  end loop;

  return v_n;
end;
$$;

-- O mesmo, para muitas tarefas: [{ "tarefaId": …, "linhas": [ … ] }].
create or replace function "fluxo_materializar_lote"(p_lote jsonb, p_usuario uuid default null)
returns integer
language plpgsql as $$
declare
  item jsonb;
  v_n integer := 0;
begin
  for item in
    select * from jsonb_array_elements(coalesce(p_lote, '[]'::jsonb)) order by value->>'tarefaId'
  loop
    begin
      v_n := v_n + "fluxo_materializar"((item->>'tarefaId')::uuid, item->'linhas', p_usuario);
    exception when sqlstate 'P0002' then
      null; -- tarefa apagada no meio do caminho: segue o lote
    end;
  end loop;
  return v_n;
end;
$$;

-- Leva o cartão de uma etapa para outra (do mesmo time ou de outro).
-- p_responsaveis nulo = os mesmos de antes; vazio = sem responsável.
-- Devolve quantas partes abertas saíram da origem — zero quer dizer que
-- o cartão já não estava lá (alguém moveu antes).
create or replace function "fluxo_mover"(
  p_tarefa uuid,
  p_de_setor "SetorTarefa", p_de_etapa text,
  p_para_setor "SetorTarefa", p_para_etapa text,
  p_responsaveis uuid[], p_usuario uuid
) returns integer
language plpgsql as $$
declare
  v_resps uuid[];
  v_n integer;
begin
  if not "fluxo_travar"(p_tarefa) then
    return 0;
  end if;
  if p_de_setor = p_para_setor and p_de_etapa is not distinct from p_para_etapa then
    return 0;
  end if;

  -- Quem está na origem agora. A tarefa já está travada: ninguém muda
  -- isso entre esta leitura e as escritas abaixo.
  select count(*), array_agg("responsavel_id") into v_n, v_resps
    from "tarefa_atribuicoes"
    where "tarefa_id" = p_tarefa and "fim_em" is null
      and "setor" = p_de_setor and "etapa" is not distinct from p_de_etapa;

  if v_n = 0 then
    return 0;
  end if;

  -- Entra no destino antes de sair da origem: em nenhum instante a
  -- tarefa fica sem parte aberta (e o resumo nunca a dá por concluída).
  perform "fluxo_inserir_grupo"(
    p_tarefa, p_para_setor, p_para_etapa, coalesce(p_responsaveis, v_resps), p_usuario
  );

  update "tarefa_atribuicoes"
    set "fim_em" = now(), "fim_por" = p_usuario, "fim_motivo" = 'MOVIDA'
    where "tarefa_id" = p_tarefa and "fim_em" is null
      and "setor" = p_de_setor and "etapa" is not distinct from p_de_etapa;

  perform "fluxo_limpar_vaga"(p_tarefa, p_para_setor, p_para_etapa);
  return v_n;
end;
$$;

-- Põe a tarefa também em outro lugar, sem tirar de onde está
-- (o cliente que está no ADM e passa a estar no Judicial também).
create or replace function "fluxo_adicionar"(
  p_tarefa uuid, p_para_setor "SetorTarefa", p_para_etapa text, p_responsaveis uuid[], p_usuario uuid
) returns integer
language plpgsql as $$
begin
  if not "fluxo_travar"(p_tarefa) then
    return 0;
  end if;
  return "fluxo_inserir_grupo"(p_tarefa, p_para_setor, p_para_etapa, p_responsaveis, p_usuario);
end;
$$;

-- Conclui a parte de um responsável numa etapa. As partes dos outros
-- continuam abertas, e a tarefa continua aparecendo para eles.
-- p_responsavel nulo conclui a vaga "sem responsável".
create or replace function "fluxo_concluir_parte"(
  p_tarefa uuid, p_setor "SetorTarefa", p_etapa text, p_responsavel uuid, p_usuario uuid
) returns integer
language plpgsql as $$
declare
  v_n integer;
begin
  perform "fluxo_travar"(p_tarefa);
  update "tarefa_atribuicoes"
    set "fim_em" = now(), "fim_por" = p_usuario, "fim_motivo" = 'CONCLUIDA'
    where "tarefa_id" = p_tarefa and "fim_em" is null
      and "setor" = p_setor and "etapa" is not distinct from p_etapa
      and "responsavel_id" is not distinct from p_responsavel;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Conclui a etapa para todos os responsáveis dela.
create or replace function "fluxo_concluir_etapa"(
  p_tarefa uuid, p_setor "SetorTarefa", p_etapa text, p_usuario uuid
) returns integer
language plpgsql as $$
declare
  v_n integer;
begin
  perform "fluxo_travar"(p_tarefa);
  update "tarefa_atribuicoes"
    set "fim_em" = now(), "fim_por" = p_usuario, "fim_motivo" = 'CONCLUIDA'
    where "tarefa_id" = p_tarefa and "fim_em" is null
      and "setor" = p_setor and "etapa" is not distinct from p_etapa;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Troca quem responde por uma etapa: sai quem não está na lista (a
-- parte dele é encerrada como REMOVIDA, não como concluída), entra quem
-- falta. Lista vazia deixa a etapa sem responsável.
create or replace function "fluxo_responsaveis"(
  p_tarefa uuid, p_setor "SetorTarefa", p_etapa text, p_responsaveis uuid[], p_usuario uuid
) returns integer
language plpgsql as $$
declare
  v_lista uuid[] := coalesce(p_responsaveis, '{}'::uuid[]);
begin
  if not "fluxo_travar"(p_tarefa) then
    return 0;
  end if;
  if not exists (
    select 1 from "tarefa_atribuicoes"
      where "tarefa_id" = p_tarefa and "fim_em" is null
        and "setor" = p_setor and "etapa" is not distinct from p_etapa
  ) then
    return 0;
  end if;

  -- Primeiro entra quem falta, depois sai quem não está na lista: a
  -- etapa nunca fica vazia no meio da troca.
  if exists (select 1 from unnest(v_lista) as r where r is not null) then
    perform "fluxo_inserir_grupo"(p_tarefa, p_setor, p_etapa, v_lista, p_usuario);
  else
    insert into "tarefa_atribuicoes" ("tarefa_id", "setor", "etapa", "responsavel_id", "criada_por")
      values (p_tarefa, p_setor, p_etapa, null, p_usuario)
      on conflict do nothing;
  end if;

  update "tarefa_atribuicoes"
    set "fim_em" = now(), "fim_por" = p_usuario, "fim_motivo" = 'REMOVIDA'
    where "tarefa_id" = p_tarefa and "fim_em" is null
      and "setor" = p_setor and "etapa" is not distinct from p_etapa
      and "responsavel_id" is not null
      and not ("responsavel_id" = any (v_lista));

  return 1;
end;
$$;

-- Só o servidor do sistema (chave secreta) chama as funções do fluxo.
do $$
declare
  f text;
begin
  foreach f in array array[
    'fluxo_resumir(uuid)',
    'fluxo_travar(uuid)',
    'fluxo_limpar_vaga(uuid, "SetorTarefa", text)',
    'fluxo_inserir_grupo(uuid, "SetorTarefa", text, uuid[], uuid)',
    'fluxo_materializar(uuid, jsonb, uuid)',
    'fluxo_materializar_lote(jsonb, uuid)',
    'fluxo_mover(uuid, "SetorTarefa", text, "SetorTarefa", text, uuid[], uuid)',
    'fluxo_adicionar(uuid, "SetorTarefa", text, uuid[], uuid)',
    'fluxo_concluir_parte(uuid, "SetorTarefa", text, uuid, uuid)',
    'fluxo_concluir_etapa(uuid, "SetorTarefa", text, uuid)',
    'fluxo_responsaveis(uuid, "SetorTarefa", text, uuid[], uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%s from anon', f);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke execute on function public.%s from authenticated', f);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function public.%s to service_role', f);
    end if;
  end loop;
end;
$$;

-- O PostgREST do Supabase passa a enxergar a tabela e as funções novas.
notify pgrst, 'reload schema';
