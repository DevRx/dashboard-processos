import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { OAB_PADRAO } from "@/lib/integracoes/oab"
import { sincronizarDjen } from "@/lib/intimacoes/sincronizar"
import { TimeTarefaEnum } from "@/lib/validators"

/**
 * Caixa de entrada do DJEN.
 *
 * GET devolve o que já está guardado; POST vai ao diário buscar o
 * intervalo pedido e grava o que for novo. A separação existe porque
 * abrir a tela não pode depender de um serviço externo estar de pé —
 * quem trabalha a fila precisa dela mesmo quando o CNJ está fora do ar.
 *
 * A busca em si mora em lib/intimacoes/sincronizar.ts, compartilhada
 * com a rotina agendada de /api/cron/djen.
 */

const MOTIVO_MENSAGEM: Record<string, string> = {
  invalid_format: "Informe o número e a UF da OAB (ex.: 60782 / DF).",
  djen_indisponivel:
    "O DJEN não respondeu agora. As intimações já guardadas continuam na tela.",
  gravacao_falhou: "Erro ao guardar as intimações",
}

const BuscaSchema = z.object({
  numeroOab: z.string().min(1).optional(),
  ufOab: z.string().length(2).optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  /** Ligado por padrão: quem busca quer a agenda pronta, não uma lista. */
  criarTarefas: z.boolean().optional(),
  /** Time que recebe as tarefas criadas nesta busca. */
  time: TimeTarefaEnum.nullish(),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const [intimacoesRes, execucaoRes] = await Promise.all([
      supabase
        .from("comunicacoes_djen")
        .select(
          "*, processo:processos(id, numero, cliente:clientes(id, nome)), tarefa:tarefas(id, setor, data, status)"
        )
        .eq("user_id", user.id)
        .order("data_disponibilizacao", { ascending: false })
        .limit(400),
      // Última passada da rotina automática, para a tela poder dizer
      // se ela está de pé — automação silenciosa que parou é pior que
      // não ter automação.
      supabase
        .from("auditorias")
        .select("created_at, detalhes")
        .eq("user_id", user.id)
        .eq("acao", "DJEN_SINCRONIZACAO_AUTOMATICA")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (intimacoesRes.error) {
      console.error("Intimações error:", intimacoesRes.error.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    const ultima = execucaoRes.data

    return NextResponse.json(
      {
        intimacoes: intimacoesRes.data ?? [],
        oab: OAB_PADRAO,
        // "Há quantos dias" é conta de relógio, e relógio não pode ser
        // lido durante o render de um componente. Sai daqui pronto.
        ultimaAutomatica: ultima
          ? {
              ...ultima,
              diasDesde: Math.floor(
                (Date.now() - new Date(ultima.created_at).getTime()) /
                  86_400_000
              ),
            }
          : null,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Intimações error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const parsed = BuscaSchema.safeParse(await request.json().catch(() => ({})))

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    const resultado = await sincronizarDjen({
      userId: user.id,
      numeroOab: parsed.data.numeroOab ?? OAB_PADRAO.numero,
      ufOab: parsed.data.ufOab ?? OAB_PADRAO.uf,
      dataInicio: parsed.data.dataInicio,
      dataFim: parsed.data.dataFim,
      criarTarefas: parsed.data.criarTarefas,
      time: parsed.data.time,
    })

    if (!resultado.ok) {
      return NextResponse.json(
        {
          error:
            MOTIVO_MENSAGEM[resultado.motivo] ??
            "Não foi possível consultar o DJEN",
        },
        { status: resultado.motivo === "invalid_format" ? 400 : 502 }
      )
    }

    return NextResponse.json(resultado, { status: 200 })
  } catch (error) {
    console.error("Buscar intimações error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
