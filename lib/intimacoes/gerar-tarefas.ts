import "server-only"
import { supabase } from "@/lib/supabase/server"
import {
  descricaoDaTarefa,
  prioridadePorPrazo,
  tituloDaTarefa,
  type IntimacaoParaTarefa,
} from "@/lib/domain/intimacao"
import {
  dataBr,
  isTipoEvento,
  mensagemPadraoAoCliente,
  rotuloDoEvento,
  vesperaUtil,
  type EventoIntimacao,
} from "@/lib/domain/intimacao/evento"
import { ETAPAS, responsaveisPadrao, type EtapaId, type LinhaFluxo } from "@/lib/domain/tarefa"
import { faltaMigration, fluxoDisponivel, garantirNoFluxo, usuariosDoFluxo } from "@/lib/fluxo/servidor"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Transforma intimações em tarefas do fluxo.
 *
 * Usado pela busca no DJEN (que já cria tudo o que chegou) e pelo
 * mutirão dos pendentes. Nunca cria duas para a mesma intimação: a
 * checagem é o `tarefa_id` (e o `aviso_tarefa_id`) da própria linha, e
 * o vínculo é gravado logo depois da inserção.
 *
 * O que nasce, pelo fluxo do escritório (lib/domain/tarefa/fluxo.ts):
 *
 *   • prazo do escritório      → Vermelho › Andamentos, no dia do prazo
 *   • perícia/audiência marcada → Vermelho › Andamentos, no dia e na
 *                                 hora do evento (vai para o calendário
 *                                 de perícias) e, na véspera, a tarefa
 *                                 "avisar o cliente" em Amarelo ›
 *                                 Judicial › Andamentos, já com a
 *                                 mensagem pronta
 *
 * A mensagem é só preparada: o envio ao cliente fica travado na
 * configuração `aviso_cliente_whatsapp` (lib/configuracoes.ts) até o
 * escritório liberar.
 */

type Linha = IntimacaoParaTarefa & {
  id: string
  processo_id: string | null
  tarefa_id: string | null
  aviso_tarefa_id?: string | null
  prazo_estimado: string | null
  ia_evento_tipo?: string | null
  ia_evento_data?: string | null
  ia_evento_hora?: string | null
  ia_evento_local?: string | null
  ia_mensagem_cliente?: string | null
}

export type ResultadoGeracao = {
  criadas: number
  jaTinham: number
  semPrazo: number
  /** Tarefas "avisar o cliente" abertas para perícia/audiência. */
  avisos: number
}

/** Etapa em que a intimação cai quando a rotina não diz outra coisa. */
const ETAPA_PRAZO: EtapaId = "andamentos"
const ETAPA_AVISO: EtapaId = "jud-andamentos"

function eventoDa(l: Linha): EventoIntimacao | null {
  if (!l.ia_evento_data || !isTipoEvento(l.ia_evento_tipo)) return null
  return {
    tipo: l.ia_evento_tipo,
    data: l.ia_evento_data.slice(0, 10),
    hora: l.ia_evento_hora ?? null,
    local: l.ia_evento_local ?? null,
    trecho: "",
  }
}

/** Quem é o cliente da intimação: pelo processo, quando ele está cadastrado. */
async function clienteDoProcesso(processoId: string | null) {
  if (!processoId) return null
  const { data } = await supabase
    .from("processos")
    .select("cliente:clientes(nome, telefone)")
    .eq("id", processoId)
    .maybeSingle()
  const c = (data as { cliente?: { nome?: string; telefone?: string | null } | { nome?: string; telefone?: string | null }[] | null } | null)?.cliente
  const um = Array.isArray(c) ? c[0] : c
  return um?.nome ? { nome: um.nome, telefone: um.telefone ?? null } : null
}

type NovaTarefa = {
  titulo: string
  descricao: string
  data: string
  hora?: string | null
  prioridade: string
  etapa: EtapaId
  /** Tira o "ANDAMENTOS" da pasta para "ANDAMENTOS › PERÍCIA": é o que
   *  manda a tarefa para o calendário de perícias (lib/domain/tarefa/agenda.ts). */
  pasta?: string
  origemId: string
}

/**
 * Insere a tarefa e a põe no fluxo, com os responsáveis da etapa.
 * `time` é o jeito antigo (env DJEN_CRON_TIME) e ainda vale: com ele a
 * tarefa cai no time pedido, sem etapa.
 */
