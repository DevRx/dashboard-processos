"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useLayoutEffect } from "react"
import { Scale, ShieldCheck, Sparkles, Timer } from "lucide-react"

/**
 * Moldura das páginas de entrada e cadastro.
 *
 * Duas metades: à esquerda a marca ocupa a tela com um painel escuro
 * em degradê e o lema animado, à direita o formulário respira num
 * cartão branco. Em telas estreitas o painel some e sobra o cartão —
 * o que importa é entrar, não admirar.
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

/** Variáveis CSS inline, tipadas: `vars({ "--lema-delay": "120ms" })`. */
function vars(v: Record<`--${string}`, string>) {
  return v as React.CSSProperties
}

function atraso(ms: number) {
  return vars({ "--lema-delay": `${ms}ms` })
}

/**
 * Coreografia do lema, em ms. Fica num lugar só para o ritmo poder
 * ser ajustado sem caçar números pelo JSX.
 */
const RITMO = {
  selo: 0,
  crescer: 120,
  para: 280,
  servir: 440,
  tinta: 900, // termina em 1600
  barra: 1100, // termina em 1800
  ponto: 1600, // nasce no instante em que a tinta termina
  paragrafo: 1500,
  destaques: 1800,
  entreDestaques: 150,
  anelMarca: 2200,
} as const

/**
 * Guarda de sessão: a cascata roda uma vez por aba. Quem recarregar
 * /login, ou voltar a ela pelo botão Sair, já a viu.
 *
 * A decisão precisa ser tomada ANTES do primeiro paint, senão a
 * cascata começa e a tela dá um salto. São dois caminhos:
 *
 * - Carga completa (visita direta, F5): um script inline, síncrono,
 *   põe a classe no <html> enquanto o HTML ainda é analisado. O <html>
 *   já tem suppressHydrationWarning por causa do tema.
 * - Navegação client-side (Sair → router.push("/login")): o React não
 *   executa scripts que ele mesmo insere, então um useLayoutEffect
 *   faz o mesmo antes do paint desse commit.
 *
 * Ver node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md.
 */
const CHAVE_LEMA_VISTO = "lema-visto"
const CLASSE_LEMA_PRONTO = "lema-pronto"
const SCRIPT_LEMA_PRONTO = `try{if(sessionStorage.getItem("${CHAVE_LEMA_VISTO}"))document.documentElement.classList.add("${CLASSE_LEMA_PRONTO}")}catch(e){}`

/**
 * Script inline no padrão do guia do Next: `text/javascript` só no
 * servidor, para o navegador executá-lo no parse; no cliente vira
 * `text/plain`, o que evita o aviso do React em desenvolvimento.
 */
