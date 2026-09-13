"use client"

import { useState, type RefObject } from "react"
import { Loader2, Save } from "lucide-react"

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
import { Select } from "@/components/ui/select"
import { opcoesEspecie } from "@/lib/domain/beneficio"
import type { Cliente } from "@/lib/data"

const VAZIO = {
  nome: "",
  cpf: "",
  email: "",
  telefone: "",
  endereco: "",
  dataNascimento: "",
  beneficio: "",
}

type Props = {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  /** Presente, o diálogo edita; ausente, cadastra. */
  cliente?: Cliente | null
  onSalvo: (cliente: Cliente) => void
  finalFocus?: RefObject<HTMLElement | null>
}

/**
 * Cadastro e edição de cliente, num formulário só.
 *
 * Usado pela lista e pela ficha: a pessoa corrige o telefone de onde
 * estiver olhando para ele. Cada campo tem rótulo fixo e uma dica de
 * formato — quem cadastra não precisa adivinhar se o CPF vai com ponto.
 *
 * O formulário mora num componente próprio, montado só enquanto o
 * diálogo está aberto: assim ele nasce com os dados do cliente da vez
 * e morre ao fechar, sem efeito para "resetar" estado.
 */
export function DialogoCliente({ aberto, onOpenChange, finalFocus, ...resto }: Props) {
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" finalFocus={finalFocus}>
        <FormularioCliente onOpenChange={onOpenChange} {...resto} />
      </DialogContent>
    </Dialog>
  )
}

function inicial(cliente?: Cliente | null) {
  if (!cliente) return VAZIO
  return {
    nome: cliente.nome,
    cpf: cliente.cpf || "",
    email: cliente.email || "",
    telefone: cliente.telefone || "",
    endereco: cliente.endereco || "",
    dataNascimento: cliente.dataNascimento?.slice(0, 10) || "",
    beneficio: cliente.beneficio || "",
  }
}

function FormularioCliente({
  onOpenChange,
  cliente,
  onSalvo,
}: Omit<Props, "aberto" | "finalFocus">) {
  const [form, setForm] = useState(() => inicial(cliente))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const editando = Boolean(cliente)
  const atualizar = (campo: keyof typeof VAZIO) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [campo]: e.target.value }))

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) {
      setErro("Informe o nome do cliente.")
      return
    }

    const payload: Record<string, string> = { nome: form.nome.trim() }
    if (form.cpf) payload.cpf = form.cpf
    if (form.email) payload.email = form.email
    if (form.telefone) payload.telefone = form.telefone
    if (form.endereco) payload.endereco = form.endereco
    if (form.dataNascimento) payload.dataNascimento = form.dataNascimento
    if (form.beneficio) payload.beneficio = form.beneficio

    setSalvando(true)
    setErro(null)
    try {
      const r = await fetch(cliente ? `/api/clientes/${cliente.id}` : "/api/clientes", {
        method: cliente ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await r.json().catch(() => ({}))

      if (!r.ok) {
        setErro(data.error || "Não foi possível salvar. Tente de novo.")
        return
      }

      onSalvo(data.cliente ?? { ...cliente, ...payload })
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
        <DialogTitle>{editando ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        <DialogDescription>
          {editando
            ? "Corrija o que mudou. Só o nome é obrigatório."
            : "Só o nome é obrigatório — o resto pode ser preenchido depois."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        <Campo rotulo="Nome completo" obrigatorio>
          <Input
            autoFocus
            placeholder="Ex.: Maria Aparecida da Silva"
            value={form.nome}
            onChange={atualizar("nome")}
            required
          />
        </Campo>

        <LinhaCampos>
          <Campo rotulo="CPF" dica="Só números ou com pontos, tanto faz">
            <Input
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={form.cpf}
              onChange={atualizar("cpf")}
            />
          </Campo>
          <Campo rotulo="Data de nascimento">
            <Input
              type="date"
              value={form.dataNascimento}
              onChange={atualizar("dataNascimento")}
            />
          </Campo>
        </LinhaCampos>

        <LinhaCampos>
          <Campo rotulo="Telefone / WhatsApp">
            <Input
              type="tel"
              inputMode="tel"
              placeholder="(00) 00000-0000"
              value={form.telefone}
              onChange={atualizar("telefone")}
            />
          </Campo>
          <Campo rotulo="E-mail">
            <Input
              type="email"
              placeholder="nome@exemplo.com"
              value={form.email}
              onChange={atualizar("email")}
            />
          </Campo>
        </LinhaCampos>

        <Campo rotulo="Endereço" dica="Rua, número, bairro e cidade — a cidade é o que coloca o cliente no mapa">
          <Input
            placeholder="Rua, número, bairro, cidade/UF"
            value={form.endereco}
            onChange={atualizar("endereco")}
          />
        </Campo>

        <Campo rotulo="Benefício pretendido" dica="Pode ficar em branco se ainda não souber">
          <Select value={form.beneficio} onChange={atualizar("beneficio")}>
            <option value="">Ainda não definido</option>
            {opcoesEspecie(form.beneficio).map((especie) => (
              <option key={especie} value={especie}>
                {especie}
              </option>
            ))}
          </Select>
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
          {editando ? "Salvar alterações" : "Cadastrar cliente"}
        </Button>
      </DialogFooter>
    </form>
  )
}
