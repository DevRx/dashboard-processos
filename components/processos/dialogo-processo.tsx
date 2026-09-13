"use client"

import { useState, type RefObject } from "react"
import { Gavel, Landmark, Loader2, Save, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Campo, LinhaCampos } from "@/components/ui/campo"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Segmentado } from "@/components/ui/segmentado"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { opcoesEspecie } from "@/lib/domain/beneficio"
import { formatarData } from "@/lib/formatar"
import {
  PROCESSO_STATUS_LABELS,
  PROCESSO_STATUS_VALUES,
  type Cliente,
  type EsferaProcesso,
  type User,
} from "@/lib/data"

const VAZIO = {
  clienteId: "",
  esfera: "ADMINISTRATIVO" as EsferaProcesso,
  beneficio: "",
  numero: "",
  protocoloInss: "",
  status: "EM_ANALISE",
  responsavelId: "",
  dataEntrada: "",
  prazo: "",
  tribunal: "",
  vara: "",
  observacoes: "",
}

const ROTULO_PAPEL: Record<string, string> = {
  ADMIN: "administrador",
  ADVOGADO: "advogado",
  ASSISTENTE: "assistente",
  USER: "usuário",
}

type Props = {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  /** Fixo quando o diálogo abre de dentro da ficha do cliente. */
  clienteId?: string
  clientes?: Cliente[]
  usuarios: User[]
  onSalvo: () => void
  finalFocus?: RefObject<HTMLElement | null>
}

/**
 * Abertura de um caso — requerimento no INSS ou ação judicial.
 *
 * Um formulário só para as duas telas que abrem caso (a lista de
 * processos e a ficha do cliente). A esfera vem primeiro e é uma
 * escolha à vista, porque decide o resto: requerimento tem protocolo;
 * número CNJ, tribunal e vara só existem na via judicial.
 *
 * O formulário é montado só enquanto o diálogo está aberto, e por isso
 * nasce limpo a cada abertura sem efeito de "reset".
 */
export function DialogoProcesso({ aberto, onOpenChange, finalFocus, ...resto }: Props) {
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl" finalFocus={finalFocus}>
        <FormularioProcesso onOpenChange={onOpenChange} {...resto} />
      </DialogContent>
    </Dialog>
  )
}

