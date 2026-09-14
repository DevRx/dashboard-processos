import Link from "next/link"
import { ArrowLeft, Compass } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md rounded-3xl bg-card p-9 text-center shadow-float">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Compass size={26} strokeWidth={1.9} />
        </span>
        <p className="font-heading mt-6 text-[13px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
          Erro 404
        </p>
        <h2 className="font-heading mt-1 text-[24px] leading-tight font-extrabold tracking-[-0.02em]">
          Rota não encontrada
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          O recurso não está disponível no momento ou o endereço foi digitado
          errado.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-glow transition-colors hover:bg-primary-hover"
        >
          <ArrowLeft size={16} />
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
