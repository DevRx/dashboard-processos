import "server-only"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { supabase } from "@/lib/supabase/server"
import type { CurrentUser } from "@/lib/auth"
import { idsDoEscritorio } from "@/lib/escritorio"
import { toCamelCase } from "@/lib/utils"
import {
  ESFERA_AMARELO_LABEL,
  ETAPAS,
  ETAPAS_DO_TIME,
  TIMES_TAREFA,
  TIME_LABEL,
  atribuicoesDa,
  gruposDa,
  tarefaCombina,
  termosDaBusca,
  usuarioDaPessoa,
  type Atribuicao,
  type EtapaId,
  type Grupo,
  type TarefaComLugar,
  type TimeTarefa,
  type UsuarioDoFluxo,
} from "@/lib/domain/tarefa"
import { atribuicoesDaTarefa, usuariosDoFluxo } from "@/lib/fluxo/servidor"
import { avisoAoClienteLiberado } from "@/lib/configuracoes"
import { abrirDuvida, agirNoFluxo, criarTarefa, nasceuDeIntimacao, tarefasAbertasComFluxo, type Resultado } from "@/lib/tarefas/servico"
import { tarefaDaTela } from "@/lib/fluxo/tela"

/**
 * O conector do Claude: as ferramentas que ele usa para trabalhar nas
 * tarefas do sistema como um responsável da equipe.
 *
 * Cada ferramenta chama a mesma regra que as telas usam
 * (lib/tarefas/servico.ts), em nome da conta dona da chave. O Claude
 * não tem poder a mais que a equipe: não apaga tarefa, não mexe em
 * quem é administrador, não vê outro escritório.
 *
 * Os nomes e as descrições estão em português e dizem o que cada coisa
 * faz no fluxo do escritório, porque quem lê é o modelo — e é por elas
 * que ele decide o que chamar.
 */

const ETAPA_IDS = Object.keys(ETAPAS) as [EtapaId, ...EtapaId[]]
const EtapaId = z.enum(ETAPA_IDS)
const Time = z.enum(TIMES_TAREFA)
const Prioridade = z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"])

/** Hoje em Brasília (o servidor roda em UTC). */
function hoje() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
}

