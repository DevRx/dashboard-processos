"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  CATEGORIAS_DOCUMENTO,
  CATEGORIA_DOCUMENTO_LABELS,
  faltandoNaPasta,
  getCategoriaLabel,
  type CategoriaDocumento,
} from "@/lib/domain/documento"
import { FileText, Loader2, Trash2, Upload } from "lucide-react"

/**
 * Pasta de documentos do cliente.
 *
 * RG, CPF, comprovante de residência e procuração são do titular:
 * valem para todos os casos e existem antes de qualquer requerimento.
 * Antes ficavam presos ao processo, o que criava um impasse — não dava
 * para montar a pasta antes de abrir o caso, que é a ordem em que o
 * trabalho realmente acontece.
 *
 * O vínculo com um caso continua possível, para o que é específico de
 * um pedido: laudo médico, carta de decisão.
 */

type Documento = {
  id: string
  nome: string
  categoria: string
  processoId: string | null
  tipo: string | null
  tamanho: number | null
  createdAt: string
}

export type ProcessoOpcao = {
  id: string
  beneficio: string
}

function formatarTamanho(bytes?: number | null) {
  if (!bytes) return ""
  // Arredondar para baixo mostrava "0 KB" em arquivo pequeno, o que
  // parece upload quebrado.
  if (bytes < 1024) return "menos de 1 KB"
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function DocumentosCliente({
  clienteId,
  processos,
  onMudou,
}: {
  clienteId: string
  processos: ProcessoOpcao[]
  onMudou?: () => void
}) {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [categoria, setCategoria] = useState<CategoriaDocumento>("IDENTIFICACAO")
  const [processoId, setProcessoId] = useState("")

  const carregar = useCallback(() => {
    return fetch(`/api/documentos?clienteId=${clienteId}`)
      .then((r) => (r.ok ? r.json() : { documentos: [] }))
      .then((d) => setDocumentos(d.documentos ?? []))
      .catch((e) => console.error("Erro ao carregar documentos:", e))
      .finally(() => setCarregando(false))
  }, [clienteId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function enviar(arquivo: File) {
    setEnviando(true)
    setErro(null)
    try {
      const form = new FormData()
      form.append("arquivo", arquivo)
      form.append("clienteId", clienteId)
      form.append("categoria", categoria)
      if (processoId) form.append("processoId", processoId)

      const res = await fetch("/api/documentos/upload", {
        method: "POST",
        body: form,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErro(data.error ?? "Não foi possível enviar")
        return
      }
      await carregar()
      onMudou?.()
    } catch {
      setErro("Erro de conexão.")
    } finally {
      setEnviando(false)
    }
  }

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir "${nome}"? O arquivo sai do sistema.`)) return
    await fetch(`/api/documentos/${id}`, { method: "DELETE" })
    await carregar()
    onMudou?.()
  }

  const faltando = faltandoNaPasta(documentos.map((d) => d.categoria))

  // Agrupado por categoria: a pasta só serve se der para achar pelo
  // tipo. Nome de arquivo chega como "scan_0012.pdf".
  const porCategoria = CATEGORIAS_DOCUMENTO.map((cat) => ({
    categoria: cat,
    itens: documentos.filter((d) => d.categoria === cat),
  })).filter((g) => g.itens.length > 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Documentos do cliente</CardTitle>
        {!carregando && (
          <Badge variant={documentos.length ? "secondary" : "outline"}>
            {documentos.length} arquivo(s)
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {faltando.length > 0 && !carregando && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Faltando na pasta:{" "}
            {faltando.map((c) => CATEGORIA_DOCUMENTO_LABELS[c]).join(", ")}.
          </p>
        )}

        {porCategoria.length === 0 && !carregando && (
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Nenhum documento ainda. Suba RG, CPF e comprovante de residência
            para adiantar o protocolo.
          </p>
        )}

        {porCategoria.map((grupo) => (
          <div key={grupo.categoria}>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-zinc-500">
              {CATEGORIA_DOCUMENTO_LABELS[grupo.categoria]}
            </p>
            <ul className="mt-0.5 space-y-0.5 text-sm">
              {grupo.itens.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2">
                  <a
                    href={`/api/documentos/${doc.id}/arquivo`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 text-blue-700 hover:underline dark:text-blue-400"
                  >
                    <FileText size={13} className="shrink-0" />
                    <span className="truncate">{doc.nome}</span>
                  </a>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-zinc-500">
                    {formatarTamanho(doc.tamanho)}
                  </span>
                  {doc.processoId && (
                    <Badge variant="outline" className="shrink-0">
                      {processos.find((p) => p.id === doc.processoId)
                        ?.beneficio ?? "caso"}
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => excluir(doc.id, doc.nome)}
                    className="shrink-0 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                    aria-label={`Excluir ${doc.nome}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}

        <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-zinc-800">
          <select
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaDocumento)}
          >
            {CATEGORIAS_DOCUMENTO.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_DOCUMENTO_LABELS[c]}
              </option>
            ))}
          </select>

          {/* Vincular a um caso é opcional: RG não pertence a
              requerimento nenhum, laudo geralmente pertence. */}
          {processos.length > 0 && (
            <select
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={processoId}
              onChange={(e) => setProcessoId(e.target.value)}
            >
              <option value="">Vale para todos os casos</option>
              {processos.map((p) => (
                <option key={p.id} value={p.id}>
                  Específico de: {p.beneficio}
                </option>
              ))}
            </select>
          )}

          <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-blue-700 hover:underline dark:text-blue-400">
            {enviando ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            Anexar {getCategoriaLabel(categoria).toLowerCase()}
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              disabled={enviando}
              onChange={(e) => {
                const arquivo = e.target.files?.[0]
                // Limpa o input para permitir reenviar o mesmo arquivo
                // depois de um erro — sem isto o onChange não dispara.
                e.target.value = ""
                if (arquivo) enviar(arquivo)
              }}
            />
          </label>
          <span className="ml-2 text-xs text-slate-500 dark:text-zinc-500">
            PDF, JPG ou PNG até 20 MB
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
