-- ─────────────────────────────────────────────────────────
-- A tela em uma ida só, o painel em uma ida só, e a trava do login
--
-- O teste de estresse de 15/10/2026 mostrou onde o tempo vai: a tela
-- dos times fazia 13 idas ao banco e voltava com 3,4 MB (3.600 cartões),
-- e a tela recarregava tudo isso depois de cada edição. O painel de
-- início fazia 17 idas para somar meia dúzia de números. E o login não
-- tinha limite de tentativas.
--
-- Aqui ficam as três respostas, todas no banco:
--
--   • fluxo_tela(...)    — os cartões abertos com as partes do fluxo,
--                          compactos, com filtros e com "só o que mudou
--                          desde", numa chamada só
--   • painel_resumo(...) — todos os números do início numa chamada só
--   • tentativas_login   — quem errou a senha, quando, de onde
--
-- O código continua funcionando sem esta migration (cai no caminho
-- antigo); com ela, fica rápido.
-- ─────────────────────────────────────────────────────────

-- ── Índices que faltavam ──────────────────────────────────

-- As tarefas abertas em ordem de data: é a ordem da tela e da agenda.
create index if not exists "tarefas_abertas_data_idx"
  on "tarefas" ("data", "id")
  where "status" not in ('CONCLUIDA', 'CANCELADA');

-- "Só o que mudou desde": a recarga pontual da tela.
create index if not exists "tarefas_updated_at_idx" on "tarefas" ("updated_at");

-- "Esta tarefa nasceu de uma intimação?" — antes carregava todas as
-- intimações para responder a uma.
create index if not exists "comunicacoes_djen_tarefa_idx"
  on "comunicacoes_djen" ("tarefa_id") where "tarefa_id" is not null;

create index if not exists "tarefa_atribuicoes_mudanca_idx"
  on "tarefa_atribuicoes" ("tarefa_id", "criada_em", "fim_em");

-- ── A tela dos times em uma ida ───────────────────────────
--
-- Devolve as tarefas abertas do escritório, já com:
--   • as partes do fluxo (abertas, e as concluídas nos últimos 60 dias,
--     para a tela mostrar quem já fez a sua parte);
--   • se nasceu de intimação (prazo do DJEN);
--   • o nome do responsável e o processo, do jeito que a tela lê.
--
-- Filtros (todos opcionais): p_ids (só estas tarefas — a resposta de
-- uma ação), p_desde (só o que mudou desde este instante, INCLUSIVE as
-- que fecharam — é como a tela se atualiza sem baixar tudo),
-- p_responsavel, p_setor, p_etapa, p_busca (título, pasta, descrição,
-- e os dígitos de um CPF/NB), p_limite.
--
-- `agora` vai junto: é o `p_desde` da próxima chamada.
create or replace function "fluxo_tela"(
  "p_usuarios" uuid[],
  "p_ids" uuid[] default null,
  "p_desde" timestamptz default null,
  "p_responsavel" uuid default null,
  "p_setor" text default null,
  "p_etapa" text default null,
  "p_busca" text default null,
  "p_limite" int default null
)
returns json
language plpgsql
stable
as $$
declare
  v_texto text := nullif(trim(p_busca), '');
  v_digitos text := nullif(regexp_replace(coalesce(p_busca, ''), '\D', '', 'g'), '');
  v_ids uuid[];
  v_json json;
