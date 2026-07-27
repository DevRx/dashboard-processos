"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  derivarAplicacao,
  type PropostaAplicacao,
} from "@/lib/integracoes/aplicar"
import {
  getProcessoStatusLabel,
  type ProcessoStatus,
} from "@/lib/domain/processo"
import {
  Download,
  FileText,
  Loader2,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react"

/**
 * Painel de integração INSS no detalhe do cliente.
 *
 * A ordem visual repete a ordem legal: primeiro a base legal, depois a
 * importação, depois a aplicação ao processo. Enquanto não há base
 * legal vigente, o campo de colar documento não aparece — a API
 * recusaria de todo modo, e oferecer o campo antes ensinaria o
 * operador a tratar dado sensível primeiro e documentar depois.
 *
 * O painel mostra por padrão só o que é decisão de quem opera. A fonte
 * do documento não é perguntada: o conteúdo revela de onde veio, e o
 * seletor manual de tipo só aparece quando a detecção falha. Escopo de
 * fontes, prazo de retenção e direitos do titular ficam atrás de
 * revelação — continuam a um clique, sem ocupar a tela de quem só quer
 * lançar um documento.
 *
 * A prévia usa `derivarAplicacao`, a mesma função que a rota de
 * aplicação usa para gravar. O que está na tela é literalmente o que
 * será escrito.
 */

type BaseLegal = "CONSENTIMENTO" | "OBRIGACAO_LEGAL" | "EXERCICIO_DIREITOS"
type Fonte = "MEU_INSS" | "GERID"
type Documento =
  | "CNIS"
  | "CARTA_CONCESSAO"
  | "CARTA_INDEFERIMENTO"
  | "EXTRATO_PAGAMENTO"
  | "REQUERIMENTO_GERID"

const BASE_LEGAL_OPCOES: { valor: BaseLegal; rotulo: string }[] = [
  { valor: "EXERCICIO_DIREITOS", rotulo: "Procuração — exercício de direitos (art. 11, II, “d”)" },
  { valor: "CONSENTIMENTO", rotulo: "Consentimento do titular (art. 11, I)" },
  { valor: "OBRIGACAO_LEGAL", rotulo: "Obrigação legal (art. 11, II, “a”)" },
]

const DOCUMENTO_LABELS: Record<string, string> = {
  CNIS: "Extrato CNIS",
  CARTA_CONCESSAO: "Carta de concessão",
  CARTA_INDEFERIMENTO: "Comunicado de decisão",
  EXTRATO_PAGAMENTO: "Extrato de pagamento",
  REQUERIMENTO_GERID: "Requerimento GERID",
}

type Consentimento = {
  id: string
  baseLegal: BaseLegal
  finalidade: string
  procuracaoRef: string | null
  procuracaoArquivo: string | null
  procuracaoNome: string | null
  fontes: string[]
  vigenteDesde: string
  retencaoAte: string | null
  revogadoEm: string | null
}

type Importacao = {
  id: string
  fonte: string
  documento: string | null
  dados: Record<string, unknown>
  processoId: string | null
  createdAt: string
  expurgadoEm: string | null
}

export type ProcessoResumo = {
  id: string
  beneficio: string
  numero?: string | null
  status: string
}

type Mensagem = { tipo: "ok" | "erro"; texto: string }

/** Campos da proposta que o operador confirma um a um. */
type Confirmacao = {
  status: boolean
  prazo: boolean
  andamento: boolean
  tarefas: boolean
  beneficio: boolean
  identificadores: boolean
}

function formatarData(iso?: string | null) {
  if (!iso) return "—"
  return iso.slice(0, 10).split("-").reverse().join("/")
}

export function PainelInss({
  clienteId,
  processos,
  onAplicado,
}: {
  clienteId: string
  processos: ProcessoResumo[]
  /** Chamado após aplicar, para a página recarregar o processo. */
  onAplicado?: () => void
}) {
  const [consentimentos, setConsentimentos] = useState<Consentimento[]>([])
  const [importacoes, setImportacoes] = useState<Importacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState<Mensagem | null>(null)
  const [enviando, setEnviando] = useState(false)

  const [baseLegal, setBaseLegal] = useState<BaseLegal>("EXERCICIO_DIREITOS")
  const [finalidade, setFinalidade] = useState("")
  const [procuracaoRef, setProcuracaoRef] = useState("")
  const [retencaoAte, setRetencaoAte] = useState("")
  const [fontes, setFontes] = useState<Fonte[]>(["MEU_INSS", "GERID"])
  /** PDF escolhido no formulário, enviado depois de salvar a base legal. */
  const [procuracaoPdf, setProcuracaoPdf] = useState<File | null>(null)

  // Corrigir a base legal vigente. Sem isto o único caminho para
  // arrumar um dado errado seria revogar e recriar, o que suja o
  // histórico com uma revogação que não aconteceu de verdade.
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [texto, setTexto] = useState("")
  // Só ganha valor quando a detecção automática falha.
  const [tipoManual, setTipoManual] = useState<Documento | "">("")
  const [precisaTipo, setPrecisaTipo] = useState(false)

  // Importação recém-criada, aguardando aplicação.
  const [pendente, setPendente] = useState<Importacao | null>(null)
  const [processoId, setProcessoId] = useState("")
  const [confirmacao, setConfirmacao] = useState<Confirmacao>({
    status: true,
    prazo: true,
    andamento: true,
    tarefas: true,
    beneficio: false,
    identificadores: true,
  })

  const vigente = consentimentos.find((c) => !c.revogadoEm) ?? null

  // Um único processo torna a escolha desnecessária: fica pré-selecionado.
  // Derivado em vez de guardado em estado — sincronizar por efeito daria
  // um render a mais e um caminho para o valor divergir da lista.
  const processoDestino =
    processoId || (processos.length === 1 ? processos[0].id : "")

  // Escrito em `.then` de propósito: o estado só é atualizado dentro do
  // callback da promise, nunca no corpo do efeito.
  //
  // Também não marca `carregando` no início — o estado já nasce true, e
  // voltar a true numa recarga faria o selo de base legal piscar entre
  // "vigente" e "sem base legal". É o pior lugar possível para um aviso
  // de conformidade tremer na tela.
  const carregar = useCallback(() => {
    return Promise.all([
      fetch(`/api/lgpd/consentimentos?clienteId=${clienteId}`).then((r) =>
        r.ok ? r.json() : { consentimentos: [] }
      ),
      fetch(`/api/integracoes/importacoes?clienteId=${clienteId}`).then((r) =>
        r.ok ? r.json() : { importacoes: [] }
      ),
    ])
      .then(([bases, imports]) => {
        setConsentimentos(bases.consentimentos ?? [])
        setImportacoes(imports.importacoes ?? [])
      })
      .catch((err) => console.error("Erro ao carregar integração INSS:", err))
      .finally(() => setCarregando(false))
  }, [clienteId])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Abre o formulário já preenchido com a base legal vigente. */
  function editarBaseLegal(atual: Consentimento) {
    setBaseLegal(atual.baseLegal)
    setFinalidade(atual.finalidade)
    setProcuracaoRef(atual.procuracaoRef ?? "")
    setRetencaoAte(atual.retencaoAte?.slice(0, 10) ?? "")
    setFontes(atual.fontes.filter((f): f is Fonte => f !== "DATAJUD"))
    setProcuracaoPdf(null)
    setEditandoId(atual.id)
    setMensagem(null)
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setFinalidade("")
    setProcuracaoRef("")
    setProcuracaoPdf(null)
    setRetencaoAte("")
    setFontes(["MEU_INSS", "GERID"])
    setMensagem(null)
  }

  async function salvarBaseLegal() {
    setEnviando(true)
    setMensagem(null)
    try {
      const corpo = {
        baseLegal,
        finalidade,
        // Anexado o PDF, o nome do arquivo já identifica a procuração —
        // não faz sentido exigir que o operador redigite a referência.
        procuracaoRef: procuracaoRef || procuracaoPdf?.name || undefined,
        retencaoAte: retencaoAte || undefined,
        fontes,
      }
      const res = await fetch(
        editandoId
          ? `/api/lgpd/consentimentos/${editandoId}`
          : "/api/lgpd/consentimentos",
        {
          method: editandoId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editandoId ? corpo : { clienteId, ...corpo }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setMensagem({ tipo: "erro", texto: data.error })
        return
      }
      // O upload vem depois porque precisa do id da base legal. Se
      // falhar, a base legal continua válida e o aviso diz exatamente
      // o que faltou — em vez de desfazer um registro que está correto.
      let avisoAnexo = ""
      if (procuracaoPdf && data.consentimento?.id) {
        const formData = new FormData()
        formData.append("arquivo", procuracaoPdf)
        const anexo = await fetch(
          `/api/lgpd/consentimentos/${data.consentimento.id}/procuracao`,
          { method: "POST", body: formData }
        )
        if (!anexo.ok) {
          const erro = await anexo.json().catch(() => ({}))
          avisoAnexo = ` Mas o PDF não subiu: ${erro.error ?? "erro no envio"}.`
        }
      }

      setEditandoId(null)
      setFinalidade("")
      setProcuracaoRef("")
      setProcuracaoPdf(null)
      setMensagem({
        tipo: avisoAnexo ? "erro" : "ok",
        texto: (data.message ?? "Base legal registrada.") + avisoAnexo,
      })
      carregar()
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro de conexão." })
    } finally {
      setEnviando(false)
    }
  }

  async function revogar(id: string) {
    const motivo = prompt("Motivo da revogação:")
    if (!motivo) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/lgpd/consentimentos/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      })
      const data = await res.json()
      setMensagem(
        res.ok
          ? { tipo: "ok", texto: "Base legal revogada." }
          : { tipo: "erro", texto: data.error }
      )
      carregar()
    } finally {
      setEnviando(false)
    }
  }

  async function importar() {
    setEnviando(true)
    setMensagem(null)
    setPendente(null)
    try {
      const res = await fetch("/api/integracoes/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          texto,
          documento: tipoManual || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPrecisaTipo(Boolean(data.precisaTipo))
        setMensagem({ tipo: "erro", texto: data.error })
        return
      }
      setPrecisaTipo(false)
      setTipoManual("")
      setPendente(data.importacao ?? null)
      setTexto("")
      setMensagem({
        tipo: "ok",
        texto: data.duplicada
          ? "Este documento já havia sido importado — revise abaixo e aplique se ainda quiser."
          : "Documento lido. Revise o que será gravado antes de aplicar.",
      })
      carregar()
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro de conexão." })
    } finally {
      setEnviando(false)
    }
  }

  /**
   * `criarRequerimento` abre um processo administrativo a partir do
   * próprio documento. É o caminho quando o cliente ainda não tem nada
   * cadastrado — o requerimento no INSS costuma ser o primeiro fato do
   * caso, e não tem número CNJ para preencher em formulário nenhum.
   */
  async function aplicar(importacaoId: string, criarRequerimento = false) {
    if (!criarRequerimento && !processoDestino) {
      setMensagem({ tipo: "erro", texto: "Escolha o processo de destino." })
      return
    }
    setEnviando(true)
    setMensagem(null)
    try {
      const res = await fetch(
        `/api/integracoes/importacoes/${importacaoId}/aplicar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            criarRequerimento
              ? { criarRequerimento: true, ...confirmacao }
              : { processoId: processoDestino, ...confirmacao }
          ),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setMensagem({ tipo: "erro", texto: data.error })
        return
      }
      setPendente(null)
      setMensagem({ tipo: "ok", texto: data.message })
      carregar()
      onAplicado?.()
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro de conexão." })
    } finally {
      setEnviando(false)
    }
  }

  async function eliminar() {
    if (
      !confirm(
        "Eliminar os dados importados do INSS deste titular? Processos e documentos do mandato são mantidos por obrigação legal."
      )
    )
      return
    setEnviando(true)
    try {
      const res = await fetch(`/api/lgpd/titular/${clienteId}`, {
        method: "DELETE",
      })
      const data = await res.json()
      setMensagem(
        res.ok
          ? { tipo: "ok", texto: data.message }
          : { tipo: "erro", texto: data.error }
      )
      setPendente(null)
      carregar()
    } finally {
      setEnviando(false)
    }
  }

  function alternarFonte(fonte: Fonte) {
    setFontes((atual) =>
      atual.includes(fonte)
        ? atual.filter((f) => f !== fonte)
        : [...atual, fonte]
    )
  }

  function alternarConfirmacao(campo: keyof Confirmacao) {
    setConfirmacao((atual) => ({ ...atual, [campo]: !atual[campo] }))
  }

  const proposta: PropostaAplicacao | null =
    pendente?.documento && !pendente.expurgadoEm
      ? derivarAplicacao(
          pendente.documento as Parameters<typeof derivarAplicacao>[0],
          pendente.dados ?? {}
        )
      : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Integração INSS</CardTitle>
        {!carregando &&
          (vigente ? (
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck size={12} /> Base legal vigente
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <ShieldAlert size={12} /> Sem base legal
            </Badge>
          ))}
      </CardHeader>

      <CardContent className="space-y-4">
        {mensagem && (
          <p
            className={
              mensagem.tipo === "erro"
                ? "text-sm text-red-600 dark:text-red-400"
                : "text-sm text-emerald-700 dark:text-emerald-400"
            }
          >
            {mensagem.texto}
          </p>
        )}

        {/* ── Base legal ──
            Enquanto carrega não se afirma nada. Renderizar o formulário
            de registro antes da resposta diria "este titular não tem
            base legal" sem saber — e é justamente o aviso que não pode
            piscar em falso. */}
        {carregando ? (
          <Skeleton className="h-28 w-full" />
        ) : vigente && !editandoId ? (
          <div className="space-y-1 rounded-lg border border-slate-200 p-3 text-sm dark:border-zinc-800">
            <p className="font-medium">
              {BASE_LEGAL_OPCOES.find((o) => o.valor === vigente.baseLegal)
                ?.rotulo ?? vigente.baseLegal}
            </p>
            <p className="text-slate-600 dark:text-zinc-400">
              {vigente.finalidade}
            </p>
            <p className="text-slate-600 dark:text-zinc-400">
              Procuração:{" "}
              {vigente.procuracaoArquivo ? (
                <a
                  href={`/api/lgpd/consentimentos/${vigente.id}/procuracao`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-700 underline dark:text-blue-400"
                >
                  <FileText size={13} />
                  {vigente.procuracaoNome || "abrir PDF"}
                </a>
              ) : (
                vigente.procuracaoRef || (
                  <span className="text-amber-700 dark:text-amber-400">
                    não informada
                  </span>
                )
              )}
              {vigente.procuracaoArquivo || !vigente.procuracaoRef ? null : (
                <span className="text-amber-700 dark:text-amber-400">
                  {" "}
                  · PDF não anexado
                </span>
              )}
              {vigente.retencaoAte
                ? ` · retenção até ${formatarData(vigente.retencaoAte)}`
                : ""}
            </p>
            <div className="flex flex-wrap gap-1 pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={enviando}
                onClick={() => editarBaseLegal(vigente)}
              >
                <Pencil size={14} /> Corrigir
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={enviando}
                onClick={() => revogar(vigente.id)}
              >
                Revogar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-zinc-800">
            <p className="text-sm font-medium">
              {editandoId ? "Corrigir base legal" : "Registrar base legal"}
            </p>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Dado previdenciário é sensível. Sem isto o sistema não lê nenhum
              documento do titular.
            </p>
            <select
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              value={baseLegal}
              onChange={(e) => setBaseLegal(e.target.value as BaseLegal)}
            >
              {BASE_LEGAL_OPCOES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
            <Input
              placeholder="Para que os dados serão usados (ex.: revisão de aposentadoria por idade)"
              value={finalidade}
              onChange={(e) => setFinalidade(e.target.value)}
            />
            <Input
              placeholder={
                baseLegal === "EXERCICIO_DIREITOS"
                  ? "Procuração (obrigatória) — ex.: ad judicia de 12/03/2026"
                  : "Procuração (opcional)"
              }
              value={procuracaoRef}
              onChange={(e) => setProcuracaoRef(e.target.value)}
            />
            <label className="block text-xs text-slate-600 dark:text-zinc-400">
              Anexar a procuração em PDF
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setProcuracaoPdf(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm file:mr-3 file:h-8 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:text-sm dark:file:border-zinc-700 dark:file:bg-zinc-900 dark:file:text-zinc-100"
              />
              {procuracaoPdf && (
                <span className="mt-1 block text-slate-600 dark:text-zinc-400">
                  {procuracaoPdf.name} ·{" "}
                  {(procuracaoPdf.size / 1024).toFixed(0)} KB
                </span>
              )}
            </label>

            {/* Escopo e retenção têm padrão sensato: ambas as fontes,
                sem prazo. Ficam aqui para quem precisa restringir. */}
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-600 dark:text-zinc-400">
                Restringir fontes ou definir retenção
              </summary>
              <div className="mt-2 space-y-2">
                <div className="flex gap-3 text-sm">
                  {(["MEU_INSS", "GERID"] as Fonte[]).map((f) => (
                    <label key={f} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={fontes.includes(f)}
                        onChange={() => alternarFonte(f)}
                      />
                      {f === "MEU_INSS" ? "Meu INSS" : "GERID"}
                    </label>
                  ))}
                </div>
                <label className="block text-slate-600 dark:text-zinc-400">
                  Apagar os dados importados a partir de
                  <Input
                    type="date"
                    value={retencaoAte}
                    onChange={(e) => setRetencaoAte(e.target.value)}
                  />
                </label>
              </div>
            </details>

            <div className="flex gap-2">
              <Button size="sm" disabled={enviando} onClick={salvarBaseLegal}>
                {enviando ? <Loader2 size={16} className="animate-spin" /> : null}
                {editandoId ? "Salvar correção" : "Registrar"}
              </Button>
              {editandoId && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={enviando}
                  onClick={cancelarEdicao}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Importação assistida ── */}
        {vigente && !editandoId && !proposta && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Colar documento do INSS</p>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Abra o CNIS, a carta de concessão, o comunicado de decisão, o
              extrato de pagamento ou o requerimento no portal oficial e cole o
              texto. O tipo é reconhecido sozinho.
            </p>
            <textarea
              className="min-h-28 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs shadow-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder="Cole aqui…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />

            {precisaTipo && (
              <select
                className="h-9 w-full rounded-lg border border-amber-400 bg-white px-2.5 text-sm dark:bg-zinc-950 dark:text-zinc-100"
                value={tipoManual}
                onChange={(e) => setTipoManual(e.target.value as Documento)}
              >
                <option value="">Escolha o tipo de documento…</option>
                {Object.entries(DOCUMENTO_LABELS).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            )}

            <Button
              size="sm"
              disabled={enviando || texto.trim().length < 20}
              onClick={importar}
            >
              {enviando ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              Ler documento
            </Button>

          </div>
        )}

        {/* ── Prévia e aplicação ── */}
        {pendente && proposta && (
          <div className="space-y-3 rounded-lg border border-blue-300 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/30">
            <p className="text-sm font-semibold">{proposta.resumo}</p>

            {processos.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                Este cliente ainda não tem caso aberto. O documento abre um
                requerimento administrativo
                {proposta.protocoloInss
                  ? `, protocolo ${proposta.protocoloInss}`
                  : ""}
                .
              </p>
            ) : (
              processos.length > 1 && (
                <label className="block text-xs text-slate-600 dark:text-zinc-400">
                  Aplicar ao processo
                  <select
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    value={processoDestino}
                    onChange={(e) => setProcessoId(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {processos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.beneficio}
                        {p.numero ? ` · ${p.numero}` : ""} ·{" "}
                        {getProcessoStatusLabel(p.status)}
                      </option>
                    ))}
                  </select>
                </label>
              )
            )}

            <div className="space-y-1.5 text-sm">
              {proposta.status && (
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={confirmacao.status}
                    onChange={() => alternarConfirmacao("status")}
                  />
                  <span>
                    Status →{" "}
                    <strong>
                      {getProcessoStatusLabel(proposta.status as ProcessoStatus)}
                    </strong>
                  </span>
                </label>
              )}

              {proposta.prazo && (
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={confirmacao.prazo}
                    onChange={() => alternarConfirmacao("prazo")}
                  />
                  <span>
                    Prazo → <strong>{formatarData(proposta.prazo)}</strong>
                  </span>
                </label>
              )}

              {proposta.beneficio && (
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={confirmacao.beneficio}
                    onChange={() => alternarConfirmacao("beneficio")}
                  />
                  <span>
                    Benefício → <strong>{proposta.beneficio}</strong>
                  </span>
                </label>
              )}

              {(proposta.protocoloInss || proposta.numeroBeneficio) &&
                processos.length > 0 && (
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={confirmacao.identificadores}
                      onChange={() => alternarConfirmacao("identificadores")}
                    />
                    <span>
                      {proposta.protocoloInss && (
                        <>
                          Protocolo INSS →{" "}
                          <strong>{proposta.protocoloInss}</strong>
                        </>
                      )}
                      {proposta.protocoloInss && proposta.numeroBeneficio && " · "}
                      {proposta.numeroBeneficio && (
                        <>
                          NB → <strong>{proposta.numeroBeneficio}</strong>
                        </>
                      )}
                    </span>
                  </label>
                )}

              {proposta.andamento && (
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={confirmacao.andamento}
                    onChange={() => alternarConfirmacao("andamento")}
                  />
                  <span>Andamento: “{proposta.andamento}”</span>
                </label>
              )}

              {proposta.tarefas.length > 0 && (
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={confirmacao.tarefas}
                    onChange={() => alternarConfirmacao("tarefas")}
                  />
                  <span>
                    {proposta.tarefas.length} tarefa(s) na agenda:
                    <ul className="ml-4 list-disc">
                      {proposta.tarefas.map((t, i) => (
                        <li key={i}>
                          {t.titulo} — {formatarData(t.data)} (
                          {t.prioridade.toLowerCase()})
                        </li>
                      ))}
                    </ul>
                  </span>
                </label>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {processos.length === 0 ? (
                <Button
                  size="sm"
                  disabled={enviando}
                  onClick={() => aplicar(pendente.id, true)}
                >
                  {enviando ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : null}
                  Abrir requerimento com estes dados
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    disabled={enviando}
                    onClick={() => aplicar(pendente.id)}
                  >
                    {enviando ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : null}
                    Aplicar ao caso
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={enviando}
                    onClick={() => aplicar(pendente.id, true)}
                  >
                    Abrir novo requerimento
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={enviando}
                onClick={() => setPendente(null)}
              >
                Descartar
              </Button>
            </div>

            <details className="text-xs">
              <summary className="cursor-pointer text-slate-600 dark:text-zinc-400">
                Ver campos extraídos
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-white/70 p-2 dark:bg-zinc-950">
                {JSON.stringify(pendente.dados, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* ── Histórico ── */}
        {importacoes.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Documentos importados</p>
            <ul className="space-y-1 text-sm">
              {importacoes.map((imp) => (
                <li
                  key={imp.id}
                  className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-1 last:border-0 dark:border-zinc-800"
                >
                  <span className="font-medium">
                    {DOCUMENTO_LABELS[imp.documento ?? ""] ?? imp.fonte}
                  </span>
                  <span className="text-slate-500 dark:text-zinc-500">
                    {formatarData(imp.createdAt)}
                  </span>
                  {imp.expurgadoEm ? (
                    <Badge variant="outline">eliminado</Badge>
                  ) : imp.processoId ? (
                    <Badge variant="secondary">aplicado</Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={enviando}
                      onClick={() => setPendente(imp)}
                    >
                      Revisar e aplicar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Direitos do titular ──
            Não são tarefa do dia a dia: ficam recolhidos para não
            competir com o fluxo de importar, mas a um clique quando o
            titular pedir. */}
        <details className="border-t border-slate-200 pt-3 text-xs dark:border-zinc-800">
          <summary className="cursor-pointer text-slate-600 dark:text-zinc-400">
            Direitos do titular (LGPD)
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={`/api/lgpd/titular/${clienteId}/portabilidade`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm dark:border-zinc-700"
            >
              <Download size={16} /> Exportar dados
            </a>
            <Button
              variant="ghost"
              size="sm"
              disabled={enviando}
              onClick={eliminar}
            >
              <Trash2 size={16} /> Eliminar dados do INSS
            </Button>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
