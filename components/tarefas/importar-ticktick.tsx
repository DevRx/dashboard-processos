"use client"

import { useRef, useState } from "react"
import { Loader2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"

type Resultado = {
  lidas: number
  novas: number
  jaExistiam: number
  abertas: number
  concluidas: number
  canceladas: number
  semTime: number
}

/**
 * Trazer as tarefas do TickTick: escolher o backup (.csv) e pronto.
 *
 * Reimportar a mesma planilha, ou uma mais nova, só acrescenta o que
 * faltava — ver app/api/tarefas/importar/route.ts.
 */
export function ImportarTickTick({ onImportou }: { onImportou: () => void }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(arquivo: File) {
    setEnviando(true)
    setErro(null)
    setResultado(null)
    try {
      const form = new FormData()
      form.append("arquivo", arquivo)
      const r = await fetch("/api/tarefas/importar", { method: "POST", body: form })
      const corpo = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(corpo.error ?? "Não foi possível importar")
      setResultado(corpo)
      onImportou()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível importar")
    } finally {
      setEnviando(false)
      if (entrada.current) entrada.current.value = ""
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={entrada}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const arquivo = e.target.files?.[0]
          if (arquivo) enviar(arquivo)
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={enviando}
        onClick={() => entrada.current?.click()}
      >
        {enviando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {enviando ? "Importando…" : "Importar do TickTick"}
      </Button>

      {resultado ? (
        <p className="text-[12.5px] text-muted-foreground">
          <strong className="text-foreground">{resultado.novas.toLocaleString("pt-BR")} tarefas importadas</strong>
          {resultado.jaExistiam > 0
            ? ` · ${resultado.jaExistiam.toLocaleString("pt-BR")} já estavam aqui`
            : ""}
          {` · ${resultado.abertas} em aberto no quadro, ${resultado.concluidas.toLocaleString("pt-BR")} concluídas no histórico`}
          {resultado.semTime > 0 ? ` · ${resultado.semTime} sem time` : ""}
        </p>
      ) : null}

      {erro ? <p className="text-[12.5px] text-destructive">{erro}</p> : null}
    </div>
  )
}
