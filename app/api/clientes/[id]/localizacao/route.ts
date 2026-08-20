import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { municipioPorNome } from "@/lib/domain/localizacao"

/**
 * Ponto do cliente no mapa, apontado à mão.
 *
 * Aceita o município, não a coordenada: a lista de municípios é o
 * vocabulário do mapa, e receber lat/lng cru abriria espaço para um
 * pin no meio do oceano por um dígito trocado. `municipio: null`
 * devolve o cliente para a lista de sem localização.
 */
const LocalizacaoSchema = z.object({
  municipio: z.string().nullable(),
  uf: z.string().nullable(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const parsed = LocalizacaoSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    let campos: { latitude: number | null; longitude: number | null }

    if (parsed.data.municipio && parsed.data.uf) {
      const municipio = municipioPorNome(parsed.data.municipio, parsed.data.uf)

      if (!municipio) {
        return NextResponse.json(
          { error: "Município não está na lista do mapa" },
          { status: 400 }
        )
      }

      campos = { latitude: municipio.lat, longitude: municipio.lng }
    } else {
      campos = { latitude: null, longitude: null }
    }

    const { data: cliente, error } = await supabase
      .from("clientes")
      .update(campos)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, latitude, longitude")
      .maybeSingle()

    if (error || !cliente) {
      console.error("Localização error:", error?.message)
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { latitude: cliente.latitude, longitude: cliente.longitude },
      { status: 200 }
    )
  } catch (error) {
    console.error("Localização error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
