"use client"

import { useCallback, useEffect, useState } from "react"
import { FileText, Loader2, Trash2, Upload } from "lucide-react"

/**
 * Pasta do caso dentro do CRM.
 *
 * É o que faltava para o sistema ser de fato o centro: o assistente
 * alimenta os documentos aqui, e quem for protocolar encontra tudo
 * reunido em vez de caçar anexo em e-mail. Os arquivos ficam em bucket
 * privado e só abrem por URL assinada de curta duração.
 */

type Documento = {
  id: string
  nome: string
  tipo: string | null
  tamanho: number | null
  createdAt: string
}

function formatarTamanho(bytes?: number | null) {
  if (!bytes) return ""
  // Arredondar para baixo mostrava "0 KB" em arquivo pequeno, o que
  // parece upload quebrado.
  if (bytes < 1024) return "menos de 1 KB"
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function DocumentosProcesso({
  processoId,
  onMudou,
}: {
  processoId: string
  /** Avisa a tela para recontar documentos no preparo do protocolo. */
  onMudou?: () => void
}) {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    return fetch(`/api/documentos?processoId=${processoId}`)
      .then((r) => (r.ok ? r.json() : { documentos: [] }))
      .then((d) => setDocumentos(d.documentos ?? []))
      .catch((e) => console.error("Erro ao carregar documentos:", e))
  }, [processoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function enviar(arquivo: File) {
    setEnviando(true)
    setErro(null)
    try {
      const form = new FormData()
      form.append("arquivo", arquivo)
      form.append("processoId", processoId)
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

  return (
    <div className="mt-2 border-t border-slate-100 pt-2 dark:border-zinc-800">
      <p className="text-sm font-medium">
        Documentos{documentos.length > 0 ? ` (${documentos.length})` : ""}
      </p>

      {documentos.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-sm">
          {documentos.map((doc) => (
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
      )}

      {erro && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{erro}</p>
      )}

      <label className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 text-sm text-blue-700 hover:underline dark:text-blue-400">
        {enviando ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Upload size={14} />
        )}
        Anexar documento
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
  )
}
