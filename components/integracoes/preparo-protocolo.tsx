"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  avaliarPreparo,
  documentosDaEspecie,
  temBloqueio,
  URL_GERID,
  URL_MEU_INSS,
  type Pendencia,
} from "@/lib/domain/protocolo"
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react"

/**
 * Preparo do protocolo administrativo.
 *
 * O CRM não protocola: não há API, e o acesso a sistemas externos do
 * INSS exige certificado A3, cuja chave privada não sai do token. O
 * que dá para fazer é chegar no GERID com tudo conferido e trazer o
 * protocolo de volta — que é onde estava o trabalho manual de verdade.
 *
 * Aparece só em requerimento administrativo ainda não protocolado.
 * Depois disso o bloco some sozinho: espaço ocupado por tarefa
 * concluída é ruído.
 */

type ProcessoPreparo = {
  id: string
  beneficio: string
  esfera?: string | null
  status: string
  protocoloInss?: string | null
  responsavelId?: string | null
}

type ClientePreparo = {
  cpf?: string | null
  dataNascimento?: string | null
  telefone?: string | null
  email?: string | null
}

function LinhaPendencia({ pendencia }: { pendencia: Pendencia }) {
  const bloqueio = pendencia.gravidade === "bloqueio"
  return (
    <li
      className={
        bloqueio
          ? "flex items-start gap-1.5 text-red-700 dark:text-red-400"
          : "flex items-start gap-1.5 text-amber-700 dark:text-amber-400"
      }
    >
      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
      <span>{pendencia.texto}</span>
    </li>
  )
}

export function PreparoProtocolo({
  cliente,
  processo,
  outrosProcessos,
  baseLegal,
  usuarios,
  onProtocolado,
}: {
  cliente: ClientePreparo
  processo: ProcessoPreparo
  outrosProcessos: ProcessoPreparo[]
  baseLegal: { temVigente: boolean; temPdf: boolean }
  /** Quem pode receber a tarefa de protocolar. */
  usuarios: { id: string; name: string }[]
  onProtocolado?: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [protocolo, setProtocolo] = useState("")
  const [dataEntrada, setDataEntrada] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const [destinatario, setDestinatario] = useState("")
  const [observacao, setObservacao] = useState("")
  // Padrão de hoje: a tarefa nasce com data, senão o formulário exige
  // uma decisão que raramente muda.
  const [dataTarefa, setDataTarefa] = useState(
    new Date().toISOString().slice(0, 10)
  )

  async function gerarTarefa() {
    setEnviando(true)
    setErro(null)
    setAviso(null)
    try {
      const res = await fetch(`/api/processos/${processo.id}/tarefa-protocolo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responsavelId: destinatario || undefined,
          data: dataTarefa,
          observacao: observacao || undefined,
          baseLegal,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error)
        return
      }
      setObservacao("")
      setAviso(data.message)
    } catch {
      setErro("Erro de conexão.")
    } finally {
      setEnviando(false)
    }
  }

  const administrativo = (processo.esfera ?? "ADMINISTRATIVO") === "ADMINISTRATIVO"
  if (!administrativo || processo.protocoloInss) return null

  const pendencias = avaliarPreparo({
    cliente,
    processo,
    outrosProcessos,
    baseLegal,
  })
  const bloqueado = temBloqueio(pendencias)
  const bloqueios = pendencias.filter((p) => p.gravidade === "bloqueio").length
  const avisos = pendencias.length - bloqueios
  const documentos = documentosDaEspecie(processo.beneficio)

  async function registrarProtocolo() {
    setEnviando(true)
    setErro(null)
    try {
      const res = await fetch(`/api/processos/${processo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocoloInss: protocolo,
          dataEntrada: dataEntrada || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error)
        return
      }
      setProtocolo("")
      onProtocolado?.()
    } catch {
      setErro("Erro de conexão.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mt-2 border-t border-slate-100 pt-2 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="flex items-center gap-1.5 text-sm text-blue-700 hover:underline dark:text-blue-400"
      >
        Preparar protocolo
        {/* Os dois selos convivem: mostrar só os impedimentos faria o
            número brigar com a quantidade de linhas listadas abaixo. */}
        {bloqueado ? (
          <>
            <Badge variant="destructive">{bloqueios} impedimento(s)</Badge>
            {avisos > 0 && <Badge variant="outline">{avisos} aviso(s)</Badge>}
          </>
        ) : pendencias.length > 0 ? (
          <Badge variant="outline">{avisos} aviso(s)</Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 size={11} /> pronto
          </Badge>
        )}
      </button>

      {aberto && (
        <div className="mt-2 space-y-3 text-sm">
          {erro && (
            <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>
          )}
          {aviso && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              {aviso}
            </p>
          )}

          {pendencias.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {pendencias.map((p, i) => (
                <LinhaPendencia key={i} pendencia={p} />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Dados do segurado e base legal conferidos. Nenhum impedimento
              conhecido.
            </p>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer text-slate-600 dark:text-zinc-400">
              Documentos para montar a pasta
            </summary>
            <ul className="mt-1.5 ml-4 list-disc space-y-0.5 text-slate-700 dark:text-zinc-300">
              {documentos.comuns.map((d) => (
                <li key={d}>{d}</li>
              ))}
              {documentos.especificos.map((d) => (
                <li key={d} className="font-medium">
                  {d}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-slate-500 dark:text-zinc-500">
              Guia de conferência, não lista legal exaustiva — a exigência varia
              com o caso e o INSS a altera por instrução normativa.
            </p>
          </details>

          <div className="flex flex-wrap gap-2">
            <a
              href={URL_GERID}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm dark:border-zinc-700"
            >
              <ExternalLink size={15} /> GERID (advogado)
            </a>
            <a
              href={URL_MEU_INSS}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm dark:border-zinc-700"
            >
              <ExternalLink size={15} /> Meu INSS
            </a>
          </div>

          {/* Passe de bastão: quem monta o caso raramente é quem
              protocola. A tarefa leva o contexto junto. */}
          <div className="space-y-1.5 rounded-lg border border-slate-200 p-2.5 dark:border-zinc-800">
            <p className="text-xs font-medium">Passar para quem vai protocolar</p>
            <select
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
            >
              <option value="">
                {processo.responsavelId
                  ? "Responsável do caso"
                  : "Eu mesmo"}
              </option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <label className="block text-xs text-slate-600 dark:text-zinc-400">
              Para quando
              <Input
                type="date"
                value={dataTarefa}
                onChange={(e) => setDataTarefa(e.target.value)}
              />
            </label>
            <Input
              placeholder="Observação para quem vai protocolar (opcional)"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={enviando || !dataTarefa}
              onClick={gerarTarefa}
            >
              {enviando ? <Loader2 size={15} className="animate-spin" /> : null}
              Gerar tarefa de protocolo
            </Button>
          </div>

          <div className="space-y-1.5 rounded-lg border border-slate-200 p-2.5 dark:border-zinc-800">
            <p className="text-xs font-medium">Protocolou? Registre aqui</p>
            <Input
              placeholder="Número do protocolo"
              value={protocolo}
              onChange={(e) => setProtocolo(e.target.value)}
            />
            <label className="block text-xs text-slate-600 dark:text-zinc-400">
              Data de entrada do requerimento (DER)
              <Input
                type="date"
                value={dataEntrada}
                onChange={(e) => setDataEntrada(e.target.value)}
              />
            </label>
            <Button
              size="sm"
              disabled={enviando || protocolo.trim().length < 3}
              onClick={registrarProtocolo}
            >
              {enviando ? <Loader2 size={15} className="animate-spin" /> : null}
              Registrar protocolo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
