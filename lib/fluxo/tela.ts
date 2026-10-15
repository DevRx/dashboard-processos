import "server-only"

import { supabase } from "@/lib/supabase/server"
import { idsDoEscritorio } from "@/lib/escritorio"
import { faltaMigration } from "@/lib/fluxo/servidor"
import type { Atribuicao } from "@/lib/domain/tarefa"

/**
 * A tela dos times em uma ida ao banco.
 *
 * A função `fluxo_tela` (migration 20261015030000) devolve as tarefas
 * abertas já com as partes do fluxo, o responsável, o processo e o
 * vínculo com o DJEN — o que antes eram 13 chamadas (tarefas paginadas,
 * atribuições paginadas, equipe, intimações) vira uma.
 *
 * `desde` traz só o que mudou depois daquele instante, INCLUSIVE as
 * tarefas que fecharam: é como a tela se atualiza sem baixar tudo de
 * novo. `ids` traz só aquelas tarefas, abertas ou não — a resposta de
 * uma ação. Os outros filtros servem o conector do Claude, que antes
 * baixava a lista inteira para achar cinquenta.
 *
 * Devolve `null` quando a função ainda não existe no banco: quem chama
 * cai no caminho antigo, e nada para de funcionar antes da migration.
 */

export type FiltrosTela = {
  ids?: string[]
  desde?: string | null
  responsavel?: string | null
  setor?: string | null
  etapa?: string | null
  busca?: string | null
  limite?: number | null
}

export type TarefaDaTela = Record<string, unknown> & {
  id: string
  status: string
  deIntimacao: boolean
  atribuicoes: Atribuicao[]
}

export type Tela = { tarefas: TarefaDaTela[]; agora: string }

/**
 * Margem na recarga por `desde`: uma gravação que começou antes da
 * leitura anterior e terminou depois dela ficaria com `updated_at`
 * anterior ao `agora` daquela leitura. Pedir cinco segundos a mais
 * repete umas poucas tarefas — que a tela só sobrescreve — e não perde
 * nenhuma.
 */
const MARGEM_MS = 5000

export async function telaDoFluxo(filtros: FiltrosTela = {}): Promise<Tela | null> {
  const escritorio = await idsDoEscritorio()
  const desde = filtros.desde ? new Date(new Date(filtros.desde).getTime() - MARGEM_MS).toISOString() : null

  const { data, error } = await supabase.rpc("fluxo_tela", {
    p_usuarios: escritorio,
    p_ids: filtros.ids?.length ? filtros.ids : null,
    p_desde: desde,
    p_responsavel: filtros.responsavel ?? null,
    p_setor: filtros.setor ?? null,
    p_etapa: filtros.etapa ?? null,
    p_busca: filtros.busca ?? null,
    p_limite: filtros.limite ?? null,
  })

  if (error) {
    if (faltaMigration(error) || /fluxo_tela/.test(error.message ?? "")) return null
    throw error
  }

  const tela = (data ?? {}) as { tarefas?: TarefaDaTela[]; agora?: string }
  const tarefas = (tela.tarefas ?? []).map((t) => {
    // A função não repete o id da tarefa em cada parte; o domínio lê.
    const atribuicoes = (t.atribuicoes ?? []).map((a) => ({ ...a, tarefaId: t.id }))
    return { ...t, atribuicoes }
  })
  return { tarefas, agora: tela.agora ?? new Date().toISOString() }
}

/**
 * Uma tarefa só, do jeito que a tela lê. `null` quando não existe;
 * `undefined` quando a função ainda não está no banco (vale o caminho
 * antigo).
 */
export async function tarefaDaTela(id: string): Promise<TarefaDaTela | null | undefined> {
  const tela = await telaDoFluxo({ ids: [id] })
  if (!tela) return undefined
  return tela.tarefas[0] ?? null
}
