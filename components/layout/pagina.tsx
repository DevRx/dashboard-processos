import { Header } from "@/components/layout/header"
import { cn } from "@/lib/utils"

/**
 * Uma tela pós-login: cabeçalho fixo e a área de trabalho.
 *
 * As ações principais ("Novo cliente", "Buscar no DJEN") moram no
 * cabeçalho em telas largas — é o lugar mais visível e sempre o mesmo,
 * então quem usa o sistema aprende uma vez onde procurar. No celular o
 * cabeçalho não tem largura para elas, e as mesmas ações descem para
 * uma faixa logo abaixo.
 */
export function Pagina({
  titulo,
  subtitulo,
  acoes,
  voltar,
  children,
  className,
}: {
  titulo: string
  subtitulo?: string
  acoes?: React.ReactNode
  /** Endereço da tela de origem, quando esta é uma subpágina. */
  voltar?: { href: string; rotulo: string }
  children: React.ReactNode
  className?: string
}) {
  return (
    <>
      <Header title={titulo} subtitle={subtitulo} acoes={acoes} voltar={voltar} />

      {acoes && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border bg-card/60 px-4 py-2.5 sm:hidden">
          {acoes}
        </div>
      )}

      <main className={cn("flex-1 space-y-5 p-4 md:p-6", className)}>
        {children}
      </main>
    </>
  )
}
