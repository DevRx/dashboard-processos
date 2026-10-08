"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Building2, KeyRound, Loader2, Check } from "lucide-react"

/**
 * Provisionamento de escritórios (admin). Cria escritório, define plano
 * e modelo, cola a chave da Anthropic (vai cifrada pro banco, nunca
 * volta) e liga cada usuário a um escritório.
 */

type Escritorio = {
  id: string
  nome: string
  plano: string
  modeloIa: string | null
  ativo: boolean
  temChave: boolean
}

type Usuario = {
  id: string
  name: string
  email: string
  role: string
  escritorioId: string | null
}

type Mensagem = { tipo: "ok" | "erro"; texto: string } | null

const PLANOS = ["ESSENCIAL", "PROFISSIONAL", "ESCRITORIO", "INTERNO"]

export function Escritorios() {
  const [escritorios, setEscritorios] = useState<Escritorio[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [msg, setMsg] = useState<Mensagem>(null)
  const [salvando, setSalvando] = useState(false)

  // Formulário de novo escritório
  const [nome, setNome] = useState("")
  const [plano, setPlano] = useState("ESSENCIAL")
  const [modelo, setModelo] = useState("")
  const [chave, setChave] = useState("")

  const carregar = useCallback(() => {
    return Promise.all([
      fetch("/api/escritorios").then((r) => (r.ok ? r.json() : { escritorios: [] })),
      fetch("/api/users").then((r) => (r.ok ? r.json() : { users: [] })),
    ])
      .then(([e, u]) => {
        setEscritorios(e.escritorios ?? [])
        setUsuarios(u.users ?? [])
      })
      .catch(() => setMsg({ tipo: "erro", texto: "Erro ao carregar." }))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function criar() {
    if (!nome.trim() || salvando) return
    setSalvando(true)
    setMsg(null)
    try {
      const res = await fetch("/api/escritorios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          plano,
          modeloIa: modelo.trim() || undefined,
          anthropicKey: chave.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ tipo: "erro", texto: data.error ?? "Erro ao criar." })
        return
      }
      setNome("")
      setModelo("")
      setChave("")
      setPlano("ESSENCIAL")
      setMsg({ tipo: "ok", texto: "Escritório criado." })
      carregar()
    } finally {
      setSalvando(false)
    }
  }

  async function atualizar(id: string, patch: Record<string, unknown>) {
    setSalvando(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/escritorios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      setMsg(
        res.ok
          ? { tipo: "ok", texto: "Escritório atualizado." }
          : { tipo: "erro", texto: data.error ?? "Erro." }
      )
      carregar()
    } finally {
      setSalvando(false)
    }
  }

  async function moverUsuario(userId: string, escritorioId: string) {
    setSalvando(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escritorioId: escritorioId || null }),
      })
      const data = await res.json()
      setMsg(
        res.ok
          ? { tipo: "ok", texto: "Usuário movido." }
          : { tipo: "erro", texto: data.error ?? "Erro." }
      )
      carregar()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-5">
      {msg && (
        <p
          className={
            msg.tipo === "erro"
              ? "text-sm text-red-600 dark:text-red-400"
              : "text-sm text-emerald-700 dark:text-emerald-400"
          }
        >
          {msg.texto}
        </p>
      )}

      {/* Novo escritório */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[14px]">
            <Building2 size={16} /> Novo escritório
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              Nome
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Escritório Fulano Advocacia" />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Plano
              <select
                value={plano}
                onChange={(e) => setPlano(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
              >
                {PLANOS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Modelo de IA (opcional)
              <Input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="deixe em branco p/ o padrão" />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Chave da Anthropic (opcional)
              <Input
                type="password"
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                placeholder="sk-ant-… (guardada cifrada)"
              />
            </label>
          </div>
          <Button size="sm" onClick={criar} disabled={salvando || !nome.trim()}>
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Criar
          </Button>
        </CardContent>
      </Card>

      {/* Lista de escritórios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[14px]">Escritórios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {carregando ? (
            <p className="py-4 text-sm text-muted-foreground">Carregando…</p>
          ) : escritorios.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Nenhum escritório ainda.</p>
          ) : (
            escritorios.map((e) => (
              <LinhaEscritorio
                key={e.id}
                escritorio={e}
                salvando={salvando}
                onSalvar={(patch) => atualizar(e.id, patch)}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Usuários → escritório */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[14px]">Usuários por escritório</CardTitle>
        </CardHeader>
        <CardContent>
          {usuarios.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Nenhum usuário.</p>
          ) : (
            <ul className="space-y-1.5">
              {usuarios.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 last:border-0"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{u.name}</span>{" "}
                    <span className="text-[12px] text-muted-foreground">{u.email}</span>
                  </span>
                  <select
                    value={u.escritorioId ?? ""}
                    disabled={salvando}
                    onChange={(ev) => moverUsuario(u.id, ev.target.value)}
                    className="h-8 rounded-lg border border-input bg-card px-2 text-sm shadow-xs outline-none focus-visible:border-ring"
                  >
                    <option value="">— sem escritório —</option>
                    {escritorios.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LinhaEscritorio({
  escritorio,
  salvando,
  onSalvar,
}: {
  escritorio: Escritorio
  salvando: boolean
  onSalvar: (patch: Record<string, unknown>) => void
}) {
  const [plano, setPlano] = useState(escritorio.plano)
  const [modelo, setModelo] = useState(escritorio.modeloIa ?? "")
  const [chave, setChave] = useState("")

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{escritorio.nome}</span>
        <div className="flex items-center gap-1.5">
          {escritorio.temChave ? (
            <Badge variant="success">
              <KeyRound /> IA configurada
            </Badge>
          ) : (
            <Badge variant="muted">sem IA</Badge>
          )}
          {!escritorio.ativo && <Badge variant="warning">inativo</Badge>}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <select
          value={plano}
          onChange={(e) => setPlano(e.target.value)}
          className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
        >
          {PLANOS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <Input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="modelo de IA" />
        <Input
          type="password"
          value={chave}
          onChange={(e) => setChave(e.target.value)}
          placeholder={escritorio.temChave ? "trocar a chave" : "colar a chave"}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={salvando}
          onClick={() =>
            onSalvar({
              plano,
              modeloIa: modelo,
              ...(chave.trim() ? { anthropicKey: chave.trim() } : {}),
            })
          }
        >
          Salvar
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={salvando}
          onClick={() => onSalvar({ ativo: !escritorio.ativo })}
        >
          {escritorio.ativo ? "Desativar" : "Ativar"}
        </Button>
        {escritorio.temChave && (
          <Button
            variant="ghost"
            size="sm"
            disabled={salvando}
            onClick={() => onSalvar({ anthropicKey: "" })}
          >
            Remover chave
          </Button>
        )}
      </div>
    </div>
  )
}