function FormularioProcesso({
  onOpenChange,
  clienteId,
  clientes = [],
  usuarios,
  onSalvo,
}: Omit<Props, "aberto" | "finalFocus">) {
  const [form, setForm] = useState({ ...VAZIO, clienteId: clienteId ?? "" })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [dataJudMsg, setDataJudMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null)

  const atualizar = (campo: keyof typeof VAZIO) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [campo]: e.target.value }))

  const judicial = form.esfera === "JUDICIAL"

  async function buscarNoDataJud() {
    if (!form.numero.trim()) return
    setBuscando(true)
    setDataJudMsg(null)
    try {
      const res = await fetch(`/api/processos/lookup?numero=${encodeURIComponent(form.numero)}`)
      const data = await res.json()

      if (!res.ok) {
        setDataJudMsg({ tipo: "erro", texto: data.error || "Processo não encontrado no DataJud." })
        return
      }

      const d = data.dados
      const infoExtra = [
        d.classe ? `Classe: ${d.classe}` : null,
        d.ultimoMovimento
          ? `Último movimento: ${d.ultimoMovimento.nome}${d.ultimoMovimento.data ? ` (${formatarData(d.ultimoMovimento.data)})` : ""}`
          : null,
      ]
        .filter(Boolean)
        .join(" — ")

      setForm((prev) => ({
        ...prev,
        beneficio: d.assuntos?.[0] || prev.beneficio,
        dataEntrada: d.dataAjuizamento ? d.dataAjuizamento.slice(0, 10) : prev.dataEntrada,
        tribunal: d.tribunal || prev.tribunal,
        vara: d.orgaoJulgador || prev.vara,
        observacoes: infoExtra
          ? [prev.observacoes, infoExtra].filter(Boolean).join(" | ")
          : prev.observacoes,
      }))
      setDataJudMsg({
        tipo: "ok",
        texto: "Dados encontrados e preenchidos. Confira o benefício antes de salvar.",
      })
    } catch {
      setDataJudMsg({ tipo: "erro", texto: "Sem conexão com o DataJud. Tente de novo." })
    } finally {
      setBuscando(false)
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.clienteId) {
      setErro("Escolha o cliente deste caso.")
      return
    }
    if (!form.beneficio.trim()) {
      setErro("Escolha o tipo de benefício.")
      return
    }

    setSalvando(true)
    setErro(null)
    try {
      const r = await fetch("/api/processos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(data.error || "Não foi possível salvar. Tente de novo.")
        return
      }
      onSalvo()
      onOpenChange(false)
    } catch {
      setErro("Sem conexão. Verifique a internet e tente de novo.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Novo caso</DialogTitle>
        <DialogDescription>
          Primeiro diga onde o caso está — no INSS ou na Justiça. O formulário se ajusta.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        <Campo rotulo="Onde está o caso?" grupo>
          <Segmentado
            cheio
            tamanho="lg"
            valor={form.esfera}
            onChange={(esfera) => setForm((f) => ({ ...f, esfera }))}
            aria-label="Esfera do caso"
            opcoes={[
              { valor: "ADMINISTRATIVO", rotulo: "No INSS (requerimento)", icone: Landmark },
              { valor: "JUDICIAL", rotulo: "Na Justiça (ação)", icone: Gavel },
            ]}
          />
        </Campo>

        {!clienteId && (
          <Campo rotulo="Cliente" obrigatorio>
            <Select value={form.clienteId} onChange={atualizar("clienteId")} required>
              <option value="">Escolha o cliente…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Campo>
        )}

        {judicial ? (
          <Campo
            rotulo="Número do processo (CNJ)"
            dica="Com o número, a lupa busca os dados no DataJud e preenche o resto"
          >
            <div className="flex gap-2">
              <Input
                placeholder="0000000-00.0000.0.00.0000"
                value={form.numero}
                onChange={atualizar("numero")}
                className="font-mono"
              />
              <Button
                variant="soft"
                onClick={buscarNoDataJud}
                disabled={buscando || !form.numero.trim()}
                title="Buscar no DataJud"
              >
                {buscando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                <span className="hidden sm:inline">Buscar</span>
              </Button>
            </div>
          </Campo>
        ) : (
          <Campo
            rotulo="Protocolo no INSS"
            dica="Só se o requerimento já foi apresentado. Se ainda vai protocolar, deixe em branco."
          >
            <Input
              placeholder="Número do protocolo"
              value={form.protocoloInss}
              onChange={atualizar("protocoloInss")}
              className="font-mono"
            />
          </Campo>
        )}

        {dataJudMsg && (
          <p
            role="status"
            className={
              dataJudMsg.tipo === "erro"
                ? "rounded-lg bg-status-danger px-3 py-2 text-[13px] text-status-danger-foreground"
                : "rounded-lg bg-status-success px-3 py-2 text-[13px] text-status-success-foreground"
            }
          >
            {dataJudMsg.texto}
          </p>
        )}

        <LinhaCampos>
          <Campo rotulo="Tipo de benefício" obrigatorio>
            <Select value={form.beneficio} onChange={atualizar("beneficio")} required>
              <option value="">Escolha…</option>
              {opcoesEspecie(form.beneficio).map((especie) => (
                <option key={especie} value={especie}>
                  {especie}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo rotulo="Situação atual">
            <Select value={form.status} onChange={atualizar("status")}>
              {PROCESSO_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {PROCESSO_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Campo>
        </LinhaCampos>

        <LinhaCampos colunas={3}>
          <Campo rotulo="Responsável">
            <Select value={form.responsavelId} onChange={atualizar("responsavelId")}>
              <option value="">Ninguém ainda</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({ROTULO_PAPEL[u.role] ?? u.role})
                </option>
              ))}
            </Select>
          </Campo>
          <Campo rotulo="Data de entrada">
            <Input type="date" value={form.dataEntrada} onChange={atualizar("dataEntrada")} />
          </Campo>
          <Campo rotulo="Prazo">
            <Input type="date" value={form.prazo} onChange={atualizar("prazo")} />
          </Campo>
        </LinhaCampos>

        {judicial && (
          <LinhaCampos>
            <Campo rotulo="Tribunal">
              <Input placeholder="Ex.: TRF3" value={form.tribunal} onChange={atualizar("tribunal")} />
            </Campo>
            <Campo rotulo="Vara / órgão julgador">
              <Input placeholder="Ex.: 2ª Vara Federal" value={form.vara} onChange={atualizar("vara")} />
            </Campo>
          </LinhaCampos>
        )}

        <Campo rotulo="Observações">
          <Textarea
            placeholder="Qualquer detalhe que ajude quem for trabalhar o caso"
            value={form.observacoes}
            onChange={atualizar("observacoes")}
          />
        </Campo>
      </div>

      {erro && (
        <p role="alert" className="rounded-lg bg-status-danger px-3 py-2 text-[13px] text-status-danger-foreground">
          {erro}
        </p>
      )}

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
        <Button type="submit" disabled={salvando}>
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Abrir caso
        </Button>
      </DialogFooter>
    </form>
  )
}
