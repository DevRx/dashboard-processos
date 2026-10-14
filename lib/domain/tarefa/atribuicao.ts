// ─────────────────────────────────────────────────────────
// Domínio: onde a tarefa está e com quem
//
// No fluxo novo a tarefa pode estar em mais de um lugar ao mesmo tempo
// (o cliente do ADM que também está no Judicial) e cada lugar pode ter
// mais de um responsável. Cada par "lugar × pessoa" é uma atribuição —
// uma linha de `tarefa_atribuicoes` (ver a migration
// 20261013200000_fluxo_atribuicoes.sql).
//
// O cartão que aparece numa coluna é um grupo: todas as atribuições
// abertas da tarefa naquele time e naquela etapa. Ele fica na coluna
// enquanto houver ALGUMA parte aberta — concluir a parte de um
// responsável não tira o cartão dos outros.
//
// Tarefa que ainda não tem nenhuma linha gravada segue a pasta do
// TickTick: as atribuições dela são calculadas aqui (`virtual`), do
// mesmo jeito que o servidor as grava quando ela entra no fluxo.
// ─────────────────────────────────────────────────────────

import { ETAPAS, destinoNoFluxo, etapaDaTarefa, type EtapaId, type TarefaNoFluxo } from "./fluxo"
import { isTimeTarefa, type TimeTarefa } from "./time"

export type MotivoFim = "CONCLUIDA" | "MOVIDA" | "REMOVIDA" | "TAREFA_FECHADA"

export type Atribuicao = {
  id: string
  tarefaId: string
  setor: TimeTarefa
  etapa: EtapaId | null
  responsavelId: string | null
  criadaEm: string
  fimEm: string | null
  fimPor: string | null
  fimMotivo: MotivoFim | null
  /** Calculada pela pasta do TickTick, ainda não gravada. */
  virtual?: boolean
}

/** O que basta para pôr uma tarefa no fluxo: lugar e pessoa. */
export type LinhaFluxo = {
  setor: TimeTarefa
  etapa: EtapaId | null
  responsavelId: string | null
}

export type TarefaComLugar = TarefaNoFluxo & {
  id: string
  status?: string | null
  responsavelId?: string | null
  createdAt?: string | null
  atribuicoes?: Atribuicao[] | null
}

/**
 * Onde a pasta do TickTick põe a tarefa no fluxo novo. É a regra da
 * entrada no fluxo — usada na tela (enquanto nada foi gravado) e no
 * servidor (quando grava). Tarefa sem time não entra.
 */
export function linhasPelaPasta(t: TarefaComLugar): LinhaFluxo[] {
  const destino = destinoNoFluxo(t)
  if (destino) {
    return [{ setor: ETAPAS[destino].time, etapa: destino, responsavelId: t.responsavelId ?? null }]
  }
  if (!isTimeTarefa(t.setor)) return []
  return [{ setor: t.setor, etapa: etapaDaTarefa(t), responsavelId: t.responsavelId ?? null }]
}

/** As atribuições da tarefa: as gravadas ou, sem nenhuma, as da pasta. */
export function atribuicoesDa(t: TarefaComLugar): Atribuicao[] {
  if (t.atribuicoes && t.atribuicoes.length > 0) return t.atribuicoes
  if (t.status === "CONCLUIDA" || t.status === "CANCELADA") return []
  return linhasPelaPasta(t).map((l, i) => ({
    id: `virtual:${t.id}:${i}`,
    tarefaId: t.id,
    setor: l.setor,
    etapa: l.etapa,
    responsavelId: l.responsavelId,
    criadaEm: t.createdAt ?? "1970-01-01T00:00:00Z",
    fimEm: null,
    fimPor: null,
    fimMotivo: null,
    virtual: true,
  }))
}

/** Um cartão numa coluna: a tarefa naquele time e naquela etapa. */
export type Grupo = {
  chave: string
  tarefaId: string
  setor: TimeTarefa
  etapa: EtapaId | null
  /** Partes ainda por fazer — uma por responsável (ou a vaga sem nome). */
  abertas: Atribuicao[]
  /** Quem já fez a sua parte nesta passagem pela etapa. */
  feitas: Atribuicao[]
}

