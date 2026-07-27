import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import { isCategoriaDocumento } from "@/lib/domain/documento"

/**
 * Upload de documento do caso.
 *
 * É a peça que faltava para o CRM ser de fato o centro: o assistente
 * alimenta a pasta aqui, e quem vai protocolar encontra tudo reunido
 * em vez de caçar anexo em e-mail.
 *
 * Bucket privado, como o das procurações. Laudo médico, CPF e endereço
 * num link público seriam vazamento permanente.
 */

const BUCKET = "documentos"
const TAMANHO_MAXIMO = 20 * 1024 * 1024

const TIPOS_ACEITOS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const form = await request.formData()
    const arquivo = form.get("arquivo")
    const clienteId = form.get("clienteId")
    const processoIdBruto = form.get("processoId")
    const categoriaBruta = form.get("categoria")

    // O dono é o cliente. O processo é opcional — laudo de um pedido
    // específico merece ficar junto dele, mas RG não pertence a caso
    // nenhum.
    if (typeof clienteId !== "string" || !clienteId) {
      return NextResponse.json({ error: "Informe o cliente" }, { status: 400 })
    }

    const processoId =
      typeof processoIdBruto === "string" && processoIdBruto
        ? processoIdBruto
        : null

    const categoria = isCategoriaDocumento(categoriaBruta)
      ? categoriaBruta
      : "OUTRO"

    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: "Envie o arquivo" }, { status: 400 })
    }

    const extensao = TIPOS_ACEITOS[arquivo.type]
    if (!extensao) {
      return NextResponse.json(
        { error: "Formato não aceito. Envie PDF, JPG ou PNG." },
        { status: 415 }
      )
    }

    if (arquivo.size > TAMANHO_MAXIMO) {
      return NextResponse.json(
        { error: "Arquivo acima de 20 MB" },
        { status: 413 }
      )
    }

    const { data: cliente } = await supabase
      .from("clientes")
      .select("id")
      .eq("id", clienteId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!cliente) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      )
    }

    if (processoId) {
      const { data: processo } = await supabase
        .from("processos")
        .select("id")
        .eq("id", processoId)
        .eq("cliente_id", clienteId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (!processo) {
        return NextResponse.json(
          { error: "Processo não encontrado para este cliente" },
          { status: 404 }
        )
      }
    }

    // Caminho por usuário e cliente: id vazado não permite gravar na
    // pasta de outro escritório, e o arquivo acompanha o titular mesmo
    // que o caso a que ele se liga seja excluído depois.
    const caminho = `${user.id}/${clienteId}/${crypto.randomUUID()}.${extensao}`

    const { error: erroUpload } = await supabase.storage
      .from(BUCKET)
      .upload(caminho, arquivo, { contentType: arquivo.type })

    if (erroUpload) {
      console.error("Upload documento:", erroUpload.message)
      return NextResponse.json(
        { error: "Não foi possível enviar o arquivo" },
        { status: 500 }
      )
    }

    const { data: documento, error } = await supabase
      .from("documentos")
      .insert({
        cliente_id: clienteId,
        processo_id: processoId,
        categoria,
        user_id: user.id,
        nome: arquivo.name,
        caminho,
        tipo: arquivo.type,
        tamanho: arquivo.size,
      })
      .select()
      .single()

    if (error || !documento) {
      // Sem a linha apontando para ele, o arquivo vira órfão no bucket:
      // dado pessoal fora do alcance de qualquer expurgo.
      await supabase.storage.from(BUCKET).remove([caminho])
      console.error("Registrar documento:", error?.message)
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: "Documento enviado", documento: toCamelCase(documento) },
      { status: 201 }
    )
  } catch (error) {
    console.error("Upload documento error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
