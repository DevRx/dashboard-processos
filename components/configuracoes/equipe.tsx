"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { UserPlus, Users } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/dashboard/empty-state"
import { ROTULO_POR_PAPEL, useUsuario } from "@/components/layout/usuario-context"
import type { User } from "@/lib/data"

/** Quem trabalha no escritório, com o papel de cada um. */
export function Equipe() {
  const eu = useUsuario()
  const [usuarios, setUsuarios] = useState<User[] | null>(null)

  useEffect(() => {
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setUsuarios(d.users ?? []))
      .catch(() => setUsuarios([]))
  }, [])

  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-heading text-[15px] font-semibold">Equipe</h2>
          <p className="text-[12px] text-muted-foreground">
            Quem tem acesso ao sistema e o que cada pessoa pode fazer
          </p>
        </div>
        {eu?.role === "ADMIN" && (
          <Link href="/register">
            <Button variant="soft" size="sm">
              <UserPlus size={14} />
              Cadastrar pessoa
            </Button>
          </Link>
        )}
      </div>

      {usuarios === null ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : usuarios.length === 0 ? (
        <EmptyState icon={Users} title="Ninguém cadastrado ainda" />
      ) : (
        <ul className="divide-y divide-border">
          {usuarios.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar nome={u.name} tamanho="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">
                  {u.name}
                  {u.id === eu?.id && (
                    <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">(você)</span>
                  )}
                </span>
                <span className="block truncate text-[12px] text-muted-foreground">{u.email}</span>
              </span>
              <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                {ROTULO_POR_PAPEL[u.role] ?? u.role}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
