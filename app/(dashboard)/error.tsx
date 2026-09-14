"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, House, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Quando uma tela quebra, quem está usando vê isto — e não a página
 * genérica do Next em inglês. Diz o que aconteceu em português, oferece
 * tentar de novo e voltar ao início. O erro em si vai para o console,
 * onde quem cuida do sistema consegue ler.
 */
export default function ErroDaTela({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl bg-card px-8 py-10 text-center shadow-card">
        <span className="flex size-14 items-center justify-center rounded-full bg-status-danger text-status-danger-foreground">
          <AlertTriangle size={26} strokeWidth={2} />
        </span>
        <h1 className="font-heading mt-1 text-[18px] font-semibold">
          Esta tela não conseguiu abrir
        </h1>
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          Aconteceu um erro inesperado. Tente de novo — se continuar, avise
          quem cuida do sistema e diga qual tela você estava abrindo.
        </p>
        {error.digest && (
          <p className="font-mono text-[11px] text-muted-foreground/70">
            código {error.digest}
          </p>
        )}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw size={15} />
            Tentar de novo
          </Button>
          <Link href="/">
            <Button variant="outline">
              <House size={15} />
              Ir para o início
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
