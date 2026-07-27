import { isProcessoStatus, type ProcessoStatus } from "@/lib/domain/processo"
import type { DocumentoINSS } from "@/lib/integracoes/contrato"

/**
 * Tradução de um documento importado em mudanças propostas ao processo.
 *
 * Função pura e sem `server-only` de propósito: a UI usa a mesma
 * derivação para mostrar ao operador exatamente o que será gravado
 * antes de gravar. Se a prévia e a gravação usassem lógicas
 * diferentes, o botão "aplicar" viraria uma caixa-preta — e o
 * operador é quem responde pelo processo.
 *
 * Nada aqui grava nada. Toda proposta é revisável e recusável campo
 * por campo, porque documento do INSS chega com erro e o parser
 * também: mover status de processo automaticamente sem confirmação
 * faria o sistema mentir sobre o andamento real.
 */

export type TarefaPrioridade = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE"

export type TarefaProposta = {
  titulo: string
  descricao?: string
  /** "AAAA-MM-DD" */
  data: string
  prioridade: TarefaPrioridade
}

export type PropostaAplicacao = {
  /** Novo status do processo, quando o documento é conclusivo. */
  status?: ProcessoStatus
  /** Prazo mais urgente extraído do documento. */
  prazo?: string
  /** Texto do andamento a registrar no histórico. */
  andamento?: string
  /** Compromissos a lançar na agenda. */
  tarefas: TarefaProposta[]
  /** Benefício identificado, para preencher o campo do processo. */
  beneficio?: string
  /**
   * Identificadores da fase administrativa. Documento do INSS nunca
   * traz número CNJ — o requerimento é identificado por protocolo, e o
   * benefício concedido por NB.
   */
  protocoloInss?: string
  numeroBeneficio?: string
  /** Rótulo do que o documento é, para a UI resumir a proposta. */
  resumo: string
}

// Acessores tolerantes: `dados` vem de jsonb e não tem garantia de tipo.
function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor.trim() : undefined
}

function numero(valor: unknown): number | undefined {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : undefined
}

function lista(valor: unknown): Record<string, unknown>[] {
  return Array.isArray(valor)
    ? valor.filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
    : []
}

/**
 * Valida contra o vocabulário do domínio em vez de castar. `dados` é
 * jsonb: um valor inesperado gravaria status inválido no processo e
 * quebraria as telas que indexam por status.
 */
function comoStatus(valor: unknown): ProcessoStatus | undefined {
  return isProcessoStatus(valor) ? valor : undefined
}

/**
 * Urgência pela distância até o prazo. Exigência do INSS não cumprida
 * no prazo encerra o requerimento, então prazo curto entra como
 * URGENTE — é o que faz a tarefa aparecer no topo da agenda.
 */
export function prioridadePorPrazo(
  prazoIso: string,
  hojeIso = new Date().toISOString().slice(0, 10)
): TarefaPrioridade {
  const dias = Math.round(
    (Date.parse(`${prazoIso}T12:00:00Z`) - Date.parse(`${hojeIso}T12:00:00Z`)) /
      86_400_000
  )
  if (dias <= 7) return "URGENTE"
  if (dias <= 15) return "ALTA"
  return "MEDIA"
}

function formatarBr(iso?: string): string {
  if (!iso) return "—"
  return iso.split("-").reverse().join("/")
}

