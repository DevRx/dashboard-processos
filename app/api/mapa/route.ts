import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import {
  municipioDoEndereco,
  municipioPorCoordenada,
} from "@/lib/domain/localizacao"

/**
 * Mapa de atendimento: onde estão os clientes do escritório.
 *
 * A coordenada vem de dois lugares, nesta ordem: a que alguém apontou
 * à mão no cadastro e, se não houver, o município reconhecido no
 * endereço. Quem não tiver nenhuma das duas volta em `semLocalizacao`
 * — é lista de trabalho, não erro.
 */

type ClienteBruto = {
  id: string
  nome: string
  endereco: string | null
  latitude: number | null
  longitude: number | null
  processos: { id: string; esfera: string | null; status: string }[] | null
}

/** Fase encerrada não conta como atendimento em curso. */
const STATUS_ENCERRADOS = new Set(["CONCLUIDO", "ARQUIVADO"])

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("clientes")
      .select("id, nome, endereco, latitude, longitude, processos(id, esfera, status)")
      .eq("user_id", user.id)
      .order("nome")

    if (error) {
      console.error("Mapa error:", error.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    const comLocalizacao = []
    const semLocalizacao = []

    for (const c of (data ?? []) as ClienteBruto[]) {
      const processos = c.processos ?? []
      const emAberto = processos.filter((p) => !STATUS_ENCERRADOS.has(p.status))

      const base = {
        id: c.id,
        nome: c.nome,
        endereco: c.endereco,
        processos: processos.length,
        processosAbertos: emAberto.length,
      }

      if (c.latitude !== null && c.longitude !== null) {
        // A coordenada apontada à mão é sempre a de um município da
        // tabela; o endereço só entra se ela não for reconhecida.
        const daCoordenada =
          municipioPorCoordenada(c.latitude, c.longitude) ??
          municipioDoEndereco(c.endereco)

        comLocalizacao.push({
          ...base,
          lat: c.latitude,
          lng: c.longitude,
          municipio: daCoordenada?.nome ?? "Local marcado",
          uf: daCoordenada?.uf ?? "",
          origem: "manual" as const,
        })
        continue
      }

      const municipio = municipioDoEndereco(c.endereco)

      if (municipio) {
        comLocalizacao.push({
          ...base,
          lat: municipio.lat,
          lng: municipio.lng,
          municipio: municipio.nome,
          uf: municipio.uf,
          origem: "endereco" as const,
        })
        continue
      }

      semLocalizacao.push(base)
    }

    return NextResponse.json(
      { clientes: comLocalizacao, semLocalizacao },
      { status: 200 }
    )
  } catch (error) {
    console.error("Mapa error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
