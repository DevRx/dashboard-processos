import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { responderPergunta } from "@/lib/ia/agente-escritorio"
import { iaDoEscritorio } from "@/lib/ia/config-escritorio"

/**
 * Conversa com o agente do escritório.
 *
 * Cada colaborador logado fala com o assistente aqui. Sem
 * ANTHROPIC_API_KEY a rota responde 503 com um aviso claro — a tela
 * continua, só sem resposta da IA. O agente nunca executa nada: ver
 * lib/ia/agente-escritorio.
 */
const Schema = z.object({
  pergunta: z.string().min(1).max(4000),
  historico: z
    .array(
      z.object({
        autor: z.enum(["pessoa", "agente"]),
        texto: z.string().max(8000),
      })
    )
    .max(20)
    .optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const parsed = Schema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    // A IA do escritório do usuário (BYO key). Vazio → cai no ambiente.
    const ia = await iaDoEscritorio()

    const resultado = await responderPergunta({
      pergunta: parsed.data.pergunta,
      nomeUsuario: user.name,
      historico: parsed.data.historico,
      ia,
    })

    if (!resultado.ok) {
      if (resultado.motivo === "sem_chave") {
        return NextResponse.json(
          {
            error:
              "IA não configurada: falta ANTHROPIC_API_KEY no ambiente. O resto do sistema funciona normalmente.",
          },
          { status: 503 }
        )
      }
      if (resultado.motivo === "recusado") {
        return NextResponse.json(
          { error: "Não consegui responder a isso. Tente reformular." },
          { status: 422 }
        )
      }
      return NextResponse.json(
        { error: "Erro ao falar com a IA. Tente de novo." },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { resposta: resultado.resposta, modelo: resultado.modelo },
      { status: 200 }
    )
  } catch (error) {
    console.error("Assistente:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
