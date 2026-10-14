import "server-only"
import { cache } from "react"

import { supabase } from "@/lib/supabase/server"
import {
  linhasPelaPasta,
  type Atribuicao,
  type LinhaFluxo,
  type TarefaComLugar,
  type UsuarioDoFluxo,
} from "@/lib/domain/tarefa"

/**
 * O lado do servidor do fluxo novo: ler as atribuições, gravar a
 * entrada de uma tarefa no fluxo e chamar as funções do banco.
 *
 * As regras moram no banco (migration 20261013200000_fluxo_atribuicoes):
 * aqui só se traduz pedido em chamada e erro em resposta.
 */

/** Códigos de "a tabela ou a função ainda não existe" — falta rodar a migration. */
const SEM_MIGRATION = new Set(["42P01", "42883", "PGRST202", "PGRST205", "PGRST200"])

export function faltaMigration(erro?: { code?: string | null; message?: string | null } | null) {
  if (!erro) return false
  if (erro.code && SEM_MIGRATION.has(erro.code)) return true
  return /tarefa_atribuicoes|fluxo_[a-z_]+/.test(erro.message ?? "") && /does not exist|could not find|não existe/i.test(erro.message ?? "")
}

export const MENSAGEM_SEM_MIGRATION =
  "O fluxo novo ainda não está ligado no banco: falta rodar a migration 20261013200000_fluxo_atribuicoes.sql no Supabase."

/** A tabela do fluxo existe? Uma consulta por requisição. */
export const fluxoDisponivel = cache(async (): Promise<boolean> => {
  const { error } = await supabase.from("tarefa_atribuicoes").select("id").limit(1)
  if (!error) return true
  if (!faltaMigration(error)) console.error("Fluxo — verificar tabela:", error.message)
  return false
})

type LinhaBanco = {
  id: string
  tarefa_id: string
  setor: string
  etapa: string | null
  responsavel_id: string | null
  criada_em: string
  fim_em: string | null
  fim_por: string | null
  fim_motivo: string | null
}

export function paraAtribuicao(l: LinhaBanco): Atribuicao {
  return {
    id: l.id,
    tarefaId: l.tarefa_id,
    setor: l.setor as Atribuicao["setor"],
    etapa: (l.etapa as Atribuicao["etapa"]) ?? null,
    responsavelId: l.responsavel_id,
    criadaEm: l.criada_em,
    fimEm: l.fim_em,
    fimPor: l.fim_por,
    fimMotivo: (l.fim_motivo as Atribuicao["fimMotivo"]) ?? null,
  }
}

const COLUNAS = "id, tarefa_id, setor, etapa, responsavel_id, criada_em, fim_em, fim_por, fim_motivo"

/**
 * As atribuições que a tela precisa, por tarefa: todas as abertas e as
 * concluídas dos últimos 60 dias (para mostrar quem já fez a sua parte
 * na etapa). Paginado — o Supabase corta em mil linhas sem avisar.
 */
export async function atribuicoesParaTela(ids: Set<string>): Promise<Map<string, Atribuicao[]>> {
  const porTarefa = new Map<string, Atribuicao[]>()
  const desde = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const PAGINA = 1000

  for (const filtro of ["abertas", "recentes"] as const) {
    for (let de = 0; ; de += PAGINA) {
      let q = supabase.from("tarefa_atribuicoes").select(COLUNAS).order("id", { ascending: true }).range(de, de + PAGINA - 1)
      q = filtro === "abertas" ? q.is("fim_em", null) : q.gte("fim_em", desde).eq("fim_motivo", "CONCLUIDA")
      const { data, error } = await q
      if (error) throw error
      for (const l of (data ?? []) as LinhaBanco[]) {
        if (!ids.has(l.tarefa_id)) continue
        const lista = porTarefa.get(l.tarefa_id) ?? []
        lista.push(paraAtribuicao(l))
        porTarefa.set(l.tarefa_id, lista)
      }
      if (!data || data.length < PAGINA) break
    }
  }
  return porTarefa
}