async function criar(userId: string, processoId: string | null, nova: NovaTarefa, time?: string | null) {
  const etapa = ETAPAS[nova.etapa]
  const setor = time ?? etapa.time
  const { data: tarefa, error } = await supabase
    .from("tarefas")
    .insert({
      user_id: userId,
      processo_id: processoId,
      titulo: nova.titulo.slice(0, 300),
      descricao: nova.descricao,
      data: nova.data,
      hora: nova.hora ?? null,
      status: "PENDENTE",
      prioridade: nova.prioridade,
      setor,
      pasta: time ? null : (nova.pasta ?? etapa.pasta),
      origem_id: nova.origemId,
    })
    .select("id")
    .single()

  if (error?.code === "23505") {
    // A origem já existe: a rotina correu duas vezes ao mesmo tempo.
    const { data } = await supabase.from("tarefas").select("id").eq("origem_id", nova.origemId).maybeSingle()
    return data?.id ? { id: data.id as string, nova: false } : null
  }
  if (error || !tarefa) {
    console.error("Criar tarefa da intimação:", error?.message)
    return null
  }

  if (!time && (await fluxoDisponivel())) {
    try {
      const equipe = await usuariosDoFluxo()
      const quem = responsaveisPadrao(nova.etapa, equipe) ?? [null]
      const linhas: LinhaFluxo[] = quem.map((r) => ({ setor: etapa.time, etapa: nova.etapa, responsavelId: r }))
      await garantirNoFluxo({ id: tarefa.id, setor: etapa.time }, userId, linhas)
    } catch (e) {
      if (!faltaMigration(e as { code?: string })) console.error("Tarefa da intimação no fluxo:", (e as Error).message)
    }
  }

  return { id: tarefa.id as string, nova: true }
}

export async function gerarTarefasDasIntimacoes(
  userId: string,
  intimacoes: Linha[],
  /** Time que recebe as tarefas automáticas (jeito antigo, por env).
   *  Sem ele, valem as etapas do fluxo. */
  time?: string | null
): Promise<ResultadoGeracao> {
  const resultado: ResultadoGeracao = { criadas: 0, jaTinham: 0, semPrazo: 0, avisos: 0 }
  const escritorio = await idsDoEscritorio()

  for (const intimacao of intimacoes) {
    const evento = eventoDa(intimacao)

    // ── A tarefa principal: o prazo ou, sem prazo, o evento ──
    if (intimacao.tarefa_id) {
      resultado.jaTinham++
    } else if (intimacao.prazo_estimado || evento) {
      const pelaData = !intimacao.prazo_estimado && evento
      const titulo = pelaData
        ? [rotuloDoEvento(evento), intimacao.destinatario].filter(Boolean).join(" — ")
        : tituloDaTarefa(intimacao)
      const data = pelaData ? evento.data : intimacao.prazo_estimado!
      const criada = await criar(
        userId,
        intimacao.processo_id,
        {
          titulo,
          descricao: descricaoDaTarefa(intimacao),
          data,
          hora: pelaData ? evento.hora : null,
          prioridade: pelaData ? "ALTA" : prioridadePorPrazo(data, undefined, intimacao),
          etapa: ETAPA_PRAZO,
          pasta: pelaData && evento.tipo === "PERICIA" ? "ANDAMENTOS › PERÍCIA" : undefined,
          origemId: `djen:${intimacao.id}`,
        },
        time
      )
      if (criada) {
        const { error } = await supabase
          .from("comunicacoes_djen")
          .update({ tarefa_id: criada.id })
          .eq("id", intimacao.id)
          .in("user_id", escritorio)
        if (error) {
          // Sem o vínculo, a próxima busca criaria a tarefa de novo.
          console.error("Vincular tarefa à intimação:", error.message)
          if (criada.nova) await supabase.from("tarefas").delete().eq("id", criada.id)
        } else if (criada.nova) {
          resultado.criadas++
        }
      }
    } else {
      resultado.semPrazo++
    }

    // ── O aviso ao cliente, na véspera do evento ──
    if (!evento || intimacao.aviso_tarefa_id) continue

    const cliente = await clienteDoProcesso(intimacao.processo_id)
    const primeiroNome = cliente?.nome?.split(/\s+/)[0] ?? null
    const mensagem = intimacao.ia_mensagem_cliente?.trim() || mensagemPadraoAoCliente(evento, primeiroNome)
    const hoje = new Date().toISOString().slice(0, 10)
    const vespera = vesperaUtil(evento.data)

    const aviso = await criar(
      userId,
      intimacao.processo_id,
      {
        titulo: `Avisar cliente da ${rotuloDoEvento(evento).toLowerCase()}${intimacao.destinatario ? ` — ${intimacao.destinatario}` : ""}`,
        descricao: [
          [intimacao.numero_processo_mascara ? `Processo ${intimacao.numero_processo_mascara}` : null, cliente?.telefone ? `WhatsApp ${cliente.telefone}` : "WhatsApp: não cadastrado"]
            .filter(Boolean)
            .join(" · "),
          `${rotuloDoEvento(evento)} (${dataBr(evento.data)}). Avisar o cliente até a véspera.`,
          "",
          "Mensagem pronta:",
          mensagem,
          "",
          "Envio automático pelo WhatsApp: desligado (Automações › Aviso ao cliente). Enquanto estiver assim, quem avisa é a equipe.",
        ].join("\n"),
        data: vespera < hoje ? hoje : vespera,
        prioridade: "ALTA",
        etapa: ETAPA_AVISO,
        origemId: `djen:${intimacao.id}:aviso`,
      },
      time
    )
    if (!aviso) continue

    const { error } = await supabase
      .from("comunicacoes_djen")
      .update({ aviso_tarefa_id: aviso.id })
      .eq("id", intimacao.id)
      .in("user_id", escritorio)
    if (error) {
      console.error("Vincular aviso à intimação:", error.message)
      if (aviso.nova) await supabase.from("tarefas").delete().eq("id", aviso.id)
    } else if (aviso.nova) {
      resultado.avisos++
    }
  }

  return resultado
}
