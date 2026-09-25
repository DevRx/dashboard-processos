import { createHash } from "node:crypto"
import type { TimeTarefa } from "@/lib/domain/tarefa"

/**
 * Do backup do TickTick para as tarefas do escritório.
 *
 * O TickTick exporta um CSV com um preâmbulo de quatro linhas antes do
 * cabeçalho e conteúdo com quebra de linha dentro das aspas — por isso
 * o leitor aqui é próprio, e não um `split("\n")`.
 *
 * Nada é descartado: tarefa concluída entra concluída, abandonada entra
 * cancelada. O quadro mostra só o que está em aberto; o resto fica
 * para a agenda e para o histórico de quem quiser conferir.
 */

export type LinhaTickTick = Record<string, string>

export type TarefaImportada = {
  origem_id: string
  titulo: string
  descricao: string | null
  data: string
  hora: string | null
  status: "PENDENTE" | "CONCLUIDA" | "CANCELADA"
  prioridade: "BAIXA" | "MEDIA" | "ALTA" | "URGENTE"
  setor: TimeTarefa | null
  pasta: string | null
  created_at: string
}

/** CSV no formato RFC 4180: aspas duplas escapam aspas, e protegem vírgula e quebra de linha. */
export function lerCsv(texto: string): string[][] {
  const linhas: string[][] = []
  let campo = ""
  let linha: string[] = []
  let entreAspas = false

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]

    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          entreAspas = false
        }
      } else {
        campo += c
      }
      continue
    }

    if (c === '"') entreAspas = true
    else if (c === ",") {
      linha.push(campo)
      campo = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ""
    } else campo += c
  }

  if (campo !== "" || linha.length > 0) {
    linha.push(campo)
    linhas.push(linha)
  }

  return linhas
}

/** As linhas de tarefa, já com o nome da coluna. O preâmbulo fica para trás. */
export function linhasDoBackup(texto: string): LinhaTickTick[] {
  const tabela = lerCsv(texto.replace(/^﻿/, ""))
  const inicio = tabela.findIndex((l) => l[0] === "Folder Name" && l.includes("Title"))
  if (inicio === -1) {
    throw new Error("Não parece um backup do TickTick: falta o cabeçalho com \"Folder Name\" e \"Title\".")
  }

  const cabecalho = tabela[inicio]
  return tabela
    .slice(inicio + 1)
    .filter((l) => l.length >= cabecalho.length - 1)
    .map((l) => Object.fromEntries(cabecalho.map((nome, i) => [nome, l[i] ?? ""])))
}

// ── Time ─────────────────────────────────────────────────────────────

/**
 * No TickTick do escritório o time está na cor: 🔴 Zeca, 🔵 Tay,
 * 🌕/🟡 Guilherme e Camille. A coluna do kanban vale mais que a lista —
 * "TAREFAS ZECA 🔴" com coluna "AZUL 🔵" é tarefa que o Zeca passou para
 * a Tay. Sem cor em lugar nenhum (Cobrança, Inbox), fica sem time.
 */
function timeDe(texto: string): TimeTarefa | null {
  const t = texto.toUpperCase()
  if (!t.trim()) return null
  if (t.includes("🔵") || /\bAZUL\b/.test(t) || /\bTAY\b/.test(t)) return "AZUL"
  if (t.includes("🌕") || t.includes("🟡") || /\bAMARELO\b/.test(t)) return "AMARELO"
  if (t.includes("🔴") || /\bVERMELHO\b/.test(t) || /\bZECA\b/.test(t) || t.includes("ZÉ ")) return "VERMELHO"
  if (t.includes("⚫") || /\bPRETO\b/.test(t) || /\bRYAN\b/.test(t)) return "PRETO"
  return null
}

export function timeDaLinha(l: LinhaTickTick): TimeTarefa | null {
  return timeDe(l["Column Name"]) ?? timeDe(l["List Name"]) ?? timeDe(l["Folder Name"])
}

// ── Pasta ────────────────────────────────────────────────────────────

