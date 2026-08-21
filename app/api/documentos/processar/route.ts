import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import { montarPdf, tratarImagem } from "@/lib/documentos/imagem"
import { lerDocumento } from "@/lib/ia/leitor-documento"
import {
  avaliarBaseLegal,
  buscarConsentimentoVigente,
  MOTIVO_RECUSA_MENSAGEM,
} from "@/lib/lgpd/consentimento"
import { ipDaRequisicao, registrarTratamento } from "@/lib/lgpd/auditoria"
import { refTitular, removerIdentificadores } from "@/lib/lgpd/mascarar"
import { podeSerLidoPorIa } from "@/lib/domain/documento"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Recebe fotos de um documento, monta um PDF e manda a IA lê-lo.
 *
 * O fluxo que o escritório vive: alguém fotografa o laudo em três
 * pedaços com o celular, torto e com sombra. Aqui isso vira um PDF
 * único e legível, com os campos já extraídos e uma tarefa proposta.
 *
 * Ordem das verificações, e o motivo de cada uma vir antes da próxima:
 *
 *   1. autenticação
 *   2. base legal vigente do titular
 *   3. autorização específica de IA — mandar laudo para a Anthropic é
 *      transferência internacional a um operador novo, e o
 *      consentimento genérico de consultar o INSS não cobre isso
 *   4. tratamento das imagens e montagem do PDF (local, sem rede)
 *   5. gravação do arquivo no bucket privado
 *   6. só então o documento sai para a IA
 *
 * O passo 5 antes do 6 é intencional: se a leitura falhar, o documento
 * já está guardado e o operador não perde o trabalho de fotografar.
 */

const MAXIMO_PAGINAS = 10
const TAMANHO_MAXIMO_PAGINA = 20 * 1024 * 1024

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/heic"]

