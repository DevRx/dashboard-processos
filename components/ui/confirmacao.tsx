"use client"

import { useCallback, useRef, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type OpcoesConfirmacao = {
  titulo: string
  descricao?: string
  rotuloConfirmar?: string
  rotuloCancelar?: string
  /** `perigo` pinta o botão de vermelho: é o caso de toda exclusão. */
  tom?: "perigo" | "padrao"
}

/**
 * Substituto do `window.confirm`.
 *
 * O `confirm` nativo aparece com a cara do navegador, sem contexto e
 * com "OK / Cancelar" — e OK confirma uma exclusão. Aqui a caixa diz o
 * que vai acontecer, nomeia o que será apagado, e o botão que apaga
 * é vermelho e diz "Excluir".
 *
 * Uso:
 *   const { confirmar, dialogo } = useConfirmacao()
 *   if (!(await confirmar({ titulo: "Excluir Maria?" }))) return
 *   ... e renderize {dialogo} em algum lugar da tela.
 */
export function useConfirmacao() {
  const [opcoes, setOpcoes] = useState<OpcoesConfirmacao | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirmar = useCallback((o: OpcoesConfirmacao) => {
    setOpcoes(o)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const responder = useCallback((ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setOpcoes(null)
  }, [])

  const dialogo = (
    <Confirmacao
      aberta={opcoes !== null}
      opcoes={opcoes}
      onResponder={responder}
    />
  )

  return { confirmar, dialogo }
}

export function Confirmacao({
  aberta,
  opcoes,
  carregando,
  onResponder,
}: {
  aberta: boolean
  opcoes: OpcoesConfirmacao | null
  carregando?: boolean
  onResponder: (ok: boolean) => void
}) {
  const perigo = (opcoes?.tom ?? "perigo") === "perigo"

  return (
    <Dialog open={aberta} onOpenChange={(open) => !open && onResponder(false)}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader className="flex-row items-start gap-3">
          <span
            className={
              perigo
                ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-status-danger text-status-danger-foreground"
                : "flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
            }
          >
            <AlertTriangle size={20} strokeWidth={2} />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5 pt-1">
            <DialogTitle className="text-[15px] leading-snug">
              {opcoes?.titulo}
            </DialogTitle>
            {opcoes?.descricao && (
              <DialogDescription className="leading-relaxed">
                {opcoes.descricao}
              </DialogDescription>
            )}
          </div>
        </DialogHeader>

        <DialogFooter className="pt-1">
          <Button variant="outline" onClick={() => onResponder(false)} disabled={carregando}>
            {opcoes?.rotuloCancelar ?? "Cancelar"}
          </Button>
          <Button
            variant={perigo ? "destructive" : "default"}
            onClick={() => onResponder(true)}
            disabled={carregando}
          >
            {carregando && <Loader2 size={16} className="animate-spin" />}
            {opcoes?.rotuloConfirmar ?? (perigo ? "Excluir" : "Confirmar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
