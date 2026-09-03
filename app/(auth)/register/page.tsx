"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AuthShell, CampoAuth, ErroAuth } from "@/components/auth/auth-shell"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Erro ao cadastrar")
      } else {
        router.push("/login")
      }
    } catch {
      setError("Erro de conexão")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      titulo="Criar acesso"
      descricao="Cadastre-se para entrar no painel do escritório."
      rodape={
        <>
          Já tem uma conta?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {error && <ErroAuth mensagem={error} />}

        <CampoAuth
          id="name"
          rotulo="Nome completo"
          icone={<UserRound size={16} strokeWidth={1.9} />}
        >
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Como aparece na equipe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-11 rounded-xl pl-10"
          />
        </CampoAuth>

        <CampoAuth id="email" rotulo="E-mail" icone={<Mail size={16} strokeWidth={1.9} />}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="voce@escritorio.adv.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 rounded-xl pl-10"
          />
        </CampoAuth>

        <CampoAuth
          id="password"
          rotulo="Senha"
          icone={<LockKeyhole size={16} strokeWidth={1.9} />}
          acaoDireita={
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        >
          <Input
            id="password"
            type={mostrarSenha ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Mínimo de 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="h-11 rounded-xl pr-11 pl-10"
          />
        </CampoAuth>

        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="mt-1 w-full"
        >
          {loading ? (
            <>
              <Loader2 size={17} className="animate-spin" />
              Cadastrando…
            </>
          ) : (
            <>
              Criar conta
              <ArrowRight size={17} />
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  )
}
