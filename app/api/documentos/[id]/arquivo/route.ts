import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Abre o documento por URL assinada de curta duração.
 *
 * A assinatura é emitida a cada leitura, depois de conferir de quem é
 * o arquivo. Guardar uma URL assinada no banco não funcionaria: ela
 * expira, e o registro ficaria apontando para um link morto.
 */

const VALIDADE_URL_SEGUNDOS = 60

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    const { data: documento } = await supabase
      .from("documentos")
      .select("caminho, url")
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .maybeSingle()

    if (!documento) {
      return NextResponse.json(
        { error: "Documento não encontrado" },
        { status: 404 }
      )
    }

    // Documento que mora fora do CRM continua sendo só um endereço.
    if (!documento.caminho) {
      if (documento.url) return NextResponse.redirect(documento.url)
      return NextResponse.json(
        { error: "Documento sem arquivo" },
        { status: 404 }
      )
    }

    const { data, error } = await supabase.storage
      .from("documentos")
      .createSignedUrl(documento.caminho, VALIDADE_URL_SEGUNDOS)

    if (error || !data) {
      console.error("Assinar URL do documento:", error?.message)
      return NextResponse.json(
        { error: "Não foi possível abrir o arquivo" },
        { status: 500 }
      )
    }

    return NextResponse.redirect(data.signedUrl)
  } catch (error) {
    console.error("Abrir documento error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
