import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { toCamelCase } from "@/lib/utils"
import { ImportacaoSchema } from "@/lib/validators"
import { hashOrigem, selecionarAdapter } from "@/lib/integracoes"
import {
  avaliarBaseLegal,
  buscarConsentimentoVigente,
  MOTIVO_RECUSA_MENSAGEM,
} from "@/lib/lgpd/consentimento"
import { ipDaRequisicao, registrarTratamento } from "@/lib/lgpd/auditoria"
import { refTitular } from "@/lib/lgpd/mascarar"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Importação assistida de documento do Meu INSS / GERID.
 *
 * Ordem das verificações é intencional e não deve ser reordenada:
 *
 *   1. autenticação
 *   2. validação de formato
 *   3. posse do cliente pelo usuário
 *   4. base legal vigente e dentro do prazo de retenção
 *   5. detecção de qual documento é (lê o texto, não extrai nada)
 *   6. a fonte detectada está no escopo autorizado
 *   7. só então o parser extrai
 *
 * O passo 4 antes do 5 é o ponto todo: sem base legal, o documento não
 * é nem inspecionado, e a recusa também é auditada. Rodar o parser
 * antes "para já mostrar ao usuário" criaria tratamento sem base legal.
 *
 * A fonte não é pedida ao operador: o conteúdo do documento revela de
 * que sistema ele veio. Por isso o escopo de fonte só pode ser
 * conferido no passo 6, depois da detecção.
 */

const MOTIVO_PARSER_MENSAGEM: Record<string, string> = {
  cnis_sem_dados:
    "Não encontrei vínculos nem remunerações neste texto. Confira se copiou o extrato CNIS completo.",
  concessao_sem_dados:
    "Não encontrei número do benefício nem DIB. Confira se copiou a carta de concessão.",
  indeferimento_sem_dados:
    "Não encontrei protocolo nem resultado da análise. Confira se copiou o comunicado de decisão.",
  extrato_sem_competencias:
    "Não encontrei competências de pagamento neste texto.",
  gerid_sem_dados:
    "Não encontrei protocolo nem situação. Confira se copiou o espelho do requerimento no GERID.",
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const validado = ImportacaoSchema.safeParse(body)

    if (!validado.success) {
      const primeiro = validado.error.issues[0]
      return NextResponse.json(
        { error: primeiro?.message || "Dados inválidos" },
        { status: 400 }
      )
    }

    const { clienteId, processoId, fonte, documento, texto } = validado.data

    // O cliente precisa ser deste usuário. Sem isto, um id vazado
    // permitiria importar dado sensível para a pasta de outro
    // escritório.
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id")
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
        detalhes: { motivo: podeTratar.motivo },
        ip: ipDaRequisicao(request),
      })

      return NextResponse.json(
        { error: MOTIVO_RECUSA_MENSAGEM[podeTratar.motivo] },
        { status: 403 }
      )
    }

    const adapter = selecionarAdapter({ fonte, texto, documento })

    if (!adapter) {
      // `precisaTipo` diz à interface para oferecer a escolha manual do
      // documento — que só aparece neste caso, em vez de ficar sempre
      // na tela pedindo uma decisão que quase nunca é necessária.
      return NextResponse.json(
        {
          error:
            "Não reconheci este documento. Confira se colou o conteúdo completo, ou escolha o tipo abaixo.",
          precisaTipo: true,
        },
        { status: 422 }
      )
    }

    const escopo = avaliarBaseLegal(podeTratar.consentimento, adapter.fonte)

    if (!escopo.ok) {
      await registrarTratamento({
        userId: user.id,
        acao: "IMPORTACAO_RECUSADA",
        entidade: "cliente",
        entidadeId: clienteId,
        detalhes: { fonte: adapter.fonte, motivo: escopo.motivo },
        ip: ipDaRequisicao(request),
      })

      return NextResponse.json(
        { error: MOTIVO_RECUSA_MENSAGEM[escopo.motivo] },
        { status: 403 }
      )
    }

    const extraido = adapter.extrair(texto)

    if (!extraido.ok) {
      return NextResponse.json(
        {
          error:
            MOTIVO_PARSER_MENSAGEM[extraido.motivo] ||
            "Não foi possível interpretar o documento",
        },
        { status: 422 }
      )
    }

    const hash = await hashOrigem(texto)

    // Reimportação do mesmo documento não gera registro novo: devolve
    // o que já existe. Evita inflar o histórico de tratamento com
    // duplicatas quando o operador cola duas vezes.
    const { data: existente } = await supabase
      .from("importacoes_integracao")
      .select("*")
      .eq("cliente_id", clienteId)
      .eq("hash_origem", hash)
      .is("expurgado_em", null)
      .maybeSingle()

    if (existente) {
      return NextResponse.json(
        {
          message: "Este documento já havia sido importado",
          importacao: toCamelCase(existente),
          duplicada: true,
        },
        { status: 200 }
      )
    }

    const { data: importacao, error } = await supabase
      .from("importacoes_integracao")
      .insert({
        user_id: user.id,
        cliente_id: clienteId,
        processo_id: processoId ?? null,
        consentimento_id: escopo.consentimento.id,
        fonte: adapter.fonte,
        documento: adapter.documento,
        dados: extraido.dados,
        hash_origem: hash,
        expurgar_em: escopo.consentimento.retencaoAte,
      })
      .select()
      .single()

    if (error || !importacao) {
      // Mensagem sem dado do titular: log é retido por terceiros e
      // sobrevive à eliminação pedida pelo titular.
      console.error("Importação INSS falhou", {
        titular: refTitular(clienteId),
        fonte: adapter.fonte,
        erro: error?.message,
      })
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    await registrarTratamento({
      userId: user.id,
      acao: "IMPORTACAO_INSS",
      entidade: "importacao_integracao",
      entidadeId: importacao.id,
      detalhes: {
        fonte: adapter.fonte,
        documento: adapter.documento,
        baseLegal: escopo.consentimento.baseLegal,
        consentimentoId: escopo.consentimento.id,
      },
      ip: ipDaRequisicao(request),
    })

    return NextResponse.json(
      {
        message: "Documento importado com sucesso",
        importacao: toCamelCase(importacao),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Importar integração error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
