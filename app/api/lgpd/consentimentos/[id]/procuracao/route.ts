import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { ipDaRequisicao, registrarTratamento } from "@/lib/lgpd/auditoria"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * PDF da procuração que sustenta a base legal.
 *
 * POST  anexa o arquivo
 * GET   devolve o arquivo por URL assinada de curta duração
 *
 * O bucket é privado. A procuração traz CPF, endereço e assinatura do
 * titular — link público seria vazamento permanente, e link assinado
 * gravado no banco venceria e viraria lixo. Por isso o banco guarda o
 * caminho e a URL é emitida a cada leitura, depois de conferir de quem
 * é o documento.
 */

const BUCKET = "procuracoes"
const TAMANHO_MAXIMO = 10 * 1024 * 1024
/** Janela curta: tempo de abrir o PDF, não de compartilhar o link. */
const VALIDADE_URL_SEGUNDOS = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    const { data: consentimento } = await supabase
      .from("consentimentos_lgpd")
      .select("id, cliente_id, procuracao_arquivo")
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .maybeSingle()

    if (!consentimento) {
      return NextResponse.json(
        { error: "Base legal não encontrada" },
        { status: 404 }
      )
    }

    const form = await request.formData()
    const arquivo = form.get("arquivo")

    if (!(arquivo instanceof File)) {
      return NextResponse.json({ error: "Envie o arquivo" }, { status: 400 })
    }

    // Confere o tipo aqui além do bucket: erro do bucket chega como
    // mensagem técnica em inglês, e o operador merece saber em
    // português o que deu errado.
    if (arquivo.type !== "application/pdf") {
      return NextResponse.json(
        { error: "A procuração precisa ser um PDF" },
        { status: 415 }
      )
    }

    if (arquivo.size > TAMANHO_MAXIMO) {
      return NextResponse.json(
        { error: "Arquivo acima de 10 MB" },
        { status: 413 }
      )
    }

    // O caminho inclui o usuário para que um id vazado não permita
    // gravar na pasta de outro escritório.
    const caminho = `${user.id}/${id}/${crypto.randomUUID()}.pdf`

    const { error: erroUpload } = await supabase.storage
      .from(BUCKET)
      .upload(caminho, arquivo, { contentType: "application/pdf" })

    if (erroUpload) {
      console.error("Upload procuração:", erroUpload.message)
      return NextResponse.json(
        { error: "Não foi possível enviar o arquivo" },
        { status: 500 }
      )
    }

    const { error: erroUpdate } = await supabase
      .from("consentimentos_lgpd")
      .update({ procuracao_arquivo: caminho, procuracao_nome: arquivo.name })
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())

    if (erroUpdate) {
      // Sem a linha apontando para ele, o arquivo seria órfão no bucket
      // — dado pessoal fora do alcance do expurgo e da eliminação.
      await supabase.storage.from(BUCKET).remove([caminho])
      console.error("Vincular procuração:", erroUpdate.message)
      return NextResponse.json(
        { error: "Não foi possível anexar a procuração" },
        { status: 500 }
      )
    }

    // Substituição: só remove o anterior depois que o novo está
    // gravado e vinculado.
    if (consentimento.procuracao_arquivo) {
      await supabase.storage
        .from(BUCKET)
        .remove([consentimento.procuracao_arquivo])
    }

    await registrarTratamento({
      userId: user.id,
      acao: "BASE_LEGAL_RETIFICADA",
      entidade: "consentimento_lgpd",
      entidadeId: id,
      detalhes: { procuracaoAnexada: true, substituiu: Boolean(consentimento.procuracao_arquivo) },
      ip: ipDaRequisicao(request),
    })

    return NextResponse.json(
      { message: "Procuração anexada", nome: arquivo.name },
      { status: 201 }
    )
  } catch (error) {
    console.error("Upload procuração error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}

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

    const { data: consentimento } = await supabase
      .from("consentimentos_lgpd")
      .select("procuracao_arquivo")
      .eq("id", id)
      .in("user_id", await idsDoEscritorio())
      .maybeSingle()

    if (!consentimento?.procuracao_arquivo) {
      return NextResponse.json(
        { error: "Nenhuma procuração anexada" },
        { status: 404 }
      )
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(consentimento.procuracao_arquivo, VALIDADE_URL_SEGUNDOS)

    if (error || !data) {
      console.error("Assinar URL da procuração:", error?.message)
      return NextResponse.json(
        { error: "Não foi possível abrir o arquivo" },
        { status: 500 }
      )
    }

    return NextResponse.redirect(data.signedUrl)
  } catch (error) {
    console.error("Abrir procuração error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