function moeda(valor?: number): string {
  if (valor === undefined) return "—"
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function derivarAplicacao(
  documento: DocumentoINSS,
  dados: Record<string, unknown>,
  hojeIso = new Date().toISOString().slice(0, 10)
): PropostaAplicacao {
  const tarefas: TarefaProposta[] = []

  switch (documento) {
    case "REQUERIMENTO_GERID": {
      const protocolo = texto(dados.protocolo)
      const situacao = texto(dados.situacao)
      const unidade = texto(dados.unidade)
      const proximoPrazo = texto(dados.proximoPrazo)
      const periciaEm = texto(dados.periciaEm)

      for (const exigencia of lista(dados.exigencias)) {
        const descricao = texto(exigencia.descricao)
        const prazoAte = texto(exigencia.prazoAte)
        if (!descricao) continue
        tarefas.push({
          titulo: "Cumprir exigência do INSS",
          descricao: prazoAte
            ? `${descricao} (prazo até ${formatarBr(prazoAte)})`
            : descricao,
          // Exigência sem prazo explícito ainda precisa aparecer na
          // agenda: cai em hoje para não ficar invisível.
          data: prazoAte ?? hojeIso,
          prioridade: prazoAte ? prioridadePorPrazo(prazoAte, hojeIso) : "ALTA",
        })
      }

      if (periciaEm) {
        tarefas.push({
          titulo: "Perícia médica no INSS",
          descricao: unidade ? `Unidade: ${unidade}` : undefined,
          data: periciaEm,
          prioridade: "ALTA",
        })
      }

      return {
        status: comoStatus(dados.statusSugerido),
        prazo: proximoPrazo,
        andamento: [
          protocolo ? `GERID ${protocolo}` : "GERID",
          situacao ? `situação: ${situacao}` : null,
          unidade ? `unidade: ${unidade}` : null,
        ]
          .filter(Boolean)
          .join(" — "),
        tarefas,
        beneficio: texto(dados.servico),
        protocoloInss: protocolo,
        resumo: `Requerimento GERID${situacao ? ` — ${situacao}` : ""}`,
      }
    }

    case "CARTA_INDEFERIMENTO": {
      const motivo = texto(dados.motivo)
      const protocolo = texto(dados.protocolo)
      const prazoRecurso = texto(dados.prazoRecursoAte)

      if (prazoRecurso) {
        tarefas.push({
          titulo: "Recorrer à Junta de Recursos",
          descricao: motivo
            ? `Indeferimento: ${motivo}`
            : "Prazo de 30 dias contados da ciência da decisão.",
          data: prazoRecurso,
          // Perder este prazo encerra a via administrativa. Nunca
          // entra como MEDIA, mesmo que a data esteja distante.
          prioridade:
            prioridadePorPrazo(prazoRecurso, hojeIso) === "MEDIA"
              ? "ALTA"
              : prioridadePorPrazo(prazoRecurso, hojeIso),
        })
      }

      return {
        status: "RECUSADO",
        prazo: prazoRecurso,
        andamento: [
          protocolo ? `Indeferido (protocolo ${protocolo})` : "Requerimento indeferido",
          motivo ? `Motivo: ${motivo}` : null,
          prazoRecurso ? `Prazo de recurso até ${formatarBr(prazoRecurso)}` : null,
        ]
          .filter(Boolean)
          .join(" — "),
        tarefas,
        beneficio: texto(dados.servico),
        protocoloInss: protocolo,
        resumo: "Comunicado de decisão — indeferimento",
      }
    }

    case "CARTA_CONCESSAO": {
      const especie = texto(dados.especie)
      const dib = texto(dados.dib)
      const rmi = numero(dados.rmi)
      const nb = texto(dados.numeroBeneficio)

      return {
        status: "BENEFICIO_CONCEDIDO",
        andamento: [
          "Benefício concedido",
          nb ? `NB ${nb}` : null,
          especie ? `espécie ${especie}` : null,
          dib ? `DIB ${formatarBr(dib)}` : null,
          rmi !== undefined ? `RMI ${moeda(rmi)}` : null,
        ]
          .filter(Boolean)
          .join(" — "),
        tarefas,
        beneficio: especie,
        numeroBeneficio: nb,
        resumo: `Carta de concessão${especie ? ` — ${especie}` : ""}`,
      }
    }

    case "EXTRATO_PAGAMENTO": {
      const competencias = lista(dados.competencias)
      // Competência vem como "AAAA-MM"; o operador lê "MM/AAAA".
      const ultima = texto(dados.ultimaCompetencia)
        ?.split("-")
        .reverse()
        .join("/")
      const valorUltima = numero(competencias[competencias.length - 1]?.valor)

      // Extrato não muda status: comprova pagamento, não decide o
      // requerimento.
      return {
        andamento: [
          `Extrato de pagamento importado (${competencias.length} competência(s))`,
          ultima ? `última: ${ultima}` : null,
          valorUltima !== undefined ? `valor ${moeda(valorUltima)}` : null,
        ]
          .filter(Boolean)
          .join(" — "),
        tarefas,
        numeroBeneficio: texto(dados.numeroBeneficio),
        resumo: "Extrato de pagamento",
      }
    }

    case "CNIS": {
      const vinculos = lista(dados.vinculos)
      const meses = numero(dados.mesesVinculo)
      const emCurso = vinculos.filter((v) => !texto(v.dataFim)).length

      // CNIS é insumo de cálculo, não fato processual: não altera
      // status nem cria prazo.
      return {
        andamento: [
          `CNIS importado — ${vinculos.length} vínculo(s)`,
          meses !== undefined ? `${meses} meses de vínculo` : null,
          emCurso > 0 ? `${emCurso} em curso` : null,
        ]
          .filter(Boolean)
          .join(" — "),
        tarefas,
        resumo: "Extrato CNIS",
      }
    }
  }
}