export function chaveDoGrupo(tarefaId: string, setor: string, etapa: string | null) {
  return `${tarefaId}|${setor}|${etapa ?? ""}`
}

/**
 * Os cartões da tarefa: um por lugar em que ela tem parte aberta.
 *
 * "Feitas" são as partes concluídas no mesmo lugar durante a passagem
 * atual — a partir de quando a parte aberta mais antiga dali entrou.
 * Uma passagem antiga pela mesma etapa (a tarefa foi e voltou) não
 * conta.
 */
export function gruposDa(atribuicoes: Atribuicao[]): Grupo[] {
  const porChave = new Map<string, Grupo>()

  for (const a of atribuicoes) {
    if (a.fimEm) continue
    const chave = chaveDoGrupo(a.tarefaId, a.setor, a.etapa)
    const g = porChave.get(chave) ?? {
      chave,
      tarefaId: a.tarefaId,
      setor: a.setor,
      etapa: a.etapa,
      abertas: [],
      feitas: [],
    }
    g.abertas.push(a)
    porChave.set(chave, g)
  }

  for (const g of porChave.values()) {
    g.abertas.sort((x, y) => x.criadaEm.localeCompare(y.criadaEm) || x.id.localeCompare(y.id))
    const entrada = Date.parse(g.abertas[0].criadaEm) - 5000
    g.feitas = atribuicoes.filter(
      (a) =>
        a.fimMotivo === "CONCLUIDA" &&
        chaveDoGrupo(a.tarefaId, a.setor, a.etapa) === g.chave &&
        Date.parse(a.criadaEm) >= entrada
    )
  }

  return [...porChave.values()].sort(
    (a, b) => a.abertas[0].criadaEm.localeCompare(b.abertas[0].criadaEm) || a.chave.localeCompare(b.chave)
  )
}

/** Os lugares em que a tarefa está, fora o informado — "também no Judicial". */
export function outrosLugares(grupos: Grupo[], atual: Grupo): Grupo[] {
  return grupos.filter((g) => g.chave !== atual.chave)
}

// ── Quem responde por cada etapa ──────────────────────────

/**
 * Os nomes do desenho ("Claude e Tayane") ligados às contas do sistema.
 * Procura pelo primeiro nome, pelo começo do e-mail e, para o Zeca,
 * também por "José Carlos". Quem não tem conta fica de fora — a etapa
 * então mantém os responsáveis que a tarefa já tinha.
 */
const APELIDOS: Record<string, string[]> = {
  zeca: ["zeca", "jose carlos"],
  claude: ["claude"],
  tayane: ["tayane", "tay"],
  guilherme: ["guilherme", "gui"],
  ryan: ["ryan"],
}

function semAcento(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

export type UsuarioDoFluxo = { id: string; name: string; email?: string | null }

/** As chaves de pessoa de uma etapa, tiradas do texto "Claude e Tayane". */
export function pessoasDaEtapa(id: EtapaId): string[] {
  return semAcento(ETAPAS[id].responsaveis)
    .split(/\s+e\s+|,|\//)
    .map((p) => p.trim())
    .filter(Boolean)
}

export function usuarioDaPessoa(pessoa: string, usuarios: UsuarioDoFluxo[]): UsuarioDoFluxo | null {
  const apelidos = APELIDOS[pessoa] ?? [pessoa]
  const ordenados = [...usuarios].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  for (const apelido of apelidos) {
    const achado = ordenados.find((u) => {
      const nome = semAcento(u.name)
      const email = semAcento(u.email ?? "").split("@")[0]
      return nome === apelido || nome.startsWith(`${apelido} `) || email === apelido || email.startsWith(apelido)
    })
    if (achado) return achado
  }
  return null
}

/**
 * Os responsáveis que a etapa indica, já como contas do sistema — ou
 * `null` se nenhum nome do desenho tem conta aqui.
 */
export function responsaveisPadrao(id: EtapaId, usuarios: UsuarioDoFluxo[]): string[] | null {
  const ids = pessoasDaEtapa(id)
    .map((p) => usuarioDaPessoa(p, usuarios)?.id)
    .filter((x): x is string => Boolean(x))
  const unicos = [...new Set(ids)]
  return unicos.length ? unicos : null
}