begin
  -- Primeiro QUAIS tarefas (três caminhos, cada um com o seu índice), e
  -- só depois o JSON delas. Num `where` só, com `or` entre os caminhos,
  -- o Postgres varria a tabela inteira para devolver uma tarefa.
  if p_ids is not null then
    -- Pedidas por id: do jeito que estão, abertas ou não.
    select array_agg(t."id") into v_ids
    from "tarefas" t
    where t."id" = any(p_ids) and t."user_id" = any(p_usuarios);

  elsif p_desde is not null then
    -- Só o que mudou desde: inclusive as que fecharam, para a tela tirá-las.
    select array_agg(t."id") into v_ids
    from "tarefas" t
    where t."user_id" = any(p_usuarios)
      and (t."updated_at" >= p_desde
           or exists (select 1 from "tarefa_atribuicoes" a
                      where a."tarefa_id" = t."id" and (a."criada_em" >= p_desde or a."fim_em" >= p_desde)));

  else
    -- O normal: as abertas, com os filtros, na ordem da tela.
    select array_agg(x."id") into v_ids
    from (
      select t."id"
      from "tarefas" t
      where t."user_id" = any(p_usuarios)
        and t."status" not in ('CONCLUIDA', 'CANCELADA')
        and (p_setor is null or t."setor"::text = p_setor
             or exists (select 1 from "tarefa_atribuicoes" a where a."tarefa_id" = t."id" and a."fim_em" is null and a."setor"::text = p_setor))
        and (p_etapa is null
             or exists (select 1 from "tarefa_atribuicoes" a where a."tarefa_id" = t."id" and a."fim_em" is null and a."etapa" = p_etapa))
        and (p_responsavel is null
             or t."responsavel_id" = p_responsavel
             or exists (select 1 from "tarefa_atribuicoes" a where a."tarefa_id" = t."id" and a."fim_em" is null and a."responsavel_id" = p_responsavel))
        and (v_texto is null
             or t."titulo" ilike '%' || v_texto || '%'
             or t."pasta" ilike '%' || v_texto || '%'
             or t."descricao" ilike '%' || v_texto || '%'
             or (v_digitos is not null and length(v_digitos) >= 5
                 and regexp_replace(coalesce(t."titulo", '') || ' ' || coalesce(t."descricao", ''), '\D', '', 'g') like '%' || v_digitos || '%'))
      order by t."data", t."id"
      limit coalesce(p_limite, 1000000)
    ) x;
  end if;

  select json_build_object(
    'agora', now(),
    'tarefas', coalesce((
      select json_agg(json_build_object(
        'id', t."id",
        'titulo', t."titulo",
        -- A descrição vai inteira: a agenda edita a tarefa a partir da
        -- lista, e um texto cortado aqui seria gravado cortado lá.
        'descricao', t."descricao",
        'data', t."data",
        'hora', t."hora",
        'status', t."status",
        'prioridade', t."prioridade",
        'setor', t."setor",
        'pasta', t."pasta",
        'tipo', t."tipo",
        'tarefaPaiId', t."tarefa_pai_id",
        'processoId', t."processo_id",
        'responsavelId', t."responsavel_id",
        'responsavel', case when u."id" is null then null else json_build_object('id', u."id", 'name', u."name") end,
        'processo', case when p."id" is null then null else json_build_object('beneficio', p."beneficio", 'numero', p."numero") end,
        'deIntimacao', exists (select 1 from "comunicacoes_djen" c where c."tarefa_id" = t."id"),
        'atribuicoes', coalesce((
          select json_agg(json_build_object(
            'id', a."id",
            'setor', a."setor",
            'etapa', a."etapa",
            'responsavelId', a."responsavel_id",
            'criadaEm', to_char(a."criada_em" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'fimEm', to_char(a."fim_em" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'fimPor', a."fim_por",
            'fimMotivo', a."fim_motivo"
          ) order by a."criada_em", a."id")
          from "tarefa_atribuicoes" a
          where a."tarefa_id" = t."id"
            and (a."fim_em" is null or (a."fim_motivo" = 'CONCLUIDA' and a."fim_em" >= now() - interval '60 days'))
        ), '[]'::json)
      ) order by t."data", t."id")
      from "tarefas" t
      left join "users" u on u."id" = t."responsavel_id"
      left join "processos" p on p."id" = t."processo_id"
      where t."id" = any(coalesce(v_ids, '{}'::uuid[]))
    ), '[]'::json)
  ) into v_json;

  return v_json;
end;
$$;

-- ── O painel de início em uma ida ─────────────────────────
create or replace function "painel_resumo"("p_usuarios" uuid[], "p_hoje" date)
returns json
language sql
stable
as $$
with
  "abertas" as (
    select t.* from "tarefas" t
    where t."user_id" = any(p_usuarios) and t."status" not in ('CONCLUIDA', 'CANCELADA')
  ),
  "de_hoje" as (
    select t."id", t."titulo", t."hora", t."setor", t."pasta", t."tipo", u."name" as "responsavel",
           exists (select 1 from "comunicacoes_djen" c where c."tarefa_id" = t."id") as "de_intimacao"
    from "abertas" t left join "users" u on u."id" = t."responsavel_id"
    where t."data" = p_hoje
    order by t."hora" nulls last, t."id"
    limit 1000
  )
select json_build_object(
  'processosAtivos', (select count(*) from "processos" where "user_id" = any(p_usuarios) and "status" not in ('CONCLUIDO', 'ARQUIVADO', 'RECUSADO')),
  'totalClientes', (select count(*) from "clientes" where "user_id" = any(p_usuarios)),
  'tarefasHoje', (select count(*) from "abertas" where "data" = p_hoje),
  'tarefasAtrasadas', (select count(*) from "abertas" where "data" < p_hoje),
  'atrasadasPorTime', (
    select coalesce(json_object_agg(coalesce("setor"::text, 'SEM'), n), '{}'::json)
    from (select "setor", count(*) as n from "abertas" where "data" < p_hoje group by "setor") x
  ),
  'totalUrgentes', (select count(*) from "abertas" where "prioridade" = 'URGENTE'),
  'urgentes', coalesce((
    select json_agg(json_build_object('id', t."id", 'titulo', t."titulo", 'data', t."data", 'hora', t."hora", 'setor', t."setor", 'responsavel', u."name") order by t."data", t."id")
    from (select * from "abertas" where "prioridade" = 'URGENTE' order by "data", "id" limit 6) t
    left join "users" u on u."id" = t."responsavel_id"
  ), '[]'::json),
  'hojePorTime', (
    select coalesce(json_object_agg(coalesce("setor"::text, 'SEM'), n), '{}'::json)
    from (select "setor", count(*) as n from "de_hoje" group by "setor") x
  ),
  'agendaDeHoje', coalesce((
    select json_agg(json_build_object('id', "id", 'titulo', "titulo", 'hora', "hora", 'setor', "setor", 'pasta', "pasta", 'tipo', "tipo", 'responsavel', "responsavel", 'deIntimacao', "de_intimacao"))
    from "de_hoje"
  ), '[]'::json),
  'processosRecentes', coalesce((
    select json_agg(json_build_object('id', p."id", 'clienteId', p."cliente_id", 'clienteNome', c."nome", 'beneficio', p."beneficio", 'status', p."status", 'dataEntrada', p."data_entrada") order by p."created_at" desc)
    from (select * from "processos" where "user_id" = any(p_usuarios) order by "created_at" desc limit 5) p
    left join "clientes" c on c."id" = p."cliente_id"
  ), '[]'::json),
  'porStatus', (
    select coalesce(json_object_agg("status", n), '{}'::json)
    from (select "status", count(*) as n from "processos" where "user_id" = any(p_usuarios) group by "status") x
  ),
  'porBeneficio', coalesce((
    select json_agg(json_build_object('esfera', "esfera", 'beneficio', "beneficio", 'total', n))
    from (select "esfera", "beneficio", count(*) as n from "processos" where "user_id" = any(p_usuarios) group by "esfera", "beneficio") x
  ), '[]'::json)
);
$$;

-- ── Tentativas de login ───────────────────────────────────
--
-- Cada senha errada vira uma linha; a partir da 5ª em 15 minutos (pelo
-- e-mail ou pelo endereço), o login responde 429 antes de conferir a
-- senha. Acertar a senha apaga as linhas do e-mail. É uma tabela, e não
-- memória do servidor, porque na Vercel cada pedido pode cair numa
-- função diferente.
create table if not exists "tentativas_login" (
  "id" bigserial primary key,
  "email" text not null,
  "ip" text,
  "quando" timestamptz not null default now()
);
create index if not exists "tentativas_login_email_idx" on "tentativas_login" ("email", "quando");
create index if not exists "tentativas_login_ip_idx" on "tentativas_login" ("ip", "quando");

alter table "tentativas_login" enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table "tentativas_login" from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table "tentativas_login" from authenticated;
  end if;
  -- Só o servidor do sistema grava e lê (no Supabase isto já vale pelos
  -- privilégios padrão; fica explícito para outros ambientes).
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, delete on table "tentativas_login" to service_role;
    grant usage, select on sequence "tentativas_login_id_seq" to service_role;
  end if;
end;
$$;

notify pgrst, 'reload schema';