const MOTIVO_IA_MENSAGEM: Record<string, string> = {
  sem_chave:
    "Leitura por IA não configurada no servidor (falta ANTHROPIC_API_KEY). O PDF foi montado e guardado assim mesmo.",
  recusado:
    "A IA recusou a leitura deste documento. O PDF foi montado e guardado; preencha os campos manualmente.",
  ilegivel:
    "A IA não conseguiu extrair nada legível. O PDF foi montado e guardado; confira a qualidade das fotos.",
  erro_api:
    "Falha ao falar com a IA. O PDF foi montado e guardado; tente a leitura de novo mais tarde.",
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const form = await request.formData()
    const clienteId = form.get("clienteId")
    const processoIdBruto = form.get("processoId")
    const nomeBruto = form.get("nome")
    const arquivos = form.getAll("paginas").filter((f): f is File => f instanceof File)

    if (typeof clienteId !== "string" || !clienteId) {
      return NextResponse.json({ error: "Informe o cliente" }, { status: 400 })
    }

    if (arquivos.length === 0) {
      return NextResponse.json(
        { error: "Envie ao menos uma foto" },
        { status: 400 }
      )
    }

    if (arquivos.length > MAXIMO_PAGINAS) {
      return NextResponse.json(
        { error: `No máximo ${MAXIMO_PAGINAS} páginas por documento` },
        { status: 413 }
      )
    }

    for (const arquivo of arquivos) {
      if (!TIPOS_ACEITOS.includes(arquivo.type)) {
        return NextResponse.json(
          { error: `"${arquivo.name}" não é uma imagem aceita (JPG, PNG, WEBP ou HEIC)` },
          { status: 415 }
        )
      }
      if (arquivo.size > TAMANHO_MAXIMO_PAGINA) {
        return NextResponse.json(
          { error: `"${arquivo.name}" passa de 20 MB` },
          { status: 413 }
        )
      }
    }

    // Nome e CPF são carregados só para *remover* do que a IA devolve,
    // nunca para enviar: o prompt não recebe nenhum dado do titular.
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id, nome, cpf")
      .eq("id", clienteId)
      .in("user_id", await idsDoEscritorio())
      .maybeSingle()

    if (!cliente) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      )
    }

    const consentimento = await buscarConsentimentoVigente(clienteId)
    const podeTratar = avaliarBaseLegal(consentimento)

    if (!podeTratar.ok) {
      await registrarTratamento({
        userId: user.id,
        acao: "IMPORTACAO_RECUSADA",
        entidade: "cliente",
        entidadeId: clienteId,
        detalhes: { origem: "processar_documento", motivo: podeTratar.motivo },
        ip: ipDaRequisicao(request),
      })
      return NextResponse.json(
        { error: MOTIVO_RECUSA_MENSAGEM[podeTratar.motivo] },
        { status: 403 }
      )
    }

    // Duas condições, não uma: o titular autorizou leitura por IA *e*
    // o documento é de uma categoria que pode sair. Um RG continua
    // parado aqui mesmo com autorização em dia.
    const categoriaDeclarada = form.get("categoria")
    const categoriaLegivel = podeSerLidoPorIa(categoriaDeclarada)
    const iaAutorizada = podeTratar.consentimento.iaAutorizada
    const vaiLer = iaAutorizada && categoriaLegivel

    // ── Tratamento local: nada saiu da máquina até aqui ──
    const paginas = []
    for (const arquivo of arquivos) {
      paginas.push(await tratarImagem(Buffer.from(await arquivo.arrayBuffer())))
    }

    const pdf = await montarPdf(paginas)

    const processoId =
      typeof processoIdBruto === "string" && processoIdBruto
        ? processoIdBruto
        : null

    const nome =
      typeof nomeBruto === "string" && nomeBruto.trim()
        ? nomeBruto.trim().replace(/\.pdf$/i, "") + ".pdf"
        : `documento-${new Date().toISOString().slice(0, 10)}.pdf`

    const caminho = `${user.id}/${clienteId}/${crypto.randomUUID()}.pdf`

    const { error: erroUpload } = await supabase.storage
      .from("documentos")
      .upload(caminho, pdf, { contentType: "application/pdf" })

    if (erroUpload) {
      console.error("Upload do PDF montado:", erroUpload.message)
      return NextResponse.json(
        { error: "Não foi possível guardar o PDF" },
        { status: 500 }
      )
    }

    // ── Leitura por IA: o único passo que manda dado para fora ──
    const leitura = vaiLer ? await lerDocumento(paginas.map((p) => p.jpeg)) : null

    // O modelo é instruído a não transcrever identificação do titular,
    // mas instrução não é garantia: o nome está impresso no papel que
    // ele acabou de ler. A limpeza aqui é o que impede uma segunda
    // cópia do nome e do CPF de entrar no banco e na tela.
    const limpar = (texto: string) =>
      removerIdentificadores(texto, { nome: cliente.nome, cpf: cliente.cpf })

    const resumo = leitura?.ok ? limpar(leitura.leitura.resumo) : null
    const campos = leitura?.ok
      ? {
          triagem: {
            ...leitura.leitura.triagem,
            // Único campo livre da triagem: o modelo descreve a doença
            // com as palavras do laudo, e o nome do titular pode vir
            // junto na descrição.
            patologia: leitura.leitura.triagem.patologia
              ? limpar(leitura.leitura.triagem.patologia)
              : undefined,
          },
          validade: leitura.leitura.validade,
          pontosFracos: leitura.leitura.pontosFracos.map(limpar),
          beneficioSugerido: leitura.leitura.beneficioSugerido,
          ilegivel: leitura.leitura.ilegivel.map(limpar),
        }
      : null

    const { data: documento, error } = await supabase
      .from("documentos")
      .insert({
        cliente_id: clienteId,
        processo_id: processoId,
        categoria: leitura?.ok ? leitura.leitura.categoria : "OUTRO",
        user_id: user.id,
        nome,
        caminho,
        tipo: "application/pdf",
        tamanho: pdf.byteLength,
        ia_resumo: resumo,
        ia_campos: campos,
        ia_lido_em: leitura?.ok ? new Date().toISOString() : null,
        ia_modelo: leitura?.ok ? leitura.leitura.modelo : null,
      })
      .select()
      .single()

    if (error || !documento) {
      await supabase.storage.from("documentos").remove([caminho])
      console.error("Registrar documento processado:", {
        titular: refTitular(clienteId),
        erro: error?.message,
      })
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    // ── Tarefa de acompanhamento ──
    let tarefaCriada: string | null = null
    if (leitura?.ok && leitura.leitura.tarefaSugerida) {
      const sugestao = leitura.leitura.tarefaSugerida
      const { error: erroTarefa } = await supabase.from("tarefas").insert({
        user_id: user.id,
        processo_id: processoId,
        titulo: limpar(sugestao.titulo),
        descricao: [
          resumo,
          leitura.leitura.ilegivel.length
            ? `Confira no documento: ${leitura.leitura.ilegivel.map(limpar).join(", ")}.`
            : null,
          "Lido por IA — confira antes de usar.",
        ]
          .filter(Boolean)
          .join("\n"),
        data: sugestao.prazo ?? new Date().toISOString().slice(0, 10),
        status: "PENDENTE",
        prioridade: "MEDIA",
      })
      if (!erroTarefa) tarefaCriada = sugestao.titulo
    }

    await registrarTratamento({
      userId: user.id,
      acao: "IMPORTACAO_INSS",
      entidade: "documento",
      entidadeId: documento.id,
      detalhes: {
        origem: "processar_documento",
        paginas: paginas.length,
        iaAutorizada,
        categoriaLegivel,
        iaLida: Boolean(leitura?.ok),
        modelo: leitura?.ok ? leitura.leitura.modelo : null,
      },
      ip: ipDaRequisicao(request),
    })

    return NextResponse.json(
      {
        message: `PDF montado com ${paginas.length} página(s)`,
        documento: toCamelCase(documento),
        melhorias: paginas[0]?.melhorias ?? [],
        tarefaCriada,
        aviso: !categoriaLegivel
          ? "Só laudo médico é lido por IA — este documento foi montado e guardado sem sair do sistema."
          : !iaAutorizada
            ? "Leitura por IA não autorizada para este titular — o PDF foi montado e guardado sem análise."
            : leitura && !leitura.ok
              ? MOTIVO_IA_MENSAGEM[leitura.motivo]
              : null,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Processar documento error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
