import { iniciais } from "@/lib/formatar"
import { cn } from "@/lib/utils"

/**
 * Oito tintas suaves; a pessoa cai sempre na mesma, escolhida pelo
 * nome. Assim "Maria" é sempre a mesma cor em qualquer tela — e a
 * lista de clientes vira reconhecível de relance, sem foto.
 */
const TINTAS = [
  "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200",
]

function tintaDe(nome: string) {
  let soma = 0
  for (const ch of nome) soma = (soma + ch.charCodeAt(0)) % 9973
  return TINTAS[soma % TINTAS.length]
}

const TAMANHOS = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-[11.5px]",
  md: "size-10 text-[13px]",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
}

export function Avatar({
  nome,
  tamanho = "md",
  className,
}: {
  nome?: string | null
  tamanho?: keyof typeof TAMANHOS
  className?: string
}) {
  const texto = nome?.trim() || ""

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide select-none",
        TAMANHOS[tamanho],
        texto ? tintaDe(texto) : "bg-muted text-muted-foreground",
        className
      )}
    >
      {iniciais(texto)}
    </span>
  )
}