function limpar(nome: string) {
  return nome
    .replace(/[\p{Extended_Pictographic}\u{1F300}-\u{1FAFF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, "")
    .replace(/\s+/g, " ")
    .replace(/[.\s]+$/, "")
    .trim()
}

/**
 * Nome que só diz o time não vira pasta: o time já está na cor, e
 * "AMARELO › ACOMPANHAMENTO" dentro da coluna amarela repete o óbvio.
 */
function soDizOTime(nome: string) {
  const c = limpar(nome).toUpperCase()
  return (
    !c ||
    c === "NÃO CLASSIFICADO" ||
    ["AZUL", "AMARELO", "VERMELHO", "PRETO", "TAY", "ZECA", "RYAN", "AUTO TAREFAS"].includes(c)
  )
}

/** "CONCESSÃO 🟡" + "COM DATA-URGENTE" → "CONCESSÃO › COM DATA-URGENTE". */
export function pastaDaLinha(l: LinhaTickTick): string | null {
  const partes = [l["Folder Name"], l["List Name"], l["Column Name"]]
    .filter((p) => !soDizOTime(p))
    .map(limpar)

  const unicas = partes.filter((p, i) => partes.indexOf(p) === i)
  return unicas.length ? unicas.join(" › ") : null
}

// ── Datas ────────────────────────────────────────────────────────────

/** "2026-09-16T03:00:00+0000" → Date. O TickTick escreve o fuso sem os dois-pontos. */
function instante(valor: string): Date | null {
  if (!valor) return null
  const d = new Date(valor.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Data e hora como a pessoa via no TickTick, no fuso dela. */
function local(d: Date, fuso: string) {
  let partes: Intl.DateTimeFormatPart[]
  try {
    partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: fuso || "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(d)
  } catch {
    return local(d, "America/Sao_Paulo")
  }
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]))
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` }
}

// ── Texto ────────────────────────────────────────────────────────────

/**
 * O conteúdo vem em markdown do TickTick. Anexo vira "📎 nome.pdf" — o
 * arquivo em si ficou no TickTick, e um link quebrado aqui prometeria
 * o que não existe. As barras que o TickTick põe antes de pontuação
 * (`\*`, `\(`) saem.
 */
export function textoDoConteudo(conteudo: string) {
  return conteudo
    .replace(/\r\n?/g, "\n")
    .replace(/!\[(?:file|image)\]\(([^)]*)\)/g, (_, caminho: string) => {
      const nome = caminho.split("/").pop() ?? caminho
      try {
        return `\n📎 ${decodeURIComponent(nome)}\n`
      } catch {
        return `\n📎 ${nome}\n`
      }
    })
    .replace(/\\([\\`*_{}[\]()#+\-.!|~>])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

// ── Linha → tarefa ───────────────────────────────────────────────────

const STATUS: Record<string, TarefaImportada["status"]> = {
  "0": "PENDENTE",
  "1": "PENDENTE",
  "2": "CONCLUIDA",
  "-1": "CANCELADA",
}

function prioridadeDe(l: LinhaTickTick): TarefaImportada["prioridade"] {
  const etiquetas = l["Tags"].toUpperCase()
  if (/\bURGENTE\b/.test(etiquetas)) return "URGENTE"
  if (l["Priority"] === "5") return "ALTA"
  if (l["Priority"] === "1") return "BAIXA"
  return "MEDIA"
}

/**
 * O id que o TickTick põe no backup é a posição na planilha — muda a
 * cada exportação. Estável é o que a tarefa tem desde que nasceu: quando
 * foi criada, onde, e com que título.
 */
function origemDe(l: LinhaTickTick) {
  const chave = [l["Created Time"], l["Folder Name"], l["List Name"], l["Title"]].join("|")
  return "ticktick:" + createHash("sha1").update(chave).digest("hex").slice(0, 20)
}

export function tarefaDaLinha(
  l: LinhaTickTick,
  tituloPorId: Map<string, string>
): TarefaImportada {
  const fuso = l["Timezone"]
  const prazo =
    instante(l["Due Date"]) ??
    instante(l["Start Date"]) ??
    instante(l["Completed Time"]) ??
    instante(l["Created Time"]) ??
    new Date()
  const quando = local(prazo, fuso)
  const diaInteiro = l["Is All Day"] !== "false"

  const cabeca: string[] = []
  const etiquetas = l["Tags"]
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
  if (etiquetas.length) cabeca.push(`Etiquetas: ${etiquetas.map((t) => "#" + t).join(" ")}`)
  const mae = l["parentId"] ? tituloPorId.get(l["parentId"]) : undefined
  if (mae) cabeca.push(`Subtarefa de: ${mae}`)

  const corpo = textoDoConteudo(l["Content"])
  const descricao = [cabeca.join("\n"), corpo].filter(Boolean).join("\n\n")

  const titulo = l["Title"].trim() || corpo.split("\n")[0]?.slice(0, 120) || "(sem título no TickTick)"

  return {
    origem_id: origemDe(l),
    titulo,
    descricao: descricao || null,
    data: quando.data,
    hora: diaInteiro ? null : quando.hora,
    status: STATUS[l["Status"]] ?? "PENDENTE",
    prioridade: prioridadeDe(l),
    setor: timeDaLinha(l),
    pasta: pastaDaLinha(l),
    created_at: (instante(l["Created Time"]) ?? new Date()).toISOString(),
  }
}

export function tarefasDoBackup(texto: string): TarefaImportada[] {
  const linhas = linhasDoBackup(texto)
  const tituloPorId = new Map(linhas.map((l) => [l["taskId"], l["Title"]]))
  const vistas = new Map<string, number>()

  return linhas.map((l) => {
    const tarefa = tarefaDaLinha(l, tituloPorId)
    // Tarefa repetida de verdade — mesmo título, mesma lista, criada no
    // mesmo segundo — existe no backup. Entram todas: a ordem entre as
    // gêmeas é a da planilha, que se mantém de uma exportação à outra.
    const n = vistas.get(tarefa.origem_id) ?? 0
    vistas.set(tarefa.origem_id, n + 1)
    return n === 0 ? tarefa : { ...tarefa, origem_id: `${tarefa.origem_id}-${n + 1}` }
  })
}
