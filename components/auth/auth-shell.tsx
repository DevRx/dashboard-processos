"use client"

import Link from "next/link"
import { Scale, ShieldCheck, Sparkles, Timer } from "lucide-react"

/**
 * Moldura das páginas de entrada e cadastro.
 *
 * Duas metades: à esquerda a marca ocupa a tela com um painel escuro
 * em degradê, à direita o formulário respira num cartão branco. Em
 * telas estreitas o painel some e sobra o cartão — o que importa é
 * entrar, não admirar.
 */
const DESTAQUES = [
  {
    icone: Timer,
    titulo: "Fila viva",
    texto: "Requerimentos e ações organizados por família e por fase.",
  },
  {
    icone: Sparkles,
    titulo: "Leitura assistida",
    texto: "Intimações e documentos analisados antes de virarem tarefa.",
  },
  {
    icone: ShieldCheck,
    titulo: "Dados protegidos",
    texto: "LGPD, consentimento e retenção controlados no próprio sistema.",
  },
]

export function AuthShell({
  titulo,
  descricao,
  children,
  rodape,
}: {
  titulo: string
  descricao: string
  children: React.ReactNode
  rodape?: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Painel da marca */}
      <aside className="relative hidden w-[46%] max-w-[640px] shrink-0 overflow-hidden bg-[#0c1425] text-white lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(800px_500px_at_-10%_-10%,rgba(124,159,240,0.35),transparent_60%),radial-gradient(700px_500px_at_110%_110%,rgba(219,39,119,0.35),transparent_60%)]"
        />
        <div aria-hidden className="bg-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />

        {/* Formas flutuantes */}
        <div
          aria-hidden
          className="animate-float absolute top-[18%] right-[-60px] size-64 rounded-full bg-gradient-to-br from-pink-500/40 to-violet-600/30 blur-3xl"
        />
        <div
          aria-hidden
          className="animate-float absolute bottom-[10%] left-[-80px] size-72 rounded-full bg-gradient-to-tr from-blue-500/30 to-cyan-400/20 blur-3xl [animation-delay:-3s]"
        />

        <div className="relative flex flex-1 flex-col justify-between p-10 xl:p-14">
          <Link href="/login" className="flex w-fit items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-brand shadow-[0_10px_30px_-10px_rgba(219,39,119,0.9)] ring-1 ring-white/25 ring-inset">
              <Scale size={22} strokeWidth={2.1} />
            </span>
            <span>
              <span className="font-heading block text-[17px] leading-tight font-bold">
                Zeca Aposenta
              </span>
              <span className="block text-[10px] leading-tight font-semibold tracking-[0.2em] text-white/50 uppercase">
                O Terror do INSS
              </span>
            </span>
          </Link>

          <div className="max-w-md">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11.5px] font-semibold tracking-wide text-white/80 uppercase backdrop-blur">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.7)]" />
              Gestão previdenciária
            </p>
            <h2 className="font-heading text-[40px] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance xl:text-[46px]">
              O escritório inteiro,{" "}
              <span className="bg-gradient-to-r from-pink-300 via-fuchsia-300 to-indigo-300 bg-clip-text text-transparent">
                numa tela só.
              </span>
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/65">
              Clientes, requerimentos no INSS, ações judiciais, intimações e
              tarefas do time — com a mesma cor do começo ao fim.
            </p>

            <ul className="mt-9 flex flex-col gap-4">
              {DESTAQUES.map((d) => {
                const Icone = d.icone
                return (
                  <li key={d.titulo} className="flex items-start gap-3.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/6 text-white/90 backdrop-blur">
                      <Icone size={17} strokeWidth={1.9} />
                    </span>
                    <span>
                      <span className="block text-[13.5px] font-semibold">
                        {d.titulo}
                      </span>
                      <span className="block text-[13px] leading-snug text-white/55">
                        {d.texto}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          <p className="text-[11.5px] text-white/35">
            © {new Date().getFullYear()} Zeca Aposenta · Acesso restrito à equipe
          </p>
        </div>
      </aside>

      {/* Formulário */}
      <main className="relative flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          {/* Marca compacta, só quando o painel está escondido. */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow">
              <Scale size={19} strokeWidth={2.1} />
            </span>
            <span>
              <span className="font-heading block text-[15px] leading-tight font-bold">
                Zeca Aposenta
              </span>
              <span className="block text-[9.5px] leading-tight font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                O Terror do INSS
              </span>
            </span>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-2 rounded-3xl bg-card p-7 shadow-float duration-300 sm:p-9">
            <h1 className="font-heading text-[26px] leading-tight font-extrabold tracking-[-0.025em]">
              {titulo}
            </h1>
            <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">
              {descricao}
            </p>

            <div className="mt-7">{children}</div>
          </div>

          {rodape ? (
            <p className="mt-6 text-center text-[13.5px] text-muted-foreground">
              {rodape}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  )
}

/** Campo com rótulo e ícone à esquerda, no padrão das páginas de acesso. */
export function CampoAuth({
  id,
  rotulo,
  icone,
  acaoDireita,
  children,
}: {
  id: string
  rotulo: string
  icone: React.ReactNode
  /** Botão opcional no canto direito (ex.: mostrar senha). */
  acaoDireita?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[12.5px] font-semibold text-foreground/80"
      >
        {rotulo}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground">
          {icone}
        </span>
        {children}
        {acaoDireita ? (
          <span className="absolute top-1/2 right-2 -translate-y-1/2">
            {acaoDireita}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function ErroAuth({ mensagem }: { mensagem: string }) {
  return (
    <div
      role="alert"
      className="animate-in fade-in slide-in-from-top-1 flex items-start gap-2.5 rounded-xl bg-status-danger px-3.5 py-3 text-[13px] leading-snug text-status-danger-foreground duration-150"
    >
      <span className="mt-[3px] size-2 shrink-0 rounded-full bg-current" />
      <span>{mensagem}</span>
    </div>
  )
}