function ScriptInline({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/**
 * "Crescer para Servir" como peça cinética: as três palavras sobem
 * uma a uma de dentro da própria linha, "Servir" recebe a tinta em
 * degradê e uma barra curta se estende por baixo com um ponto rosa
 * na ponta. Só CSS (classes .lema-* em globals.css) — sem estado,
 * sem Date, sem random. Em movimento reduzido, o estado final é o
 * estado natural dos elementos.
 */
function LemaAnimado() {
  return (
    <div className="lema">
      {/* Um <p>, não um heading: o h1 da página é o do cartão. O texto
          para leitores de tela vem inteiro e em ordem; o bloco visual,
          fatiado para animar, fica fora da árvore de acessibilidade. */}
      <p className="lema-titulo font-heading text-[40px] leading-[1.05] font-extrabold tracking-[-0.03em] text-white xl:text-[46px]">
        <span className="sr-only">Crescer para Servir</span>
        <span aria-hidden>
          <span className="lema-linha">
            <span className="lema-palavra" style={atraso(RITMO.crescer)}>
              Crescer
            </span>
          </span>{" "}
          {/* A linha do "para" tem tipografia própria: sem isso ela herda
              o corpo de 46px do <p> e abre um buraco entre as palavras. */}
          <span className="lema-linha lema-linha-para my-2 font-sans text-[14px] leading-none font-semibold tracking-[0.32em] text-white/60 uppercase">
            <span className="lema-palavra" style={atraso(RITMO.para)}>
              para
            </span>
          </span>{" "}
          <span className="lema-linha">
            <span
              className="lema-palavra lema-servir"
              data-texto="Servir"
              style={vars({
                "--lema-delay": `${RITMO.servir}ms`,
                "--lema-delay-tinta": `${RITMO.tinta}ms`,
              })}
            >
              Servir
            </span>
          </span>
        </span>
      </p>

      <span aria-hidden className="lema-barra" style={atraso(RITMO.barra)}>
        <span className="lema-ponto" style={atraso(RITMO.ponto)} />
      </span>
    </div>
  )
}

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
  const pathname = usePathname()

  // Montagem client-side: decide antes do paint (ver CHAVE_LEMA_VISTO).
  // Na carga completa é redundante — o script inline já pôs a classe.
  // Ao desmontar, a classe sai: ela só diz respeito a este painel.
  useLayoutEffect(() => {
    const raiz = document.documentElement
    try {
      if (sessionStorage.getItem(CHAVE_LEMA_VISTO)) raiz.classList.add(CLASSE_LEMA_PRONTO)
    } catch {
      // Sem sessionStorage (modo privado restrito): a cascata roda sempre.
    }
    return () => raiz.classList.remove(CLASSE_LEMA_PRONTO)
  }, [])

  // Marca a aba como "já viu a cascata".
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE_LEMA_VISTO, "1")
    } catch {
      // Idem.
    }
  }, [])

  // Na própria tela de login a marca não é link: um link para a página
  // em que se está é um beco para quem navega por Tab.
  const naTelaDeLogin = pathname === "/login"
  // Sem `outline-none`: no Tailwind v4 ele zera a variável de estilo do
  // contorno e o anel de foco abaixo deixaria de existir.
  const classeMarca =
    "flex w-fit items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-white/70"
  const conteudoMarca = (
    <>
      <span
        className="lema-marca relative flex size-11 items-center justify-center rounded-2xl bg-gradient-brand shadow-[0_10px_30px_-10px_rgba(219,39,119,0.9)] ring-1 ring-white/25 ring-inset"
        style={atraso(RITMO.anelMarca)}
      >
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
    </>
  )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Painel da marca */}
      <aside className="lema-painel relative hidden w-[46%] max-w-[640px] shrink-0 overflow-hidden bg-[#0c1425] text-white lg:flex lg:flex-col">
        {/* Antes de qualquer elemento animado, para valer no primeiro paint. */}
        <ScriptInline html={SCRIPT_LEMA_PRONTO} />

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
          {naTelaDeLogin ? (
            <div className={classeMarca}>{conteudoMarca}</div>
          ) : (
            <Link href="/login" className={classeMarca}>
              {conteudoMarca}
            </Link>
          )}

          <div className="max-w-md">
            <p
              className="lema-entra mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11.5px] font-semibold tracking-wide text-white/80 uppercase backdrop-blur"
              style={atraso(RITMO.selo)}
            >
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.7)]" />
              Gestão previdenciária
            </p>

            <LemaAnimado />

            <p
              className="lema-entra mt-6 text-[15px] leading-relaxed text-white/65"
              style={atraso(RITMO.paragrafo)}
            >
              O escritório inteiro, numa tela só: clientes, requerimentos no
              INSS, ações judiciais, intimações e tarefas do time — com a
              mesma cor do começo ao fim.
            </p>

            <ul className="mt-8 flex flex-col gap-4">
              {DESTAQUES.map((d, i) => {
                const Icone = d.icone
                return (
                  <li
                    key={d.titulo}
                    className="lema-entra flex items-start gap-3.5"
                    style={atraso(RITMO.destaques + i * RITMO.entreDestaques)}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/6 text-white/90 backdrop-blur">
                      <Icone size={17} strokeWidth={1.9} />
                    </span>
                    <span>
                      <span className="block text-[13.5px] font-semibold">
                        {d.titulo}
                      </span>
                      <span className="block text-[13px] leading-snug text-white/60">
                        {d.texto}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          <p className="text-[11.5px] text-white/50">
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

          <div className="rounded-3xl bg-card p-7 shadow-float duration-300 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 sm:p-9">
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
      className="flex items-start gap-2.5 rounded-xl bg-status-danger px-3.5 py-3 text-[13px] leading-snug text-status-danger-foreground duration-150 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1"
    >
      <span className="mt-[3px] size-2 shrink-0 rounded-full bg-current" />
      <span>{mensagem}</span>
    </div>
  )
}