/** As atribuições de uma tarefa só, inteiras (com o histórico). */
export async function atribuicoesDaTarefa(id: string): Promise<Atribuicao[]> {
  const { data, error } = await supabase
    .from("tarefa_atribuicoes")
    .select(COLUNAS)
    .eq("tarefa_id", id)
    .order("criada_em", { ascending: true })
  if (error) throw error
  return ((data ?? []) as LinhaBanco[]).map(paraAtribuicao)
}

/** Ids das tarefas que já têm linha no fluxo. */
export async function tarefasJaNoFluxo(): Promise<Set<string>> {
  const ids = new Set<string>()
  const PAGINA = 1000
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from("tarefa_atribuicoes")
      .select("tarefa_id")
      .order("id", { ascending: true })
      .range(de, de + PAGINA - 1)
    if (error) throw error
    for (const l of data ?? []) ids.add(String(l.tarefa_id))
    if (!data || data.length < PAGINA) break
  }
  return ids
}

/**
 * Ids das tarefas que alguma intimação do DJEN abriu — o prazo sem pasta
 * do vermelho entra no fluxo em Andamentos por causa disso.
 */
export async function tarefasDeIntimacao(escritorio: string[]): Promise<Set<string>> {
  const ids = new Set<string>()
  const PAGINA = 1000

  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from("comunicacoes_djen")
      .select("tarefa_id")
      .in("user_id", escritorio)
      .not("tarefa_id", "is", null)
      .order("id", { ascending: true })
      .range(de, de + PAGINA - 1)

    if (error) {
      console.error("Vínculo tarefa ↔ intimação:", error.message)
      break
    }
    for (const linha of data ?? []) {
      if (linha.tarefa_id) ids.add(String(linha.tarefa_id))
    }
    if (!data || data.length < PAGINA) break
  }
  return ids
}

/** A equipe do escritório, para ligar os nomes das etapas às contas. */
export const usuariosDoFluxo = cache(async (): Promise<UsuarioDoFluxo[]> => {
  const { data, error } = await supabase.from("users").select("id, name, email")
  if (error) {
    console.error("Fluxo — equipe:", error.message)
    return []
  }
  return (data ?? []) as UsuarioDoFluxo[]
})

/** Uma linha para a função do banco: o formato que ela lê do JSON. */
function paraJson(l: LinhaFluxo) {
  return { setor: l.setor, etapa: l.etapa ?? "", responsavelId: l.responsavelId ?? "" }
}

/**
 * Garante que a tarefa tenha linhas no fluxo antes de uma ação: se ainda
 * não tem, grava as que a pasta do TickTick indica. Idempotente — se
 * outra requisição gravou antes, a função do banco não faz nada.
 */
export async function garantirNoFluxo(
  tarefa: TarefaComLugar,
  usuarioId: string,
  linhas?: LinhaFluxo[] | (() => Promise<LinhaFluxo[]>)
): Promise<void> {
  const { count, error } = await supabase
    .from("tarefa_atribuicoes")
    .select("id", { count: "exact", head: true })
    .eq("tarefa_id", tarefa.id)
  if (error) throw error
  if ((count ?? 0) > 0) return

  const lista = typeof linhas === "function" ? await linhas() : (linhas ?? linhasPelaPasta(tarefa))
  const { error: erroRpc } = await supabase.rpc("fluxo_materializar", {
    p_tarefa: tarefa.id,
    p_linhas: lista.map(paraJson),
    p_usuario: usuarioId,
  })
  if (erroRpc) throw erroRpc
}

/** Grava a entrada no fluxo de muitas tarefas de uma vez (lotes de 200). */
export async function materializarLote(
  itens: { tarefaId: string; linhas: LinhaFluxo[] }[],
  usuarioId: string
): Promise<number> {
  let gravadas = 0
  const ordenados = [...itens].sort((a, b) => a.tarefaId.localeCompare(b.tarefaId))
  for (let i = 0; i < ordenados.length; i += 200) {
    const lote = ordenados.slice(i, i + 200).map((it) => ({ tarefaId: it.tarefaId, linhas: it.linhas.map(paraJson) }))
    const { data, error } = await supabase.rpc("fluxo_materializar_lote", { p_lote: lote, p_usuario: usuarioId })
    if (error) throw error
    gravadas += Number(data ?? 0)
  }
  return gravadas
}