function semAcento(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

function nomeDaEtapa(id: EtapaId) {
  const e = ETAPAS[id]
  return e.esfera ? `${ESFERA_AMARELO_LABEL[e.esfera]} › ${e.nome}` : e.nome
}

function nomeDoLugar(setor: TimeTarefa, etapa: EtapaId | null) {
  return etapa ? `${TIME_LABEL[setor]} › ${nomeDaEtapa(etapa)}` : `${TIME_LABEL[setor]} (sem etapa)`
}

function texto(dados: unknown) {
  return { content: [{ type: "text" as const, text: typeof dados === "string" ? dados : JSON.stringify(dados) }] }
}

function falhou(mensagem: string) {
  return { content: [{ type: "text" as const, text: mensagem }], isError: true }
}

function doResultado(r: Resultado, resumir?: (corpo: Record<string, unknown>) => unknown) {
  if (r.status >= 400) return falhou(String(r.corpo.error ?? `Erro ${r.status}`))
  return texto(resumir ? resumir(r.corpo) : r.corpo)
}

/**
 * Nomes da equipe → contas. Aceita "eu", o primeiro nome ("Tayane",
 * "Tay"), o apelido do desenho ("Zeca") ou o id da conta.
 */
function resolverPessoas(
  nomes: string[],
  equipe: UsuarioDoFluxo[],
  eu: CurrentUser
): { ids: string[] } | { erro: string } {
  const ids: string[] = []
  const desconhecidos: string[] = []
  for (const bruto of nomes) {
    const nome = bruto.trim()
    if (!nome) continue
    if (semAcento(nome) === "eu") {
      ids.push(eu.id)
      continue
    }
    const porId = equipe.find((u) => u.id === nome)
    const achado = porId ?? usuarioDaPessoa(semAcento(nome), equipe)
    if (achado) ids.push(achado.id)
    else desconhecidos.push(nome)
  }
  if (desconhecidos.length) {
    return {
      erro: `Não achei na equipe: ${desconhecidos.join(", ")}. A equipe é: ${equipe.map((u) => u.name).join(", ")}.`,
    }
  }
  return { ids: [...new Set(ids)] }
}

type TarefaLida = Record<string, unknown> & {
  id: string
  titulo: string
  tipo?: string | null
  status?: string | null
  setor?: string | null
  pasta?: string | null
  data?: string | null
  hora?: string | null
  prioridade?: string | null
  responsavelId?: string | null
  createdAt?: string | null
  deIntimacao?: boolean
  atribuicoes?: Atribuicao[]
  responsavel?: { name: string } | null
  processo?: { beneficio?: string | null; numero?: string | null } | null
}

function gruposDaTarefa(t: TarefaLida): Grupo[] {
  return gruposDa(atribuicoesDa(t as TarefaComLugar))
}

function descreverGrupo(g: Grupo, equipe: UsuarioDoFluxo[]) {
  const nome = (id: string | null) => (id ? (equipe.find((u) => u.id === id)?.name ?? "conta removida") : "sem responsável")
  return {
    time: g.setor,
    etapa: g.etapa,
    lugar: nomeDoLugar(g.setor, g.etapa),
    responsaveis: g.abertas.map((a) => nome(a.responsavelId)),
    jaFizeram: g.feitas.map((a) => nome(a.responsavelId)),
    bastaUm: g.etapa ? Boolean(ETAPAS[g.etapa].bastaUm) : false,
    gravadoNoFluxo: !g.abertas.some((a) => a.virtual),
  }
}

/** A tarefa do escritório, com onde ela está agora. */
async function lerTarefa(id: string): Promise<TarefaLida | null> {
  // Uma ida só, quando a função da tela existe.
  const pronta = await tarefaDaTela(id)
  if (pronta !== undefined) return pronta as TarefaLida | null

  const escritorio = await idsDoEscritorio()
  const { data } = await supabase
    .from("tarefas")
    .select("*, processo:processos(beneficio, numero), responsavel:users!tarefas_responsavel_id_fkey(id, name)")
    .eq("id", id)
    .in("user_id", escritorio)
    .maybeSingle()
  if (!data) return null
  const t = toCamelCase(data) as TarefaLida
  t.atribuicoes = await atribuicoesDaTarefa(id).catch(() => [])
  t.deIntimacao = await nasceuDeIntimacao(id)
  return t
}

/** O lugar de onde a tarefa sai: o pedido, ou o único em que ela está. */
function lugarDeOrigem(
  t: TarefaLida,
  de: EtapaId | "sem-etapa" | undefined,
  timeDe: TimeTarefa | undefined
): { setor: TimeTarefa; etapa: EtapaId | null } | { erro: string } {
  const grupos = gruposDaTarefa(t)
  if (!grupos.length) return { erro: "A tarefa não está em nenhum time do fluxo." }

  if (de === undefined) {
    if (grupos.length === 1) return { setor: grupos[0].setor, etapa: grupos[0].etapa }
    return {
      erro: `A tarefa está em mais de um lugar (${grupos.map((g) => nomeDoLugar(g.setor, g.etapa)).join("; ")}). Diga de qual etapa ela sai em "de".`,
    }
  }
  if (de === "sem-etapa") {
    const candidatos = grupos.filter((g) => g.etapa === null && (!timeDe || g.setor === timeDe))
    if (candidatos.length === 1) return { setor: candidatos[0].setor, etapa: null }
    return { erro: "Diga o time em \"time_de\": a tarefa está sem etapa em mais de um time, ou em nenhum." }
  }
  const g = grupos.find((x) => x.etapa === de)
  if (!g) {
    return { erro: `A tarefa não está em ${nomeDoLugar(ETAPAS[de].time, de)}. Está em: ${grupos.map((x) => nomeDoLugar(x.setor, x.etapa)).join("; ")}.` }
  }
  return { setor: g.setor, etapa: g.etapa }
}

function resumoDaTarefa(t: TarefaLida, equipe: UsuarioDoFluxo[]) {
  const data = t.data ?? null
  return {
    id: t.id,
    titulo: t.titulo,
    data,
    hora: t.hora ?? null,
    prioridade: t.prioridade ?? null,
    atrasada: Boolean(data && data < hoje()),
    pasta: t.pasta ?? null,
    processo: t.processo?.numero ? `${t.processo.numero}${t.processo.beneficio ? ` (${t.processo.beneficio})` : ""}` : null,
    deIntimacao: Boolean(t.deIntimacao),
    lugares: gruposDaTarefa(t).map((g) => descreverGrupo(g, equipe)),
  }
}

const REGRAS_GERAIS = [
  "Cada time é uma cor; cada etapa tem os responsáveis do desenho do escritório.",
  "Uma tarefa pode estar em mais de um lugar ao mesmo tempo (ex.: Administrativo e Judicial) e pode voltar no fluxo.",
  "Com mais de um responsável numa etapa, cada um conclui a sua parte e a tarefa continua para os outros; ela só sai da etapa quando o último concluir. Exceção: etapas marcadas \"basta um\" (a entrega do rosa) — quem conclui encerra para todos.",
  "Tarefa que ainda segue a pasta do TickTick aparece como \"gravadoNoFluxo: false\"; a primeira ação grava ela no fluxo.",
  "Nada aqui escreve no TickTick.",
  "Perícia e audiência lidas das intimações viram duas tarefas: a do evento, em Vermelho › Andamentos (no dia e na hora), e \"Avisar cliente\", em Amarelo › Judicial › Andamentos (na véspera, com a mensagem pronta). O envio da mensagem ao cliente só acontece se avisos_pendentes disser que está liberado — nunca por conta própria.",
]

export function servidorDoClaude(eu: CurrentUser): McpServer {
  const servidor = new McpServer(
    { name: "dashboard-processos", version: "1.0.0" },
    {
      instructions:
        `Sistema de tarefas do escritório do Zeca (previdenciário). Você está conectado como "${eu.name}". ` +
        "Use fluxo_do_escritorio para conhecer times, etapas e regras antes de mover tarefas. " +
        "Mensagens a clientes não saem daqui: este conector só mexe nas tarefas.",
    }
  )

  servidor.registerTool(
    "fluxo_do_escritorio",
    {
      title: "Fluxo do escritório",
      description:
        "Os times (vermelho, azul, amarelo, rosa), as etapas de cada um com o id, quem responde, o que acontece ali e para onde a tarefa vai depois. Leia antes de mover tarefas.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const equipe = await usuariosDoFluxo()
      const linhas: string[] = ["# Fluxo do escritório", "", ...REGRAS_GERAIS.map((r) => `- ${r}`), ""]
      for (const time of TIMES_TAREFA) {
        linhas.push(`## ${TIME_LABEL[time]} (${time})`)
        for (const id of ETAPAS_DO_TIME[time]) {
          const e = ETAPAS[id]
          linhas.push(`### ${nomeDaEtapa(id)} — id \`${id}\``)
          linhas.push(`Responsáveis: ${e.responsaveis}${e.bastaUm ? " (basta um concluir)" : ""}`)
          if (e.campo) linhas.push(`O cartão precisa dizer: ${e.campo}`)
          for (const r of e.regras) linhas.push(`- ${r}`)
          for (const s of e.saidas) linhas.push(`→ ${s.quando}: vai para ${nomeDoLugar(ETAPAS[s.para].time, s.para)} (\`${s.para}\`)`)
          linhas.push("")
        }
      }
      linhas.push(`Equipe com conta no sistema: ${equipe.map((u) => u.name).join(", ")}.`)
      return texto(linhas.join("\n"))
    }
  )

  servidor.registerTool(
    "listar_tarefas",
    {
      title: "Listar tarefas abertas",
      description:
        "Tarefas em aberto, com o lugar no fluxo (time e etapa) e os responsáveis de cada lugar. Por padrão, só as que estão com você.",
      inputSchema: {
        de_quem: z
          .string()
          .optional()
          .describe('"eu" (padrão) = onde você é responsável; "todos" = qualquer um; ou o nome de alguém da equipe ("Tayane").'),
        time: Time.optional().describe("Só deste time."),
        etapa: EtapaId.optional().describe("Só desta etapa (id de fluxo_do_escritorio)."),
        busca: z.string().optional().describe('Palavras do título, texto, pasta ou CPF ("maria 1551").'),
        limite: z.number().int().min(1).max(200).optional().describe("Máximo de tarefas (padrão 50)."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ de_quem, time, etapa, busca, limite }) => {
      const equipe = await usuariosDoFluxo()
      let pessoa: string | null = eu.id
      const quem = (de_quem ?? "eu").trim()
      if (semAcento(quem) === "todos") pessoa = null
      else if (semAcento(quem) !== "eu") {
        const r = resolverPessoas([quem], equipe, eu)
        if ("erro" in r) return falhou(r.erro)
        pessoa = r.ids[0]
      }

      const termos = busca ? termosDaBusca(busca) : []
      // Filtrado no banco (lib/fluxo/tela.ts); o filtro abaixo só
      // confirma, e é o que vale quando a função ainda não existe.
      const max = limite ?? 50
      // O banco já corta na quantidade pedida (com folga para o filtro abaixo).
      const todas = (await tarefasAbertasComFluxo({ responsavel: pessoa, setor: time ?? null, etapa: etapa ?? null, busca: busca ?? null, limite: max * 2 + 50 })) as TarefaLida[]
      const achadas = todas.filter((t) => {
        if (t.tipo === "DUVIDA") return false
        if (termos.length && !tarefaCombina({ ...t, titulo: t.titulo }, termos)) return false
        return gruposDaTarefa(t).some(
          (g) =>
            (!time || g.setor === time) &&
            (!etapa || g.etapa === etapa) &&
            (!pessoa || g.abertas.some((a) => a.responsavelId === pessoa))
        )
      })

      return texto({
        total: achadas.length,
        ...(todas.length >= max * 2 + 50 ? { totalCortadoEm: todas.length } : {}),
        mostrando: Math.min(max, achadas.length),
        hoje: hoje(),
        tarefas: achadas.slice(0, max).map((t) => resumoDaTarefa(t, equipe)),
      })
    }
  )

  servidor.registerTool(
    "ver_tarefa",
    {
      title: "Ver uma tarefa",
      description: "Tudo de uma tarefa: texto, onde está no fluxo, o caminho que ela já fez e as dúvidas abertas sobre ela.",
      inputSchema: { id: z.string().describe("Id da tarefa.") },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const t = await lerTarefa(id)
      if (!t) return falhou("Tarefa não encontrada.")
      const equipe = await usuariosDoFluxo()
      const nome = (uid: string | null) => (uid ? (equipe.find((u) => u.id === uid)?.name ?? "conta removida") : "sem responsável")

      const { data: duvidas } = await supabase
        .from("tarefas")
        .select("id, titulo, status, resposta, respondida_em, responsavel_id")
        .eq("tarefa_pai_id", id)
        .order("created_at", { ascending: true })

      return texto({
        ...resumoDaTarefa(t, equipe),
        status: t.status,
        descricao: t.descricao ?? null,
        caminho: (t.atribuicoes ?? []).map((a) => ({
          lugar: nomeDoLugar(a.setor, a.etapa),
          responsavel: nome(a.responsavelId),
          entrou: a.criadaEm,
          saiu: a.fimEm,
          como: a.fimMotivo,
          por: a.fimPor ? nome(a.fimPor) : null,
        })),
        duvidas: (duvidas ?? []).map((d) => ({
          id: d.id,
          pergunta: d.titulo,
          para: nome(d.responsavel_id),
          resposta: d.resposta,
          respondidaEm: d.respondida_em,
        })),
      })
    }
  )

  servidor.registerTool(
    "criar_tarefa",
    {
      title: "Criar tarefa no fluxo",
      description:
        "Cria uma tarefa já numa etapa do fluxo. Sem responsáveis, valem os da etapa. Para rotinas: mande chave_externa (ex.: o id da intimação) e o pedido repetido não duplica a tarefa.",
      inputSchema: {
        titulo: z.string().min(1).max(300).describe('Como a equipe escreve: "NOME DO CLIENTE 1234 — o que é".'),
        etapa: EtapaId.describe("Etapa onde a tarefa nasce (id de fluxo_do_escritorio)."),
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Prazo, AAAA-MM-DD. Padrão: hoje."),
        hora: z.string().regex(/^\d{2}:\d{2}$/).optional().describe("HH:MM, se tiver hora marcada."),
        descricao: z.string().max(5000).optional().describe("O que precisa ser feito; processo e CPF na primeira linha, se houver."),
        prioridade: Prioridade.optional(),
        responsaveis: z.array(z.string()).max(10).optional().describe('Nomes da equipe ("Zeca", "Tayane") ou "eu".'),
        chave_externa: z
          .string()
          .regex(/^[\w.:-]{1,120}$/)
          .optional()
          .describe('Identificador de onde a tarefa veio, para não duplicar ("djen-503112").'),
      },
    },
    async (args) => {
      const equipe = await usuariosDoFluxo()
      let responsaveis: string[] | undefined
      if (args.responsaveis?.length) {
        const r = resolverPessoas(args.responsaveis, equipe, eu)
        if ("erro" in r) return falhou(r.erro)
        responsaveis = r.ids
      }

      const origemId = args.chave_externa ? `claude:${args.chave_externa}` : undefined
      const r = await criarTarefa(
        eu,
        {
          titulo: args.titulo,
          etapa: args.etapa,
          data: args.data ?? hoje(),
          hora: args.hora,
          descricao: args.descricao,
          prioridade: args.prioridade ?? "MEDIA",
          ...(responsaveis ? { responsaveis } : {}),
        },
        { origemId }
      )

      if (r.status === 409 && origemId) {
        const { data } = await supabase.from("tarefas").select("id, titulo, status").eq("origem_id", origemId).maybeSingle()
        return texto({ jaExistia: true, tarefa: data })
      }
      return doResultado(r, (corpo) => {
        const t = corpo.tarefa as TarefaLida
        return { criada: true, tarefa: resumoDaTarefa(t, equipe) }
      })
    }
  )

  servidor.registerTool(
    "mover_tarefa",
    {
      title: "Mover tarefa no fluxo",
      description:
        "Leva a tarefa de uma etapa para outra (do mesmo time ou de outro), como os próximos passos do fluxo. Sem responsáveis, valem os da etapa de destino.",
      inputSchema: {
        id: z.string(),
        para: EtapaId.describe("Etapa de destino."),
        de: z
          .union([EtapaId, z.literal("sem-etapa")])
          .optional()
          .describe("Etapa de onde sai. Pode omitir se a tarefa está num lugar só."),
        time_de: Time.optional().describe('Só com de = "sem-etapa": o time de onde sai.'),
        responsaveis: z.array(z.string()).max(10).optional().describe("Quem responde no destino (nomes da equipe)."),
      },
    },
    async ({ id, para, de, time_de, responsaveis }) => {
      const t = await lerTarefa(id)
      if (!t) return falhou("Tarefa não encontrada.")
      const origem = lugarDeOrigem(t, de, time_de)
      if ("erro" in origem) return falhou(origem.erro)

      let ids: string[] | undefined
      if (responsaveis?.length) {
        const r = resolverPessoas(responsaveis, await usuariosDoFluxo(), eu)
        if ("erro" in r) return falhou(r.erro)
        ids = r.ids
      }

      const r = await agirNoFluxo(eu, id, {
        acao: "mover",
        de: origem,
        para: { setor: ETAPAS[para].time, etapa: para },
        ...(ids ? { responsaveis: ids } : {}),
      })
      const equipe = await usuariosDoFluxo()
      return doResultado(r, (corpo) => ({ movida: true, tarefa: resumoDaTarefa(corpo.tarefa as TarefaLida, equipe) }))
    }
  )

  servidor.registerTool(
    "por_tambem_em",
    {
      title: "Pôr a tarefa também em outro lugar",
      description:
        "Põe a tarefa numa segunda etapa sem tirar de onde está (o cliente do Administrativo que passa a estar também no Judicial).",
      inputSchema: {
        id: z.string(),
        etapa: EtapaId,
        responsaveis: z.array(z.string()).max(10).optional().describe("Nomes da equipe. Sem nomes, valem os da etapa."),
      },
    },
    async ({ id, etapa, responsaveis }) => {
      let ids: string[] | undefined
      if (responsaveis?.length) {
        const r = resolverPessoas(responsaveis, await usuariosDoFluxo(), eu)
        if ("erro" in r) return falhou(r.erro)
        ids = r.ids
      }
      const r = await agirNoFluxo(eu, id, {
        acao: "adicionar",
        para: { setor: ETAPAS[etapa].time, etapa },
        ...(ids ? { responsaveis: ids } : {}),
      })
      const equipe = await usuariosDoFluxo()
      return doResultado(r, (corpo) => ({ adicionada: true, tarefa: resumoDaTarefa(corpo.tarefa as TarefaLida, equipe) }))
    }
  )

  servidor.registerTool(
    "concluir_minha_parte",
    {
      title: "Concluir a minha parte",
      description:
        "Conclui a sua parte na tarefa. Se outros responsáveis ainda têm parte aberta, a tarefa continua para eles; ela fecha quando não sobra parte aberta em lugar nenhum. Para levar a tarefa à próxima etapa, use mover_tarefa.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const r = await agirNoFluxo(eu, id, { acao: "concluirMinhaParte" })
      const equipe = await usuariosDoFluxo()
      return doResultado(r, (corpo) => {
        const t = corpo.tarefa as TarefaLida
        return { concluida: true, statusDaTarefa: t.status, continuaEm: resumoDaTarefa(t, equipe).lugares }
      })
    }
  )

  servidor.registerTool(
    "trocar_responsaveis",
    {
      title: "Trocar os responsáveis de uma etapa",
      description: "Define quem responde pela tarefa numa etapa. Quem sai tem a parte encerrada como removida, não como concluída.",
      inputSchema: {
        id: z.string(),
        etapa: z.union([EtapaId, z.literal("sem-etapa")]).describe('Etapa (ou "sem-etapa").'),
        time: Time.optional().describe('Só com etapa = "sem-etapa".'),
        responsaveis: z.array(z.string()).max(10).describe("Nomes da equipe. Lista vazia deixa a etapa sem responsável."),
      },
    },
    async ({ id, etapa, time, responsaveis }) => {
      const t = await lerTarefa(id)
      if (!t) return falhou("Tarefa não encontrada.")
      const lugar = lugarDeOrigem(t, etapa, time)
      if ("erro" in lugar) return falhou(lugar.erro)
      const r1 = resolverPessoas(responsaveis, await usuariosDoFluxo(), eu)
      if ("erro" in r1) return falhou(r1.erro)
      const r = await agirNoFluxo(eu, id, { acao: "responsaveis", em: lugar, responsaveis: r1.ids })
      const equipe = await usuariosDoFluxo()
      return doResultado(r, (corpo) => ({ trocados: true, tarefa: resumoDaTarefa(corpo.tarefa as TarefaLida, equipe) }))
    }
  )

  servidor.registerTool(
    "avisos_pendentes",
    {
      title: "Avisos de perícia/audiência a mandar ao cliente",
      description:
        "As tarefas \"Avisar cliente\" abertas (perícia ou audiência lida da intimação), com a mensagem pronta e o WhatsApp do cliente — e se o envio automático está liberado. " +
        "Com envioLiberado = false, NÃO envie nada: a trava é decisão do escritório (Automações › Aviso ao cliente); só liste, ou envie se uma pessoa pedir explicitamente nesta conversa. " +
        "Depois de enviar, conclua a sua parte na tarefa com concluir_minha_parte.",
      inputSchema: {
        ate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Só avisos com data até este dia, AAAA-MM-DD (padrão: hoje)."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ ate }) => {
      const liberado = await avisoAoClienteLiberado()
      const limite = ate ?? hoje()
      const escritorio = await idsDoEscritorio()

      const { data, error } = await supabase
        .from("comunicacoes_djen")
        .select(
          "id, numero_processo_mascara, ia_evento_tipo, ia_evento_data, ia_evento_hora, ia_evento_local, ia_mensagem_cliente, aviso:tarefas!comunicacoes_djen_aviso_tarefa_id_fkey(id, titulo, data, status), processo:processos(cliente:clientes(nome, telefone))"
        )
        .in("user_id", escritorio)
        .not("aviso_tarefa_id", "is", null)
        .not("ia_evento_data", "is", null)
      if (error) return falhou(`Não deu para listar os avisos: ${error.message}`)

      type Linha = {
        id: string
        numero_processo_mascara: string | null
        ia_evento_tipo: string | null
        ia_evento_data: string | null
        ia_evento_hora: string | null
        ia_evento_local: string | null
        ia_mensagem_cliente: string | null
        aviso: { id: string; titulo: string; data: string; status: string } | { id: string; titulo: string; data: string; status: string }[] | null
        processo: { cliente: { nome: string; telefone: string | null } | { nome: string; telefone: string | null }[] | null } | null
      }
      const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

      const avisos = ((data ?? []) as unknown as Linha[])
        .map((l) => ({ l, aviso: um(l.aviso), cliente: um(l.processo?.cliente ?? null) }))
        .filter(({ aviso }) => aviso && aviso.status === "PENDENTE" && aviso.data.slice(0, 10) <= limite)
        .map(({ l, aviso, cliente }) => ({
          tarefaId: aviso!.id,
          tarefa: aviso!.titulo,
          avisarAte: aviso!.data.slice(0, 10),
          evento: { tipo: l.ia_evento_tipo, data: l.ia_evento_data, hora: l.ia_evento_hora, local: l.ia_evento_local },
          processo: l.numero_processo_mascara,
          cliente: cliente?.nome ?? null,
          whatsapp: cliente?.telefone ?? null,
          mensagem: l.ia_mensagem_cliente,
        }))
        .sort((a, b) => a.avisarAte.localeCompare(b.avisarAte))

      return texto({
        envioLiberado: liberado,
        regra: liberado
          ? "Envio liberado pelo escritório: mande a mensagem pelo WhatsApp do cliente e conclua a sua parte na tarefa."
          : "Envio DESLIGADO pelo escritório: não envie. Liste para a equipe, ou envie só se alguém pedir nesta conversa.",
        hoje: hoje(),
        total: avisos.length,
        avisos,
      })
    }
  )

  servidor.registerTool(
    "abrir_duvida",
    {
      title: "Abrir uma dúvida na tarefa",
      description:
        "Pergunta algo a alguém da equipe sobre a tarefa (por padrão, ao responsável dela). A dúvida vira uma tarefa filha, com prazo, e aparece no quadro até ser respondida.",
      inputSchema: {
        id: z.string(),
        pergunta: z.string().min(5).max(2000),
        para: z.string().optional().describe('Nome de quem deve responder ("Zeca").'),
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Prazo da resposta, AAAA-MM-DD."),
      },
    },
    async ({ id, pergunta, para, data }) => {
      let responsavelId: string | undefined
      if (para) {
        const r = resolverPessoas([para], await usuariosDoFluxo(), eu)
        if ("erro" in r) return falhou(r.erro)
        responsavelId = r.ids[0]
      }
      const r = await abrirDuvida(eu, id, { pergunta, responsavelId, data })
      return doResultado(r, (corpo) => {
        const d = corpo.duvida as { id: string; titulo: string; data: string }
        return { aberta: true, duvida: { id: d.id, pergunta: d.titulo, prazo: d.data } }
      })
    }
  )

  return servidor
}
