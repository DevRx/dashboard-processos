import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/supabase/server"
import { decifrar } from "@/lib/seguranca/cofre"
import { idsDoEscritorio } from "@/lib/escritorio"

/**
 * Fila administrativa: um item por requerimento em curso no INSS.
 *
 * A tela precisa do processo e da ficha do titular na mesma tela, e
 * abrir uma requisição por cliente ao expandir uma coluna deixaria a
 * navegação com um atraso perceptível a cada clique. Então vem tudo
 * junto, senha do Meu INSS incluída: a tela é de uso interno e a
 * equipe precisa dela à mão na hora de protocolar. A cifra continua no
 * banco — ela protege o dump e o backup, não a tela.
 *
 * Cliente sem processo entra como item "sem requerimento aberto": ele já
 * é trabalho, e some da fila se a lista vier só de `processos`.
 *
 * Inclusive sem benefício informado — o campo é opcional no cadastro.
 * Antes esses eram descartados aqui, e o efeito era o pior possível: a
 * pessoa cadastrava o cliente, ia ao Administrativo e não o encontrava,
 * sem nada na tela explicando por quê. Agora ele aparece, e a falta do
 * benefício vira o que de fato é — uma pendência visível, não um
 * sumiço.
 */

/** Quem opera o escritório. Os demais recebem a fila sem as senhas. */
const PAPEIS_COM_SENHA = new Set(["ADMIN", "ADVOGADO", "ASSISTENTE"])

type ClienteBruto = {
  id: string
  nome: string
  cpf: string | null
  created_at: string
  observacoes: string | null
  senha_meu_inss: string | null
}

type ProcessoBruto = {
  id: string
  cliente_id: string
  beneficio: string
  esfera: string | null
  status: string
  situacao_pericia: string | null
  protocolo_inss: string | null
  data_entrada: string | null
}

function fichaDoCliente(c: ClienteBruto, comSenha: boolean) {
  return {
    id: c.id,
    nome: c.nome,
    cpf: c.cpf,
    criadoEm: c.created_at,
    observacoes: c.observacoes,
    // `null` tanto para "não cadastrada" quanto para "não abriu com a
    // chave atual": nos dois casos não há senha usável para mostrar.
    senhaMeuInss:
      comSenha && c.senha_meu_inss ? decifrar(c.senha_meu_inss) : null,
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const [clientesRes, processosRes] = await Promise.all([
      supabase
        .from("clientes")
        .select("id, nome, cpf, created_at, observacoes, senha_meu_inss, beneficio")
        .in("user_id", await idsDoEscritorio())
        .order("nome"),
      supabase
        .from("processos")
        .select(
          "id, cliente_id, beneficio, esfera, status, situacao_pericia, protocolo_inss, data_entrada"
        )
        .in("user_id", await idsDoEscritorio()),
    ])

    if (clientesRes.error || processosRes.error) {
      console.error(
        "Fila administrativa error:",
        clientesRes.error?.message ?? processosRes.error?.message
      )
      return NextResponse.json(
        { error: "Erro interno do servidor" },
        { status: 500 }
      )
    }

    const comSenha = PAPEIS_COM_SENHA.has(user.role)

    const clientes = (clientesRes.data ?? []) as (ClienteBruto & {
      beneficio: string | null
    })[]
    const fichas = new Map(clientes.map((c) => [c.id, c]))

    // Esfera ausente conta como administrativa: o padrão do banco é
    // ADMINISTRATIVO, e um processo gravado antes do campo existir não
    // pode sumir da tela.
    const administrativos = ((processosRes.data ?? []) as ProcessoBruto[]).filter(
      (p) => !p.esfera || p.esfera === "ADMINISTRATIVO"
    )

    const itens = administrativos.flatMap((p) => {
      const ficha = fichas.get(p.cliente_id)
      if (!ficha) return []

      return [
        {
          id: `p:${p.id}`,
          processoId: p.id,
          beneficio: p.beneficio,
          status: p.status,
          situacaoPericia: p.situacao_pericia,
          protocoloInss: p.protocolo_inss,
          dataEntrada: p.data_entrada,
          cliente: fichaDoCliente(ficha, comSenha),
        },
      ]
    })

    const comProcesso = new Set(administrativos.map((p) => p.cliente_id))

    const semRequerimento = clientes
      .filter((c) => !comProcesso.has(c.id))
      .map((c) => ({
        id: `c:${c.id}`,
        processoId: null,
        // Vazio quando não informado. A tela lê essa string vazia como
        // "a classificar" — ver precisaClassificar em lib/domain/beneficio.
        beneficio: c.beneficio?.trim() ?? "",
        status: null,
        situacaoPericia: null,
        protocoloInss: null,
        dataEntrada: null,
        cliente: fichaDoCliente(c, comSenha),
      }))

    return NextResponse.json(
      { itens: [...itens, ...semRequerimento] },
      { status: 200 }
    )
  } catch (error) {
    console.error("Fila administrativa error:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
